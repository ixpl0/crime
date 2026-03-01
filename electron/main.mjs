import { app, BrowserWindow, globalShortcut, nativeTheme } from "electron";
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
const IS_FAIL_FAST = process.env.NODE_ENV !== "production";

const runCommand = createCommandRunner(IDE_NODE_MODULES_BIN_PATH);
const gitService = createGitService(runCommand);

function toErrorMessage(error, fallbackMessage) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.length > 0) {
    return error;
  }

  return fallbackMessage;
}

function toIpcFailure(error, fallbackMessage) {
  const message = toErrorMessage(error, fallbackMessage);
  if (IS_FAIL_FAST) {
    throw new Error(message);
  }

  return { ok: false, error: message };
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

function stopTerminalSession(webContentsId) {
  const session = terminalSessions.get(webContentsId);
  if (!session) {
    return;
  }

  session.process.kill();
  terminalSessions.delete(webContentsId);
}

function isActiveSession(webContentsId, shellProcess) {
  const session = terminalSessions.get(webContentsId);
  return session?.process === shellProcess;
}

function getThemeIconPath() {
  const isDarkTheme = nativeTheme.shouldUseDarkColors;
  if (process.platform === "win32") {
    return join(__dirname, "assets", isDarkTheme ? "icon-dark.ico" : "icon-light.ico");
  }

  return join(__dirname, "assets", isDarkTheme ? "icon-dark.png" : "icon-light.png");
}

function applyThemeIcon(win) {
  if (win.isDestroyed()) {
    return;
  }

  const iconPath = getThemeIconPath();
  if (process.platform === "darwin") {
    app.dock?.setIcon(iconPath);
    return;
  }

  win.setIcon(iconPath);
}

function createWindow() {
  const initialWindowState = getInitialWindowState();
  const mainWindow = new BrowserWindow({
    title: "Dream IDE",
    x: initialWindowState.bounds.x,
    y: initialWindowState.bounds.y,
    width: initialWindowState.bounds.width,
    height: initialWindowState.bounds.height,
    icon: getThemeIconPath(),
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const webContentsId = mainWindow.webContents.id;
  attachWindowStatePersistence(mainWindow, WINDOW_STATE_SAVE_DEBOUNCE_MS);

  mainWindow.on("closed", () => {
    stopTerminalSession(webContentsId);
    stopSettingsWatcher(webContentsId);
    stopGitWatcher(webContentsId);
  });

  if (initialWindowState.isMaximized) {
    mainWindow.maximize();
  }

  applyThemeIcon(mainWindow);

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
    if (process.env.OPEN_DEVTOOLS === "1") {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    }
    return;
  }

  mainWindow.loadFile(join(__dirname, "../dist/index.html"));
}

function registerIpcHandlers() {
  registerProjectIpcHandlers({ IPC_CHANNELS });
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
    stopGitWatcher,
    toIpcFailure
  });
}

function registerGlobalQuickKeys() {
  for (const binding of quickKeyBindings) {
    const isRegistered = globalShortcut.register(binding.accelerator, () => {
      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send(IPC_CHANNELS.globalQuickKey, binding.input);
        }
      }
    });

    if (!isRegistered) {
      const message = `Failed to register global shortcut: ${binding.accelerator}`;
      if (IS_FAIL_FAST) {
        throw new Error(message);
      }

      console.error(message);
    }
  }
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();
  registerGlobalQuickKeys();

  nativeTheme.on("updated", () => {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      applyThemeIcon(win);
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
