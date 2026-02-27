import { clipboard, ipcMain } from "electron";

function removeClipboardHandlers(IPC_CHANNELS) {
  ipcMain.removeHandler(IPC_CHANNELS.clipboardWriteText);
}

export function registerClipboardIpcHandlers({ IPC_CHANNELS }) {
  removeClipboardHandlers(IPC_CHANNELS);

  ipcMain.handle(IPC_CHANNELS.clipboardWriteText, async (_event, text) => {
    if (typeof text !== "string") {
      return { ok: false, error: "Clipboard text must be a string." };
    }

    try {
      clipboard.writeText(text);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to write clipboard text."
      };
    }
  });
}
