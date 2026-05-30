import { ipcMain } from "electron";
import { readdir } from "node:fs/promises";
import { toIpcErrorResponse } from "../error-utils.mjs";

function removeFilesystemHandlers(IPC_CHANNELS) {
  ipcMain.removeHandler(IPC_CHANNELS.filesystemReadDirectory);
}

export function registerFilesystemIpcHandlers({ IPC_CHANNELS }) {
  removeFilesystemHandlers(IPC_CHANNELS);

  // Used to verify a project folder is readable (recent-projects validation,
  // last-project restore). The directory contents themselves are not needed.
  ipcMain.handle(IPC_CHANNELS.filesystemReadDirectory, async (_event, dirPath) => {
    if (!dirPath || typeof dirPath !== "string") {
      return { ok: false, error: "Directory path is required." };
    }

    try {
      await readdir(dirPath);
      return { ok: true };
    } catch (error) {
      return toIpcErrorResponse(error, "Failed to read directory.");
    }
  });
}
