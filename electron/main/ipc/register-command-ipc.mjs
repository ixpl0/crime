import { ipcMain } from "electron";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { toIpcErrorResponse } from "../error-utils.mjs";

const MAX_OUTPUT_BYTES = 64 * 1024;

function removeCommandHandlers(IPC_CHANNELS) {
  ipcMain.removeHandler(IPC_CHANNELS.commandRunSilent);
}

function decodeBufferWithLimit(buffer) {
  if (buffer.length <= MAX_OUTPUT_BYTES) {
    return buffer.toString("utf-8");
  }

  const truncated = buffer.subarray(buffer.length - MAX_OUTPUT_BYTES);
  return `…(truncated)…\n${truncated.toString("utf-8")}`;
}

export function registerCommandIpcHandlers({ IPC_CHANNELS, runShellCommand }) {
  removeCommandHandlers(IPC_CHANNELS);

  ipcMain.handle(IPC_CHANNELS.commandRunSilent, async (_event, commandLine, cwd) => {
    if (typeof commandLine !== "string" || commandLine.trim().length === 0) {
      return { ok: false, error: "Command line must be a non-empty string." };
    }

    if (typeof cwd !== "string" || cwd.length === 0) {
      return { ok: false, error: "Working directory is required." };
    }

    const resolvedCwd = resolve(cwd);
    if (!existsSync(resolvedCwd) || !statSync(resolvedCwd).isDirectory()) {
      return { ok: false, error: "Working directory does not exist." };
    }

    try {
      const result = await runShellCommand(commandLine, resolvedCwd);
      return {
        ok: true,
        code: result.code,
        stdout: decodeBufferWithLimit(result.stdout),
        stderr: decodeBufferWithLimit(result.stderr)
      };
    } catch (error) {
      return toIpcErrorResponse(error, "Failed to run command.");
    }
  });
}
