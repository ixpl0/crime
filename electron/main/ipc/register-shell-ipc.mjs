import { ipcMain, shell } from "electron";
import { toIpcErrorResponse } from "../error-utils.mjs";

function removeShellHandlers(IPC_CHANNELS) {
  ipcMain.removeHandler(IPC_CHANNELS.shellOpenExternal);
}

export function registerShellIpcHandlers({ IPC_CHANNELS }) {
  removeShellHandlers(IPC_CHANNELS);

  ipcMain.handle(IPC_CHANNELS.shellOpenExternal, async (_event, url) => {
    if (typeof url !== "string") {
      return { ok: false, error: "URL must be a string." };
    }

    try {
      await shell.openExternal(url);
      return { ok: true };
    } catch (error) {
      return toIpcErrorResponse(error, "Failed to open external URL.");
    }
  });
}
