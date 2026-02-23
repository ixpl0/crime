import { app, BrowserWindow, dialog, globalShortcut, ipcMain, nativeTheme } from "electron";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, normalize, relative } from "node:path";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { watch } from "node:fs";
import { spawn } from "node:child_process";
import * as pty from "node-pty";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const terminalSessions = new Map();
const settingsWatchers = new Map();

const SETTINGS_WATCH_DEBOUNCE_MS = 300;
const GIT_STATUS_PRIORITY = {
  modified: 1,
  added: 2,
  deleted: 3
};

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
  const mainWindow = new BrowserWindow({
    title: "Dream IDE",
    width: 1280,
    height: 800,
    icon: getThemeIconPath(),
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  const webContentsId = mainWindow.webContents.id;

  mainWindow.on("closed", () => {
    stopTerminalSession(webContentsId);
    stopSettingsWatcher(webContentsId);
  });

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

function registerIpcHandlers() {
  ipcMain.removeHandler("project:open-folder");
  ipcMain.removeHandler("settings:read");
  ipcMain.removeHandler("settings:write");
  ipcMain.removeHandler("settings:watch");
  ipcMain.removeHandler("settings:unwatch");
  ipcMain.removeHandler("terminal:start");
  ipcMain.removeHandler("terminal:run-command");
  ipcMain.removeHandler("terminal:input");
  ipcMain.removeHandler("terminal:resize");
  ipcMain.removeHandler("terminal:stop");
  ipcMain.removeHandler("filesystem:read-directory");
  ipcMain.removeHandler("filesystem:read-file");
  ipcMain.removeHandler("git:status");
  ipcMain.removeHandler("git:file-diff");

  ipcMain.handle("project:open-folder", async (event) => {
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

  ipcMain.handle("settings:read", async (_event, projectPath, filename) => {
    if (typeof projectPath !== "string" || typeof filename !== "string") {
      return { ok: false, error: "Project path and filename are required." };
    }

    const filePath = join(projectPath, ".dream", filename);
    if (!isPathInsideBase(join(projectPath, ".dream"), filePath)) {
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

  ipcMain.handle("settings:write", async (_event, projectPath, filename, content) => {
    if (typeof projectPath !== "string" || typeof filename !== "string" || typeof content !== "string") {
      return { ok: false, error: "Project path, filename and content are required." };
    }

    const dreamDir = join(projectPath, ".dream");
    const filePath = join(dreamDir, filename);
    if (!isPathInsideBase(dreamDir, filePath)) {
      return { ok: false, error: "Invalid filename." };
    }

    try {
      await mkdir(dreamDir, { recursive: true });
      await writeFile(filePath, content, "utf-8");
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to write settings file."
      };
    }
  });

  ipcMain.handle("settings:watch", async (event, projectPath, filename) => {
    if (typeof projectPath !== "string" || typeof filename !== "string") {
      return { ok: false, error: "Project path and filename are required." };
    }

    const dirPath = join(projectPath, ".dream");
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
    let pendingFilename = null;

    try {
      const fsWatcher = watch(dirPath, (_eventType, changedFile) => {
        const changedFilename =
          typeof changedFile === "string"
            ? changedFile
            : Buffer.isBuffer(changedFile)
              ? changedFile.toString("utf-8")
              : null;
        if (!changedFilename) {
          return;
        }
        if (!watchAllFiles && changedFilename !== filename) {
          return;
        }

        pendingFilename = changedFilename;

        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }

        debounceTimer = setTimeout(() => {
          const changedName = pendingFilename;
          pendingFilename = null;
          debounceTimer = null;
          if (!event.sender.isDestroyed() && changedName) {
            event.sender.send("settings:file-changed", changedName);
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

  ipcMain.handle("settings:unwatch", (event) => {
    stopSettingsWatcher(event.sender.id);
    return { ok: true };
  });

  ipcMain.handle("terminal:start", async (event, cwd, size) => {
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

      sendTerminalEvent(event.sender, "terminal:data", data);
    });

    shellProcess.onExit(({ exitCode }) => {
      if (!isActiveSession(webContentsId, shellProcess)) {
        return;
      }

      terminalSessions.delete(webContentsId);
      sendTerminalEvent(event.sender, "terminal:exit", exitCode ?? null);
    });

    return { ok: true };
  });

  ipcMain.handle("terminal:run-command", async (event, command) => {
    if (!command || typeof command !== "string") {
      return { ok: false, error: "Command is required." };
    }

    const session = terminalSessions.get(event.sender.id);
    if (!session) {
      return { ok: false, error: "Terminal session is not running." };
    }

    try {
      session.process.write(command);
      await new Promise((resolve) => setTimeout(resolve, 100));
      session.process.write("\r");
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to write command."
      };
    }

    return { ok: true };
  });

  ipcMain.handle("terminal:input", async (event, data) => {
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

  ipcMain.handle("terminal:resize", async (event, size) => {
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

  ipcMain.handle("terminal:stop", async (event) => {
    stopTerminalSession(event.sender.id);
    return { ok: true };
  });

  ipcMain.handle("filesystem:read-directory", async (_event, dirPath) => {
    if (!dirPath || typeof dirPath !== "string") {
      return { ok: false, error: "Directory path is required." };
    }

    try {
      const dirents = await readdir(dirPath, { withFileTypes: true });
      const entries = dirents
        .filter((dirent) => !dirent.name.startsWith("."))
        .map((dirent) => ({
          name: dirent.name,
          isDirectory: dirent.isDirectory(),
          path: join(dirPath, dirent.name)
        }))
        .sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) {
            return a.isDirectory ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });

      return { ok: true, entries };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to read directory."
      };
    }
  });

  ipcMain.handle("filesystem:read-file", async (_event, projectPath, filePath) => {
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

  ipcMain.handle("git:file-diff", async (_event, projectPath, filePath) => {
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

  ipcMain.handle("git:status", async (_event, projectPath) => {
    if (!projectPath || typeof projectPath !== "string") {
      return { ok: false, error: "Project path is required." };
    }

    return getGitStatusForProject(projectPath);
  });
}

const globalQuickKeyBindings = [
  { accelerator: "CommandOrControl+Alt+Shift+1", input: "1" },
  { accelerator: "CommandOrControl+Alt+Shift+2", input: "2" },
  { accelerator: "CommandOrControl+Alt+Shift+3", input: "3" },
  { accelerator: "CommandOrControl+Alt+Shift+4", input: "4" },
  { accelerator: "CommandOrControl+Alt+Shift+Up", input: "\x1b[A" },
  { accelerator: "CommandOrControl+Alt+Shift+Down", input: "\x1b[B" },
  { accelerator: "CommandOrControl+Alt+Shift+Left", input: "\x1b[D" },
  { accelerator: "CommandOrControl+Alt+Shift+Right", input: "\x1b[C" },
  { accelerator: "CommandOrControl+Alt+Shift+E", input: "\x1b" },
  { accelerator: "CommandOrControl+Alt+Shift+Enter", input: "\r" }
];

function registerGlobalQuickKeys() {
  for (const binding of globalQuickKeyBindings) {
    globalShortcut.register(binding.accelerator, () => {
      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send("global:quick-key", binding.input);
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
