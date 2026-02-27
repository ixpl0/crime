import { ipcMain } from "electron";
import * as pty from "node-pty";

function parseTerminalDimension(size, axis) {
  if (!size || typeof size !== "object") {
    return null;
  }

  const value = size[axis];
  if (Number.isInteger(value) && value > 0) {
    return value;
  }

  return null;
}

function parseTerminalCols(size) {
  return parseTerminalDimension(size, "cols");
}

function parseTerminalRows(size) {
  return parseTerminalDimension(size, "rows");
}

function removeTerminalHandlers(IPC_CHANNELS) {
  ipcMain.removeHandler(IPC_CHANNELS.terminalStart);
  ipcMain.removeHandler(IPC_CHANNELS.terminalInput);
  ipcMain.removeHandler(IPC_CHANNELS.terminalResize);
  ipcMain.removeHandler(IPC_CHANNELS.terminalStop);
}

export function registerTerminalIpcHandlers(options) {
  const {
    IPC_CHANNELS,
    terminalSessions,
    stopTerminalSession,
    resolveShell,
    buildChildProcessEnv,
    ideNodeModulesBinPath,
    isActiveSession,
    sendTerminalEvent
  } = options;
  removeTerminalHandlers(IPC_CHANNELS);

  ipcMain.handle(IPC_CHANNELS.terminalStart, async (event, cwd, size) => {
    if (!cwd || typeof cwd !== "string") {
      return { ok: false, error: "Project path is required." };
    }

    const webContentsId = event.sender.id;
    stopTerminalSession(webContentsId);

    const shell = resolveShell();
    const cols = parseTerminalCols(size) ?? 120;
    const rows = parseTerminalRows(size) ?? 30;
    let shellProcess;

    try {
      const env = buildChildProcessEnv(cwd, ideNodeModulesBinPath);
      shellProcess = pty.spawn(shell.command, shell.args, {
        name: "xterm-256color",
        cols,
        rows,
        cwd,
        env
      });
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to start terminal."
      };
    }

    terminalSessions.set(webContentsId, { process: shellProcess });
    shellProcess.onData((data) => {
      if (isActiveSession(webContentsId, shellProcess)) {
        sendTerminalEvent(event.sender, IPC_CHANNELS.terminalData, data);
      }
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
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to write input."
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.terminalResize, async (event, size) => {
    const session = terminalSessions.get(event.sender.id);
    if (!session) {
      return { ok: false, error: "Terminal session is not running." };
    }

    const cols = parseTerminalCols(size);
    const rows = parseTerminalRows(size);
    if (!cols || !rows) {
      return { ok: false, error: "Valid terminal size is required." };
    }

    try {
      session.process.resize(cols, rows);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to resize terminal."
      };
    }
  });

  ipcMain.handle(IPC_CHANNELS.terminalStop, async (event) => {
    stopTerminalSession(event.sender.id);
    return { ok: true };
  });
}
