import { ipcMain, shell } from "electron";
import { toIpcErrorResponse } from "../error-utils.mjs";

function removeShellHandlers(IPC_CHANNELS) {
  ipcMain.removeHandler(IPC_CHANNELS.shellOpenExternal);
  ipcMain.removeHandler(IPC_CHANNELS.shellOpenPath);
}

export function registerShellIpcHandlers({ IPC_CHANNELS }) {
  removeShellHandlers(IPC_CHANNELS);

  ipcMain.handle(IPC_CHANNELS.shellOpenPath, (_event, filePath) => {
    if (typeof filePath !== "string") {
      return { ok: false, error: "Path must be a string." };
    }

    shell.showItemInFolder(filePath);
    return { ok: true };
  });

  ipcMain.handle(IPC_CHANNELS.shellOpenExternal, async (_event, url) => {
    if (typeof url !== "string") {
      return { ok: false, error: "URL must be a string." };
    }

    const isAllowedProtocol = url.startsWith("https://") || url.startsWith("http://");
    if (!isAllowedProtocol) {
      return { ok: false, error: "Only HTTP and HTTPS URLs are allowed." };
    }

    try {
      await shell.openExternal(url);
      return { ok: true };
    } catch (error) {
      return toIpcErrorResponse(error, "Failed to open external URL.");
    }
  });
}
