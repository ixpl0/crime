import { app, BrowserWindow, globalShortcut, ipcMain } from "electron";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import ipcChannelsModule from "./ipc-channels.cjs";
import settingsConstantsModule from "./settings-constants.cjs";
import quickKeyBindingsModule from "./quick-key-bindings.cjs";
import { buildChildProcessEnv } from "./main/child-process-env.mjs";
import { createCommandRunner } from "./main/run-command.mjs";
import { createGitService } from "./main/git-service.mjs";
import { attachWindowStatePersistence, getInitialWindowState } from "./main/window-state.mjs";
import { registerClipboardIpcHandlers } from "./main/ipc/register-clipboard-ipc.mjs";
import { registerFilesystemIpcHandlers } from "./main/ipc/register-filesystem-ipc.mjs";
import { registerGitIpcHandlers } from "./main/ipc/register-git-ipc.mjs";
import { registerShellIpcHandlers } from "./main/ipc/register-shell-ipc.mjs";
import { registerProjectIpcHandlers } from "./main/ipc/register-project-ipc.mjs";
import { registerSettingsIpcHandlers } from "./main/ipc/register-settings-ipc.mjs";
import { registerTerminalIpcHandlers } from "./main/ipc/register-terminal-ipc.mjs";
import { registerGitWatcherIpcHandlers } from "./main/ipc/register-git-watcher-ipc.mjs";
import { registerSearchIpcHandlers } from "./main/ipc/register-search-ipc.mjs";
import { toErrorMessage, toIpcErrorResponse } from "./main/error-utils.mjs";
import { logger } from "./main/logger.mjs";

if (!app.isPackaged) {
  app.name = "crime-dev";
}

logger.info(`App starting (pid=${process.pid}, packaged=${app.isPackaged}, platform=${process.platform}, arch=${process.arch})`);
logger.info(`Electron ${process.versions.electron}, Chrome ${process.versions.chrome}, Node ${process.versions.node}`);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const IDE_ROOT_PATH = resolve(__dirname, "..");
const IDE_NODE_MODULES_BIN_PATH = join(IDE_ROOT_PATH, "node_modules", ".bin");
const terminalSessions = new Map();
const settingsWatchers = new Map();
const gitWatchers = new Map();
const { IPC_CHANNELS } = ipcChannelsModule;
const { SETTINGS_DIRNAME } = settingsConstantsModule;
const { quickKeyBindings } = quickKeyBindingsModule;

const WINDOW_STATE_SAVE_DEBOUNCE_MS = 250;
const IS_FAIL_FAST = !app.isPackaged;
const DEFAULT_TERMINAL_SESSION_ID = "primary";

const runCommand = createCommandRunner(IDE_NODE_MODULES_BIN_PATH);
const gitService = createGitService(runCommand);

function toIpcFailure(error, fallbackMessage) {
  const response = toIpcErrorResponse(error, fallbackMessage);
  if (IS_FAIL_FAST) {
    throw new Error(response.error);
  }

  return response;
}

function stopSettingsWatcher(webContentsId) {
  const watcher = settingsWatchers.get(webContentsId);
  if (!watcher) {
    return;
  }

  watcher.close();
  settingsWatchers.delete(webContentsId);
}

function stopGitWatcher(webContentsId) {
  const watcher = gitWatchers.get(webContentsId);
  if (!watcher) {
    return;
  }

  watcher.close();
  gitWatchers.delete(webContentsId);
}

function resolveShell() {
  if (process.platform === "win32") {
    return {
      command: process.env.COMSPEC ?? "C:\\Windows\\System32\\cmd.exe",
      args: []
    };
  }

  return { command: process.env.SHELL ?? "/bin/bash", args: ["-i"] };
}

function sendTerminalEvent(webContents, channel, payload) {
  if (webContents.isDestroyed()) {
    return;
  }

  webContents.send(channel, payload);
}

function getTerminalSessionGroup(webContentsId, shouldCreate = false) {
  const existingGroup = terminalSessions.get(webContentsId);
  if (existingGroup) {
    return existingGroup;
  }

  if (!shouldCreate) {
    return null;
  }

  const nextGroup = new Map();
  terminalSessions.set(webContentsId, nextGroup);
  return nextGroup;
}

function removeTerminalSession(webContentsId, sessionId) {
  const sessionGroup = getTerminalSessionGroup(webContentsId);
  if (!sessionGroup) {
    return;
  }

  sessionGroup.delete(sessionId);
  if (sessionGroup.size === 0) {
    terminalSessions.delete(webContentsId);
  }
}

function stopTerminalSession(
  webContentsId,
  sessionId = DEFAULT_TERMINAL_SESSION_ID
) {
  const sessionGroup = getTerminalSessionGroup(webContentsId);
  const session = sessionGroup?.get(sessionId);
  if (!session) {
    return;
  }

  session.process.kill();
  removeTerminalSession(webContentsId, sessionId);
}

function stopAllTerminalSessions(webContentsId) {
  const sessionGroup = getTerminalSessionGroup(webContentsId);
  if (!sessionGroup) {
    return;
  }

  const sessionIds = [...sessionGroup.keys()];
  for (const sessionId of sessionIds) {
    stopTerminalSession(webContentsId, sessionId);
  }
}

function isActiveSession(webContentsId, sessionId, shellProcess) {
  const session = getTerminalSessionGroup(webContentsId)?.get(sessionId);
  return session?.process === shellProcess;
}

function getIconPath() {
  const extension = process.platform === "win32" ? "ico" : "png";
  return join(__dirname, "assets", `icon.${extension}`);
}

const NEW_WINDOW_POSITION_OFFSET = 30;
let lastFocusedWindow = null;

function createWindow({ skipLastProjectRestore = false, openProjectPath = null } = {}) {
  const initialWindowState = getInitialWindowState();
  const existingWindowCount = BrowserWindow.getAllWindows().length;
  const offset = existingWindowCount * NEW_WINDOW_POSITION_OFFSET;
  const mainWindow = new BrowserWindow({
    title: "CRIME",
    x: initialWindowState.bounds.x + offset,
    y: initialWindowState.bounds.y + offset,
    width: initialWindowState.bounds.width,
    height: initialWindowState.bounds.height,
    show: false,
    backgroundColor: "#1d232a",
    icon: getIconPath(),
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#1d232a",
      symbolColor: "#a6adbb",
      height: 32
    },
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  logger.info(`Window created (webContentsId=${mainWindow.webContents.id})`);

  const webContentsId = mainWindow.webContents.id;
  attachWindowStatePersistence(mainWindow, WINDOW_STATE_SAVE_DEBOUNCE_MS);

  mainWindow.on("focus", () => {
    lastFocusedWindow = mainWindow;
  });

  mainWindow.on("closed", () => {
    logger.info(`Window closed (webContentsId=${webContentsId})`);
    if (lastFocusedWindow === mainWindow) {
      lastFocusedWindow = null;
    }
    stopAllTerminalSessions(webContentsId);
    stopSettingsWatcher(webContentsId);
    stopGitWatcher(webContentsId);
  });

  // Re-apply bounds once the window is fully initialized on the target display.
  // Fixes wrong size when restoring on a monitor with different DPI scale.
  mainWindow.once("ready-to-show", () => {
    logger.info("Window ready-to-show");
    if (initialWindowState.isMaximized) {
      mainWindow.maximize();
    } else {
      mainWindow.setBounds(initialWindowState.bounds);
    }
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    const queryParams = new URLSearchParams();
    if (skipLastProjectRestore) {
      queryParams.set("skipRestore", "1");
    }
    if (openProjectPath) {
      queryParams.set("openProject", openProjectPath);
    }
    const queryString = queryParams.toString();
    const url = queryString ? `${devServerUrl}?${queryString}` : devServerUrl;
    logger.info(`Loading dev server: ${url}`);
    const DEV_LOAD_MAX_RETRIES = 5;
    const DEV_LOAD_RETRY_DELAY_MS = 600;
    const loadWithRetry = (retriesLeft) => {
      mainWindow.loadURL(url).catch((error) => {
        if (retriesLeft > 0 && !mainWindow.isDestroyed()) {
          logger.warn(`Dev server load failed, retrying (${retriesLeft} left)`, error);
          setTimeout(() => loadWithRetry(retriesLeft - 1), DEV_LOAD_RETRY_DELAY_MS);
        } else {
          logger.error("Dev server load failed, no retries left", error);
        }
      });
    };
    loadWithRetry(DEV_LOAD_MAX_RETRIES);
    if (process.env.OPEN_DEVTOOLS === "1") {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    }
    return;
  }

  const query = {};
  if (skipLastProjectRestore) {
    query.skipRestore = "1";
  }
  if (openProjectPath) {
    query.openProject = openProjectPath;
  }
  const loadFileOptions = Object.keys(query).length > 0 ? { query } : undefined;
  const indexPath = join(__dirname, "../dist/index.html");
  logger.info(`Loading production file: ${indexPath}`);
  mainWindow.loadFile(indexPath, loadFileOptions);
}

function registerIpcHandlers() {
  registerProjectIpcHandlers({ IPC_CHANNELS, createWindow });
  registerSettingsIpcHandlers({
    IPC_CHANNELS,
    settingsDirName: SETTINGS_DIRNAME,
    settingsWatchers,
    stopSettingsWatcher,
    toErrorMessage,
    toIpcFailure,
    isFailFast: IS_FAIL_FAST
  });
  registerTerminalIpcHandlers({
    IPC_CHANNELS,
    terminalSessions,
    stopTerminalSession,
    resolveShell,
    buildChildProcessEnv,
    ideNodeModulesBinPath: IDE_NODE_MODULES_BIN_PATH,
    isActiveSession,
    sendTerminalEvent
  });
  registerClipboardIpcHandlers({ IPC_CHANNELS });
  registerShellIpcHandlers({ IPC_CHANNELS });
  registerFilesystemIpcHandlers({ IPC_CHANNELS, gitService });
  registerGitIpcHandlers({ IPC_CHANNELS, gitService });
  registerGitWatcherIpcHandlers({
    IPC_CHANNELS,
    gitWatchers,
    stopGitWatcher
  });
  registerSearchIpcHandlers({ IPC_CHANNELS, runCommand });

  ipcMain.handle(IPC_CHANNELS.windowFlashFrame, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
      win.flashFrame(true);
    }
  });

  ipcMain.handle(IPC_CHANNELS.logWrite, (_event, level, message) => {
    const logMethod = level === "error" ? logger.error
      : level === "warn" ? logger.warn
        : logger.info;
    logMethod(`[renderer] ${message}`);
  });
}

function registerGlobalQuickKeys() {
  for (const binding of quickKeyBindings) {
    const isRegistered = globalShortcut.register(binding.accelerator, () => {
      const targetWindow = BrowserWindow.getFocusedWindow()
        ?? (lastFocusedWindow && !lastFocusedWindow.isDestroyed() ? lastFocusedWindow : null)
        ?? BrowserWindow.getAllWindows().find((window) => !window.isDestroyed());
      if (targetWindow) {
        targetWindow.flashFrame(false);
        targetWindow.webContents.send(IPC_CHANNELS.globalQuickKey, binding.input);
      }
    });

    if (!isRegistered) {
      // Global shortcut conflict is an external condition (another app holds
      // the accelerator), not a programming error — log but do not throw.
      logger.warn(`Failed to register global shortcut: ${binding.accelerator}`);
    }
  }
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  logger.warn("Another instance is already running, quitting");
  app.quit();
} else {
  app.on("second-instance", () => {
    logger.info("Second instance requested, opening new window");
    createWindow({ skipLastProjectRestore: true });
  });

  app.whenReady().then(() => {
    logger.info("App ready");
    registerIpcHandlers();
    logger.info("IPC handlers registered");
    createWindow();
    registerGlobalQuickKeys();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on("will-quit", () => {
    logger.info("App quitting");
    globalShortcut.unregisterAll();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}
