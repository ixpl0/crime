import { ipcMain } from "electron";
import { watch } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isPathInsideBase } from "./path-utils.mjs";

const SETTINGS_WATCH_DEBOUNCE_MS = 300;

function getSettingsDirPath(projectPath, settingsDirName) {
  return join(projectPath, settingsDirName);
}

function removeSettingsHandlers(IPC_CHANNELS) {
  ipcMain.removeHandler(IPC_CHANNELS.settingsRead);
  ipcMain.removeHandler(IPC_CHANNELS.settingsWrite);
  ipcMain.removeHandler(IPC_CHANNELS.settingsWatch);
  ipcMain.removeHandler(IPC_CHANNELS.settingsUnwatch);
}

function toChangedFilename(changedFile) {
  if (typeof changedFile === "string") {
    return changedFile;
  }

  if (Buffer.isBuffer(changedFile)) {
    return changedFile.toString("utf-8");
  }

  return null;
}

function enqueueSettingsChangeNotification(options) {
  const {
    changedFilename,
    debounceState,
    eventSender,
    filename,
    isWatchAllFiles,
    IPC_CHANNELS
  } = options;
  const { pendingFilenames } = debounceState;
  if (!isWatchAllFiles) {
    if (changedFilename && changedFilename !== filename) {
      return;
    }

    pendingFilenames.add(changedFilename ?? filename);
  } else {
    pendingFilenames.add(changedFilename ?? "*");
  }

  if (debounceState.timer) {
    clearTimeout(debounceState.timer);
  }

  debounceState.timer = setTimeout(() => {
    const changedNames = pendingFilenames.has("*") ? ["*"] : Array.from(pendingFilenames);
    pendingFilenames.clear();
    debounceState.timer = null;
    if (eventSender.isDestroyed()) {
      return;
    }

    for (const changedName of changedNames) {
      eventSender.send(IPC_CHANNELS.settingsFileChanged, changedName);
    }
  }, SETTINGS_WATCH_DEBOUNCE_MS);
}

async function readSettingsFile(projectPath, filename, settingsDirName) {
  if (typeof projectPath !== "string" || typeof filename !== "string") {
    return { ok: false, error: "Project path and filename are required." };
  }

  const settingsDir = getSettingsDirPath(projectPath, settingsDirName);
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
}

async function writeSettingsFile(projectPath, filename, content, settingsDirName) {
  if (typeof projectPath !== "string" || typeof filename !== "string" || typeof content !== "string") {
    return { ok: false, error: "Project path, filename and content are required." };
  }

  const settingsDir = getSettingsDirPath(projectPath, settingsDirName);
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
}

function registerSettingsWatcher({
  IPC_CHANNELS,
  settingsDirName,
  settingsWatchers,
  stopSettingsWatcher,
  toErrorMessage,
  toIpcFailure,
  isFailFast
}) {
  ipcMain.handle(IPC_CHANNELS.settingsWatch, async (event, projectPath, filename) => {
    if (typeof projectPath !== "string" || typeof filename !== "string") {
      return { ok: false, error: "Project path and filename are required." };
    }

    const dirPath = getSettingsDirPath(projectPath, settingsDirName);
    const isWatchAllFiles = filename === "*";
    if (!isWatchAllFiles) {
      const filePath = join(dirPath, filename);
      if (!isPathInsideBase(dirPath, filePath)) {
        return { ok: false, error: "Invalid filename." };
      }
    }

    const webContentsId = event.sender.id;
    stopSettingsWatcher(webContentsId);

    try {
      await mkdir(dirPath, { recursive: true });
    } catch (error) {
      return toIpcFailure(error, "Failed to create settings directory for watcher.");
    }

    const debounceState = {
      timer: null,
      pendingFilenames: new Set()
    };

    try {
      const fsWatcher = watch(dirPath, (_eventType, changedFile) => {
        enqueueSettingsChangeNotification({
          changedFilename: toChangedFilename(changedFile),
          debounceState,
          eventSender: event.sender,
          filename,
          isWatchAllFiles,
          IPC_CHANNELS
        });
      });
      fsWatcher.on("error", (error) => {
        stopSettingsWatcher(webContentsId);
        const message = toErrorMessage(error, "Settings watcher failed.");
        console.error(message, error);
        if (isFailFast) {
          throw new Error(message);
        }
      });

      settingsWatchers.set(webContentsId, fsWatcher);
      return { ok: true };
    } catch (error) {
      return toIpcFailure(error, "Failed to start settings watcher.");
    }
  });
}

export function registerSettingsIpcHandlers(options) {
  const { IPC_CHANNELS, settingsDirName, stopSettingsWatcher } = options;
  removeSettingsHandlers(IPC_CHANNELS);

  ipcMain.handle(IPC_CHANNELS.settingsRead, async (_event, projectPath, filename) =>
    readSettingsFile(projectPath, filename, settingsDirName)
  );
  ipcMain.handle(IPC_CHANNELS.settingsWrite, async (_event, projectPath, filename, content) =>
    writeSettingsFile(projectPath, filename, content, settingsDirName)
  );
  registerSettingsWatcher(options);
  ipcMain.handle(IPC_CHANNELS.settingsUnwatch, (event) => {
    stopSettingsWatcher(event.sender.id);
    return { ok: true };
  });
}
