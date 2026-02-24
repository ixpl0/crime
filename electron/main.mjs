import { app, BrowserWindow, dialog, globalShortcut, ipcMain, nativeTheme, screen } from "electron";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, normalize, relative } from "node:path";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { watch, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import * as pty from "node-pty";
import ipcChannelsModule from "./ipc-channels.cjs";
import settingsConstantsModule from "./settings-constants.cjs";
import quickKeyBindingsModule from "./quick-key-bindings.cjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const terminalSessions = new Map();
const settingsWatchers = new Map();
const { IPC_CHANNELS } = ipcChannelsModule;
const { SETTINGS_DIRNAME } = settingsConstantsModule;
const { quickKeyBindings } = quickKeyBindingsModule;

const SETTINGS_WATCH_DEBOUNCE_MS = 300;
const WINDOW_STATE_FILENAME = "window-state.json";
const WINDOW_STATE_SAVE_DEBOUNCE_MS = 250;
const DEFAULT_WINDOW_WIDTH = 1280;
const DEFAULT_WINDOW_HEIGHT = 800;
const GIT_STATUS_PRIORITY = {
  modified: 1,
  added: 2,
  deleted: 3
};

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toValidCoordinate(value) {
  return Number.isFinite(value) ? Math.round(value) : null;
}

function toValidSize(value) {
  const parsed = toValidCoordinate(value);
  if (parsed === null || parsed <= 0) {
    return null;
  }
  return parsed;
}

function clampWindowBoundsToWorkArea(bounds, workArea) {
  const maxWidth = Math.max(1, workArea.width);
  const maxHeight = Math.max(1, workArea.height);
  const width = Math.min(Math.max(1, bounds.width), maxWidth);
  const height = Math.min(Math.max(1, bounds.height), maxHeight);
  const maxX = Math.max(workArea.x, workArea.x + workArea.width - width);
  const maxY = Math.max(workArea.y, workArea.y + workArea.height - height);
  const x = Math.min(Math.max(bounds.x, workArea.x), maxX);
  const y = Math.min(Math.max(bounds.y, workArea.y), maxY);

  return { x, y, width, height };
}

function getWindowStateFilePath() {
  return join(app.getPath("userData"), WINDOW_STATE_FILENAME);
}

function getDefaultWindowBounds() {
  const workArea = screen.getPrimaryDisplay().workArea;
  const width = Math.min(DEFAULT_WINDOW_WIDTH, Math.max(1, workArea.width));
  const height = Math.min(DEFAULT_WINDOW_HEIGHT, Math.max(1, workArea.height));
  const x = workArea.x + Math.floor((workArea.width - width) / 2);
  const y = workArea.y + Math.floor((workArea.height - height) / 2);
  return { x, y, width, height };
}

function parseWindowState(value) {
  if (!isRecord(value)) {
    return null;
  }

  const x = toValidCoordinate(value.x);
  const y = toValidCoordinate(value.y);
  const width = toValidSize(value.width);
  const height = toValidSize(value.height);
  if (x === null || y === null || width === null || height === null) {
    return null;
  }

  const displayId = Number.isInteger(value.displayId) ? value.displayId : null;
  const isMaximized = value.isMaximized === true;
  return { x, y, width, height, displayId, isMaximized };
}

function loadWindowState() {
  try {
    const content = readFileSync(getWindowStateFilePath(), "utf-8");
    const parsed = parseWindowState(JSON.parse(content));
    return parsed;
  } catch {
    return null;
  }
}

function resolveWindowDisplay(savedState, bounds) {
  if (savedState && savedState.displayId !== null) {
    const matchedDisplay = screen
      .getAllDisplays()
      .find((display) => display.id === savedState.displayId);
    if (matchedDisplay) {
      return matchedDisplay;
    }
  }

  return screen.getDisplayMatching(bounds);
}

function getInitialWindowState() {
  const defaultBounds = getDefaultWindowBounds();
  const savedState = loadWindowState();
  if (!savedState) {
    const defaultDisplay = screen.getDisplayMatching(defaultBounds);
    return {
      bounds: clampWindowBoundsToWorkArea(defaultBounds, defaultDisplay.workArea),
      isMaximized: false
    };
  }

  const requestedBounds = {
    x: savedState.x,
    y: savedState.y,
    width: savedState.width,
    height: savedState.height
  };
  const display = resolveWindowDisplay(savedState, requestedBounds);
  return {
    bounds: clampWindowBoundsToWorkArea(requestedBounds, display.workArea),
    isMaximized: savedState.isMaximized
  };
}

function buildWindowStateSnapshot(win) {
  const isMaximized = win.isMaximized();
  const sourceBounds = isMaximized ? win.getNormalBounds() : win.getBounds();
  const display = screen.getDisplayMatching(sourceBounds);
  const bounds = clampWindowBoundsToWorkArea(sourceBounds, display.workArea);
  return {
    ...bounds,
    displayId: display.id,
    isMaximized
  };
}

function saveWindowState(snapshot) {
  try {
    const filePath = getWindowStateFilePath();
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(snapshot, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to save window state.", error);
  }
}

function runCommand(command, args, cwd) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });

    const stdoutChunks = [];
    const stderrChunks = [];

    child.stdout.on("data", (chunk) => {
      stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    child.stderr.on("data", (chunk) => {
      stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    child.on("error", (error) => {
      rejectPromise(error);
    });

    child.on("close", (code) => {
      resolvePromise({
        code: typeof code === "number" ? code : -1,
        stdout: Buffer.concat(stdoutChunks),
        stderr: Buffer.concat(stderrChunks)
      });
    });
  });
}

function getGitStatusKind(x, y) {
  if (x === "D" || y === "D") {
    return "deleted";
  }

  if (x === "A" || y === "A" || x === "?" || y === "?") {
    return "added";
  }

  return "modified";
}

function upsertGitStatus(statusByPath, absolutePath, nextStatus) {
  const currentStatus = statusByPath.get(absolutePath);
  if (!currentStatus) {
    statusByPath.set(absolutePath, nextStatus);
    return;
  }

  if (GIT_STATUS_PRIORITY[nextStatus] > GIT_STATUS_PRIORITY[currentStatus]) {
    statusByPath.set(absolutePath, nextStatus);
  }
}

function parseGitStatusPorcelain(output, cwd) {
  const statusByPath = new Map();
  const records = output.split("\0");

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record || record.length < 4 || record[2] !== " ") {
      continue;
    }

    const x = record[0];
    const y = record[1];
    const firstPath = record.slice(3);
    const isRenameOrCopy = x === "R" || x === "C" || y === "R" || y === "C";

    if (isRenameOrCopy) {
      const secondPath = records[index + 1];
      index += 1;

      if (firstPath) {
        upsertGitStatus(statusByPath, resolve(cwd, firstPath), "modified");
      }
      if (typeof secondPath === "string" && secondPath.length > 0) {
        upsertGitStatus(statusByPath, resolve(cwd, secondPath), "modified");
      }
      continue;
    }

    const path = firstPath;
    if (!path) {
      continue;
    }

    upsertGitStatus(statusByPath, resolve(cwd, path), getGitStatusKind(x, y));
  }

  return Array.from(statusByPath.entries()).map(([path, status]) => ({ path, status }));
}

function toPathKey(path) {
  const normalizedPath = normalize(resolve(path));
  return process.platform === "win32" ? normalizedPath.toLowerCase() : normalizedPath;
}

function getFileEntrySortGroup(entry) {
  if (entry.isDirectory) {
    return entry.isIgnored === true ? 0 : 1;
  }

  return entry.isIgnored === true ? 2 : 3;
}

function toGitRelativePath(basePath, targetPath) {
  const relativePath = relative(basePath, targetPath).split("\\").join("/");
  if (
    relativePath.length === 0 ||
    relativePath === "." ||
    relativePath === ".." ||
    relativePath.startsWith("../")
  ) {
    return null;
  }

  return relativePath;
}

async function getGitRepositoryRoot(path) {
  let revParseResult;
  try {
    revParseResult = await runCommand("git", ["rev-parse", "--show-toplevel"], path);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }

    return null;
  }

  if (revParseResult.code !== 0) {
    return null;
  }

  const repositoryRoot = revParseResult.stdout.toString("utf-8").trim();
  return repositoryRoot.length > 0 ? repositoryRoot : null;
}

async function getIgnoredEntryPathKeySet(dirPath, entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return new Set();
  }

  const repositoryRoot = await getGitRepositoryRoot(dirPath);
  if (!repositoryRoot) {
    return new Set();
  }

  const relativeEntryPaths = [];
  for (const entry of entries) {
    const relativeEntryPath = toGitRelativePath(repositoryRoot, entry.path);
    if (relativeEntryPath) {
      relativeEntryPaths.push(relativeEntryPath);
    }
  }

  if (relativeEntryPaths.length === 0) {
    return new Set();
  }

  let checkIgnoreResult;
  try {
    checkIgnoreResult = await runCommand(
      "git",
      ["-c", "core.quotepath=false", "check-ignore", "--", ...relativeEntryPaths],
      repositoryRoot
    );
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return new Set();
    }

    return new Set();
  }

  if (checkIgnoreResult.code !== 0 && checkIgnoreResult.code !== 1) {
    return new Set();
  }

  if (checkIgnoreResult.stdout.length === 0) {
    return new Set();
  }

  const ignoredPaths = checkIgnoreResult.stdout
    .toString("utf-8")
    .split(/\r?\n/)
    .filter((value) => value.length > 0);
  const ignoredPathKeySet = new Set();

  for (const ignoredPath of ignoredPaths) {
    ignoredPathKeySet.add(toPathKey(resolve(repositoryRoot, ignoredPath)));
  }

  return ignoredPathKeySet;
}

function toLineEntries(content, type = "context") {
  const rawLines = content.split(/\r?\n/);
  if (rawLines.length > 0 && rawLines[rawLines.length - 1] === "") {
    rawLines.pop();
  }

  return rawLines.map((text) => ({ type, text }));
}

function parseGitDiffLines(diffOutput) {
  const lines = [];
  let isInHunk = false;
  const rawLines = diffOutput.split(/\r?\n/);

  for (const rawLine of rawLines) {
    if (rawLine.startsWith("diff --git ")) {
      isInHunk = false;
      continue;
    }

    if (rawLine.startsWith("@@")) {
      isInHunk = true;
      continue;
    }

    if (!isInHunk || rawLine.startsWith("\\ No newline at end of file")) {
      continue;
    }

    if (rawLine.startsWith("+")) {
      lines.push({ type: "added", text: rawLine.slice(1) });
      continue;
    }

    if (rawLine.startsWith("-")) {
      lines.push({ type: "removed", text: rawLine.slice(1) });
      continue;
    }

    if (rawLine.startsWith(" ")) {
      lines.push({ type: "context", text: rawLine.slice(1) });
    }
  }

  return lines;
}

async function getGitRepositoryState(projectPath) {
  let revParseResult;
  try {
    revParseResult = await runCommand("git", ["rev-parse", "--is-inside-work-tree"], projectPath);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { ok: true, available: false, reason: "git-not-installed" };
    }

    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to check git availability."
    };
  }

  if (revParseResult.code !== 0 || revParseResult.stdout.toString("utf-8").trim() !== "true") {
    return { ok: true, available: false, reason: "not-a-repository" };
  }

  return { ok: true, available: true };
}

async function getGitStatusForPath(projectPath, relativePath) {
  let statusResult;
  try {
    statusResult = await runCommand(
      "git",
      ["-c", "core.quotepath=false", "status", "--porcelain=v1", "-z", "--", relativePath],
      projectPath
    );
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { ok: true, available: false, reason: "git-not-installed", status: null };
    }

    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to read file git status."
    };
  }

  if (statusResult.code !== 0) {
    const stderr = statusResult.stderr.toString("utf-8").trim();
    return { ok: false, error: stderr.length > 0 ? stderr : "Failed to read file git status." };
  }

  const entries = parseGitStatusPorcelain(statusResult.stdout.toString("utf-8"), projectPath);
  const filePathKey = toPathKey(resolve(projectPath, relativePath));
  const match = entries.find((entry) => toPathKey(entry.path) === filePathKey);
  return { ok: true, available: true, status: match?.status ?? null };
}

async function getGitStatusForProject(projectPath) {
  const repositoryState = await getGitRepositoryState(projectPath);
  if (!repositoryState.ok) {
    return repositoryState;
  }

  if (!repositoryState.available) {
    return { ...repositoryState, entries: [] };
  }

  let statusResult;
  try {
    statusResult = await runCommand(
      "git",
      [
        "-c",
        "core.quotepath=false",
        "status",
        "--porcelain=v1",
        "-z",
        "--untracked-files=all",
        "--",
        "."
      ],
      projectPath
    );
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { ok: true, available: false, reason: "git-not-installed", entries: [] };
    }

    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to read git status."
    };
  }

  if (statusResult.code !== 0) {
    const stderr = statusResult.stderr.toString("utf-8").trim();
    return {
      ok: false,
      error: stderr.length > 0 ? stderr : "Failed to read git status."
    };
  }

  return {
    ok: true,
    available: true,
    entries: parseGitStatusPorcelain(statusResult.stdout.toString("utf-8"), projectPath)
  };
}

function stopSettingsWatcher(webContentsId) {
  const watcher = settingsWatchers.get(webContentsId);
  if (!watcher) {
    return;
  }

  watcher.close();
  settingsWatchers.delete(webContentsId);
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
  let saveWindowStateTimer = null;

  const persistWindowState = () => {
    if (mainWindow.isDestroyed()) {
      return;
    }
    saveWindowState(buildWindowStateSnapshot(mainWindow));
  };

  const scheduleWindowStateSave = () => {
    if (saveWindowStateTimer) {
      clearTimeout(saveWindowStateTimer);
    }

    saveWindowStateTimer = setTimeout(() => {
      saveWindowStateTimer = null;
      persistWindowState();
    }, WINDOW_STATE_SAVE_DEBOUNCE_MS);
  };

  mainWindow.on("move", scheduleWindowStateSave);
  mainWindow.on("resize", scheduleWindowStateSave);
  mainWindow.on("maximize", scheduleWindowStateSave);
  mainWindow.on("unmaximize", scheduleWindowStateSave);
  mainWindow.on("close", () => {
    if (saveWindowStateTimer) {
      clearTimeout(saveWindowStateTimer);
      saveWindowStateTimer = null;
    }
    persistWindowState();
  });

  mainWindow.on("closed", () => {
    if (saveWindowStateTimer) {
      clearTimeout(saveWindowStateTimer);
      saveWindowStateTimer = null;
    }
    stopTerminalSession(webContentsId);
    stopSettingsWatcher(webContentsId);
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

function isPathInsideBase(base, target) {
  const normalizedBase = normalize(resolve(base));
  const normalizedTarget = normalize(resolve(target));
  return normalizedTarget.startsWith(normalizedBase);
}

function getSettingsDirPath(projectPath) {
  return join(projectPath, SETTINGS_DIRNAME);
}

function registerIpcHandlers() {
  ipcMain.removeHandler(IPC_CHANNELS.projectOpenFolder);
  ipcMain.removeHandler(IPC_CHANNELS.settingsRead);
  ipcMain.removeHandler(IPC_CHANNELS.settingsWrite);
  ipcMain.removeHandler(IPC_CHANNELS.settingsWatch);
  ipcMain.removeHandler(IPC_CHANNELS.settingsUnwatch);
  ipcMain.removeHandler(IPC_CHANNELS.terminalStart);
  ipcMain.removeHandler(IPC_CHANNELS.terminalInput);
  ipcMain.removeHandler(IPC_CHANNELS.terminalResize);
  ipcMain.removeHandler(IPC_CHANNELS.terminalStop);
  ipcMain.removeHandler(IPC_CHANNELS.filesystemReadDirectory);
  ipcMain.removeHandler(IPC_CHANNELS.filesystemReadFile);
  ipcMain.removeHandler(IPC_CHANNELS.gitStatus);
  ipcMain.removeHandler(IPC_CHANNELS.gitFileDiff);

  ipcMain.handle(IPC_CHANNELS.projectOpenFolder, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const result = await dialog.showOpenDialog(win, {
      title: "Open Project Folder",
      properties: ["openDirectory"]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle(IPC_CHANNELS.settingsRead, async (_event, projectPath, filename) => {
    if (typeof projectPath !== "string" || typeof filename !== "string") {
      return { ok: false, error: "Project path and filename are required." };
    }

    const settingsDir = getSettingsDirPath(projectPath);
    const filePath = join(settingsDir, filename);
    if (!isPathInsideBase(settingsDir, filePath)) {
      return { ok: false, error: "Invalid filename." };
    }

    try {
      const content = await readFile(filePath, "utf-8");
      return { ok: true, content };
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        return { ok: true, content: null };
      }

      return {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to read settings file."
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.settingsWrite, async (_event, projectPath, filename, content) => {
    if (typeof projectPath !== "string" || typeof filename !== "string" || typeof content !== "string") {
      return { ok: false, error: "Project path, filename and content are required." };
    }

    const settingsDir = getSettingsDirPath(projectPath);
    const filePath = join(settingsDir, filename);
    if (!isPathInsideBase(settingsDir, filePath)) {
      return { ok: false, error: "Invalid filename." };
    }

    try {
      await mkdir(settingsDir, { recursive: true });
      await writeFile(filePath, content, "utf-8");
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to write settings file."
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.settingsWatch, async (event, projectPath, filename) => {
    if (typeof projectPath !== "string" || typeof filename !== "string") {
      return { ok: false, error: "Project path and filename are required." };
    }

    const dirPath = getSettingsDirPath(projectPath);
    const watchAllFiles = filename === "*";
    if (!watchAllFiles) {
      const filePath = join(dirPath, filename);
      if (!isPathInsideBase(dirPath, filePath)) {
        return { ok: false, error: "Invalid filename." };
      }
    }

    const webContentsId = event.sender.id;
    stopSettingsWatcher(webContentsId);

    try {
      await mkdir(dirPath, { recursive: true });
    } catch {
      return { ok: true };
    }

    let debounceTimer = null;
    const pendingFilenames = new Set();

    try {
      const fsWatcher = watch(dirPath, (_eventType, changedFile) => {
        const changedFilename =
          typeof changedFile === "string"
            ? changedFile
            : Buffer.isBuffer(changedFile)
              ? changedFile.toString("utf-8")
              : null;
        if (!watchAllFiles) {
          if (changedFilename && changedFilename !== filename) {
            return;
          }
          pendingFilenames.add(changedFilename ?? filename);
        } else {
          // fs.watch may omit filename on some platforms; emit wildcard refresh in that case.
          pendingFilenames.add(changedFilename ?? "*");
        }

        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }

        debounceTimer = setTimeout(() => {
          const changedNames = pendingFilenames.has("*")
            ? ["*"]
            : Array.from(pendingFilenames);
          pendingFilenames.clear();
          debounceTimer = null;
          if (event.sender.isDestroyed()) {
            return;
          }
          for (const changedName of changedNames) {
            event.sender.send(IPC_CHANNELS.settingsFileChanged, changedName);
          }
        }, SETTINGS_WATCH_DEBOUNCE_MS);
      });

      fsWatcher.on("error", () => {
        stopSettingsWatcher(webContentsId);
      });

      settingsWatchers.set(webContentsId, fsWatcher);
      return { ok: true };
    } catch {
      return { ok: true };
    }
  });

  ipcMain.handle(IPC_CHANNELS.settingsUnwatch, (event) => {
    stopSettingsWatcher(event.sender.id);
    return { ok: true };
  });

  ipcMain.handle(IPC_CHANNELS.terminalStart, async (event, cwd, size) => {
    if (!cwd || typeof cwd !== "string") {
      return { ok: false, error: "Project path is required." };
    }

    const webContentsId = event.sender.id;
    stopTerminalSession(webContentsId);

    const shell = resolveShell();
    const cols =
      size &&
      typeof size === "object" &&
      Number.isInteger(size.cols) &&
      size.cols > 0
        ? size.cols
        : 120;
    const rows =
      size &&
      typeof size === "object" &&
      Number.isInteger(size.rows) &&
      size.rows > 0
        ? size.rows
        : 30;
    let shellProcess;

    try {
      shellProcess = pty.spawn(shell.command, shell.args, {
        name: "xterm-256color",
        cols,
        rows,
        cwd,
        env: process.env
      });
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to start terminal."
      };
    }

    terminalSessions.set(webContentsId, { process: shellProcess });

    shellProcess.onData((data) => {
      if (!isActiveSession(webContentsId, shellProcess)) {
        return;
      }

      sendTerminalEvent(event.sender, IPC_CHANNELS.terminalData, data);
    });

    shellProcess.onExit(({ exitCode }) => {
      if (!isActiveSession(webContentsId, shellProcess)) {
        return;
      }

      terminalSessions.delete(webContentsId);
      sendTerminalEvent(event.sender, IPC_CHANNELS.terminalExit, exitCode ?? null);
    });

    return { ok: true };
  });

  ipcMain.handle(IPC_CHANNELS.terminalInput, async (event, data) => {
    if (typeof data !== "string") {
      return { ok: false, error: "Input must be a string." };
    }

    const session = terminalSessions.get(event.sender.id);
    if (!session) {
      return { ok: false, error: "Terminal session is not running." };
    }

    try {
      session.process.write(data);
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to write input."
      };
    }

    return { ok: true };
  });

  ipcMain.handle(IPC_CHANNELS.terminalResize, async (event, size) => {
    const session = terminalSessions.get(event.sender.id);
    if (!session) {
      return { ok: false, error: "Terminal session is not running." };
    }

    const cols =
      size &&
      typeof size === "object" &&
      Number.isInteger(size.cols) &&
      size.cols > 0
        ? size.cols
        : null;
    const rows =
      size &&
      typeof size === "object" &&
      Number.isInteger(size.rows) &&
      size.rows > 0
        ? size.rows
        : null;

    if (!cols || !rows) {
      return { ok: false, error: "Valid terminal size is required." };
    }

    try {
      session.process.resize(cols, rows);
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to resize terminal."
      };
    }

    return { ok: true };
  });

  ipcMain.handle(IPC_CHANNELS.terminalStop, async (event) => {
    stopTerminalSession(event.sender.id);
    return { ok: true };
  });

  ipcMain.handle(IPC_CHANNELS.filesystemReadDirectory, async (_event, dirPath) => {
    if (!dirPath || typeof dirPath !== "string") {
      return { ok: false, error: "Directory path is required." };
    }

    try {
      const dirents = await readdir(dirPath, { withFileTypes: true });
      const entries = dirents.map((dirent) => ({
        name: dirent.name,
        isDirectory: dirent.isDirectory(),
        path: join(dirPath, dirent.name)
      }));
      const ignoredEntryPathKeySet = await getIgnoredEntryPathKeySet(dirPath, entries);
      const entriesWithIgnoredState = entries
        .map((entry) => ({
          ...entry,
          isIgnored: ignoredEntryPathKeySet.has(toPathKey(entry.path))
        }))
        .sort((a, b) => {
          const groupDiff = getFileEntrySortGroup(a) - getFileEntrySortGroup(b);
          if (groupDiff !== 0) {
            return groupDiff;
          }

          return a.name.localeCompare(b.name);
        });

      return { ok: true, entries: entriesWithIgnoredState };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to read directory."
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.filesystemReadFile, async (_event, projectPath, filePath) => {
    if (typeof projectPath !== "string" || typeof filePath !== "string") {
      return { ok: false, error: "Project path and file path are required." };
    }

    const resolvedFilePath = resolve(filePath);
    if (!isPathInsideBase(projectPath, resolvedFilePath)) {
      return { ok: false, error: "Invalid file path." };
    }

    try {
      const content = await readFile(resolvedFilePath, "utf-8");
      return { ok: true, content };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to read file."
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.gitFileDiff, async (_event, projectPath, filePath) => {
    if (typeof projectPath !== "string" || typeof filePath !== "string") {
      return { ok: false, error: "Project path and file path are required." };
    }

    const resolvedProjectPath = resolve(projectPath);
    const resolvedFilePath = resolve(filePath);
    if (!isPathInsideBase(resolvedProjectPath, resolvedFilePath)) {
      return { ok: false, error: "Invalid file path." };
    }

    const relativePath = relative(resolvedProjectPath, resolvedFilePath).split("\\").join("/");
    if (
      relativePath.length === 0 ||
      relativePath === ".." ||
      relativePath.startsWith("../")
    ) {
      return { ok: false, error: "Invalid file path." };
    }

    const repositoryState = await getGitRepositoryState(resolvedProjectPath);
    if (!repositoryState.ok) {
      return repositoryState;
    }

    if (!repositoryState.available) {
      return { ...repositoryState, lines: [], status: null };
    }

    const fileStatusResponse = await getGitStatusForPath(resolvedProjectPath, relativePath);
    if (!fileStatusResponse.ok) {
      return fileStatusResponse;
    }

    const runDiffForPath = async (extraArgs = []) => {
      const diffResult = await runCommand(
        "git",
        [
          "-c",
          "core.quotepath=false",
          "diff",
          "--no-color",
          "--unified=999999",
          "--no-ext-diff",
          ...extraArgs,
          "--",
          relativePath
        ],
        resolvedProjectPath
      );

      if (diffResult.code !== 0) {
        const stderr = diffResult.stderr.toString("utf-8").trim();
        return { ok: false, error: stderr.length > 0 ? stderr : "Failed to get file diff." };
      }

      return { ok: true, lines: parseGitDiffLines(diffResult.stdout.toString("utf-8")) };
    };

    let diffLines;
    try {
      const initialDiffResponse = await runDiffForPath();
      if (!initialDiffResponse.ok) {
        return initialDiffResponse;
      }
      diffLines = initialDiffResponse.lines;

      if (diffLines.length === 0 && fileStatusResponse.status === "modified") {
        const cachedDiffResponse = await runDiffForPath(["--cached"]);
        if (!cachedDiffResponse.ok) {
          return cachedDiffResponse;
        }

        diffLines = cachedDiffResponse.lines;
      }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to get file diff."
      };
    }

    if (!diffLines) {
      diffLines = [];
    }

    if (diffLines.length === 0 && fileStatusResponse.status === "added") {
      try {
        const content = await readFile(resolvedFilePath, "utf-8");
        diffLines = toLineEntries(content, "added");
      } catch {
        diffLines = [];
      }
    }

    if (diffLines.length === 0 && fileStatusResponse.status === "deleted") {
      try {
        const showResult = await runCommand(
          "git",
          ["-c", "core.quotepath=false", "show", `HEAD:${relativePath}`],
          resolvedProjectPath
        );

        if (showResult.code === 0) {
          diffLines = toLineEntries(showResult.stdout.toString("utf-8"), "removed");
        }
      } catch {
        diffLines = [];
      }
    }

    return {
      ok: true,
      available: true,
      status: fileStatusResponse.status ?? null,
      lines: diffLines
    };
  });

  ipcMain.handle(IPC_CHANNELS.gitStatus, async (_event, projectPath) => {
    if (!projectPath || typeof projectPath !== "string") {
      return { ok: false, error: "Project path is required." };
    }

    return getGitStatusForProject(projectPath);
  });
}

function registerGlobalQuickKeys() {
  for (const binding of quickKeyBindings) {
    globalShortcut.register(binding.accelerator, () => {
      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send(IPC_CHANNELS.globalQuickKey, binding.input);
        }
      }
    });
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
