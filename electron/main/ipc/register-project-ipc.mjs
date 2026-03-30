import { BrowserWindow, dialog, ipcMain } from "electron";

function removeProjectHandlers(IPC_CHANNELS) {
  ipcMain.removeHandler(IPC_CHANNELS.projectOpenFolder);
  ipcMain.removeHandler(IPC_CHANNELS.projectOpenInNewWindow);
}

export function registerProjectIpcHandlers({ IPC_CHANNELS, createWindow }) {
  removeProjectHandlers(IPC_CHANNELS);

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

  ipcMain.handle(IPC_CHANNELS.projectOpenInNewWindow, (_event, projectPath) => {
    if (projectPath) {
      createWindow({ openProjectPath: projectPath });
    } else {
      createWindow({ skipLastProjectRestore: true });
    }
  });
}
