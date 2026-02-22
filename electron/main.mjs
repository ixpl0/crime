import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, normalize } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import * as pty from "node-pty";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const terminalSessions = new Map();

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

function createWindow() {
  const mainWindow = new BrowserWindow({
    title: "Dream IDE",
    width: 1280,
    height: 800,
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  const webContentsId = mainWindow.webContents.id;

  mainWindow.on("closed", () => {
    stopTerminalSession(webContentsId);
  });

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
  ipcMain.removeHandler("terminal:start");
  ipcMain.removeHandler("terminal:run-command");
  ipcMain.removeHandler("terminal:input");
  ipcMain.removeHandler("terminal:resize");
  ipcMain.removeHandler("terminal:stop");

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
      session.process.write(`${command}\r`);
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
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
