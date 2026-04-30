import { ipcMain } from "electron";
import { existsSync, watch } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const GIT_WATCH_DEBOUNCE_MS = 300;
const WATCHER_RESTART_DELAY_MS = 1500;
const WATCHER_MAX_RESTARTS = 3;

const WATCHED_PATHS = new Set([
  "index",
  "HEAD",
  "ORIG_HEAD",
  "MERGE_HEAD",
  "CHERRY_PICK_HEAD",
  "REVERT_HEAD",
  "REBASE_HEAD",
  "SQUASH_MSG",
  "BISECT_LOG",
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

  // Track rebase state directories and sequencer.
  // Bare directory names (without "/") are emitted by non-recursive fs.watch
  // when the directory is created or removed — e.g. "rebase-merge".
  // Paths with "/" are emitted by recursive fs.watch for files inside — e.g. "rebase-merge/head-name".
  if (normalizedPath === "rebase-merge" || normalizedPath.startsWith("rebase-merge/") ||
      normalizedPath === "rebase-apply" || normalizedPath.startsWith("rebase-apply/") ||
      normalizedPath === "sequencer" || normalizedPath.startsWith("sequencer/")) {
    return true;
  }

  return normalizedPath.startsWith("refs/") || normalizedPath.startsWith("logs/refs/");
}

async function resolveGitDir(projectPath) {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "--absolute-git-dir"], {
      cwd: projectPath,
      encoding: "utf-8",
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
      windowsHide: true,
      timeout: 5000
    });
    const gitDir = stdout.trim();
    return gitDir.length > 0 ? gitDir : null;
  } catch {
    return null;
  }
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

  // Generation counter per webContentsId — guards against race conditions
  // when gitWatch is called twice in quick succession (e.g. rapid project switch).
  // After the async resolveGitDir, we verify the generation is still current
  // before creating the watcher, so a stale request becomes a no-op.
  const watchGeneration = new Map();

  ipcMain.handle(IPC_CHANNELS.gitWatch, async (event, projectPath) => {
    if (typeof projectPath !== "string") {
      return { ok: false, error: "Project path is required." };
    }

    const webContentsId = event.sender.id;
    const generation = (watchGeneration.get(webContentsId) ?? 0) + 1;
    watchGeneration.set(webContentsId, generation);
    stopGitWatcher(webContentsId);

    const gitDirPath = await resolveGitDir(projectPath);

    if (watchGeneration.get(webContentsId) !== generation || event.sender.isDestroyed()) {
      return { ok: true };
    }

    if (!gitDirPath || !existsSync(gitDirPath)) {
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
