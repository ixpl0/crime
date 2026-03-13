import { ipcMain } from "electron";
import { existsSync, watch } from "node:fs";
import { join } from "node:path";

const GIT_WATCH_DEBOUNCE_MS = 300;
const WATCHER_RESTART_DELAY_MS = 1500;
const WATCHER_MAX_RESTARTS = 3;

const WATCHED_PATHS = new Set([
  "index",
  "HEAD",
  "ORIG_HEAD",
  "MERGE_HEAD",
  "COMMIT_EDITMSG",
  "packed-refs",
  "logs/HEAD"
]);

function isRelevantGitChange(filename) {
  if (!filename) {
    return true;
  }

  const normalizedPath = filename.replaceAll("\\", "/");
  if (WATCHED_PATHS.has(normalizedPath)) {
    return true;
  }

  return normalizedPath.startsWith("refs/") || normalizedPath.startsWith("logs/refs/");
}

function isRecursiveWatchUnsupportedError(error) {
  if (!error || typeof error !== "object") {
    return false;
  }

  return "code" in error && error.code === "ERR_FEATURE_UNAVAILABLE_ON_PLATFORM";
}

function createFsWatcher(gitDirPath, listener) {
  try {
    return watch(gitDirPath, { recursive: true }, listener);
  } catch (error) {
    if (isRecursiveWatchUnsupportedError(error)) {
      return watch(gitDirPath, listener);
    }

    throw error;
  }
}

function removeGitWatcherHandlers(IPC_CHANNELS) {
  ipcMain.removeHandler(IPC_CHANNELS.gitWatch);
  ipcMain.removeHandler(IPC_CHANNELS.gitUnwatch);
}

function createGitWatcher(gitDirPath, webContents, sendChanged) {
  let debounceTimer = null;
  let restartTimer = null;
  let restartCount = 0;
  let currentWatcher = null;

  function clearTimers() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
  }

  function scheduleRestart() {
    if (restartCount >= WATCHER_MAX_RESTARTS || webContents.isDestroyed()) {
      return;
    }

    restartCount += 1;
    restartTimer = setTimeout(() => {
      restartTimer = null;
      if (!webContents.isDestroyed() && existsSync(gitDirPath)) {
        startWatching();
      }
    }, WATCHER_RESTART_DELAY_MS);
  }

  function handleWatchEvent(_eventType, changedFile) {
    const filename = typeof changedFile === "string"
      ? changedFile
      : (Buffer.isBuffer(changedFile) ? changedFile.toString("utf-8") : null);

    if (!isRelevantGitChange(filename)) {
      return;
    }

    restartCount = 0;

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      sendChanged();
    }, GIT_WATCH_DEBOUNCE_MS);
  }

  function startWatching() {
    try {
      const watcher = createFsWatcher(gitDirPath, handleWatchEvent);
      currentWatcher = watcher;

      watcher.on("error", (error) => {
        console.error("Git watcher failed:", error);
        watcher.close();

        if (currentWatcher === watcher) {
          currentWatcher = null;
          if (debounceTimer) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
          }
          scheduleRestart();
        }
      });
    } catch (error) {
      console.error("Git watcher creation failed:", error);
      currentWatcher = null;
      scheduleRestart();
    }
  }

  startWatching();

  return {
    close() {
      clearTimers();
      if (currentWatcher) {
        currentWatcher.close();
        currentWatcher = null;
      }
    }
  };
}

export function registerGitWatcherIpcHandlers({
  IPC_CHANNELS,
  gitWatchers,
  stopGitWatcher
}) {
  removeGitWatcherHandlers(IPC_CHANNELS);

  ipcMain.handle(IPC_CHANNELS.gitWatch, (event, projectPath) => {
    if (typeof projectPath !== "string") {
      return { ok: false, error: "Project path is required." };
    }

    const gitDirPath = join(projectPath, ".git");
    const webContentsId = event.sender.id;
    stopGitWatcher(webContentsId);

    if (!existsSync(gitDirPath)) {
      return { ok: true };
    }

    const sendChanged = () => {
      if (!event.sender.isDestroyed()) {
        event.sender.send(IPC_CHANNELS.gitChanged);
      }
    };

    const handle = createGitWatcher(gitDirPath, event.sender, sendChanged);
    gitWatchers.set(webContentsId, handle);
    return { ok: true };
  });

  ipcMain.handle(IPC_CHANNELS.gitUnwatch, (event) => {
    stopGitWatcher(event.sender.id);
    return { ok: true };
  });
}
