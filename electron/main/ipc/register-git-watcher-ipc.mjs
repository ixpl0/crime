import { ipcMain } from "electron";
import { existsSync, watch } from "node:fs";
import { join } from "node:path";

const GIT_WATCH_DEBOUNCE_MS = 300;

const WATCHED_FILENAMES = new Set([
  "index",
  "HEAD",
  "MERGE_HEAD",
  "COMMIT_EDITMSG",
  "FETCH_HEAD",
  "refs"
]);

function isRelevantGitChange(filename) {
  if (!filename) {
    return true;
  }

  return WATCHED_FILENAMES.has(filename);
}

function removeGitWatcherHandlers(IPC_CHANNELS) {
  ipcMain.removeHandler(IPC_CHANNELS.gitWatch);
  ipcMain.removeHandler(IPC_CHANNELS.gitUnwatch);
}

export function registerGitWatcherIpcHandlers({
  IPC_CHANNELS,
  gitWatchers,
  stopGitWatcher,
  toIpcFailure
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

    let debounceTimer = null;

    try {
      const fsWatcher = watch(gitDirPath, (_eventType, changedFile) => {
        const filename = typeof changedFile === "string"
          ? changedFile
          : (Buffer.isBuffer(changedFile) ? changedFile.toString("utf-8") : null);

        if (!isRelevantGitChange(filename)) {
          return;
        }

        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }

        debounceTimer = setTimeout(() => {
          debounceTimer = null;
          if (!event.sender.isDestroyed()) {
            event.sender.send(IPC_CHANNELS.gitChanged);
          }
        }, GIT_WATCH_DEBOUNCE_MS);
      });

      fsWatcher.on("error", (error) => {
        stopGitWatcher(webContentsId);
        console.error("Git watcher failed:", error);
      });

      gitWatchers.set(webContentsId, fsWatcher);
      return { ok: true };
    } catch (error) {
      return toIpcFailure(error, "Failed to start git watcher.");
    }
  });

  ipcMain.handle(IPC_CHANNELS.gitUnwatch, (event) => {
    stopGitWatcher(event.sender.id);
    return { ok: true };
  });
}
