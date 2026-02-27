import { ipcMain } from "electron";
import { resolve } from "node:path";
import { isPathInsideBase, toRelativePathInsideBase } from "./path-utils.mjs";

function removeGitHandlers(IPC_CHANNELS) {
  ipcMain.removeHandler(IPC_CHANNELS.gitStatus);
  ipcMain.removeHandler(IPC_CHANNELS.gitFileDiff);
  ipcMain.removeHandler(IPC_CHANNELS.gitRevertFile);
  ipcMain.removeHandler(IPC_CHANNELS.gitRevertAll);
  ipcMain.removeHandler(IPC_CHANNELS.gitLog);
  ipcMain.removeHandler(IPC_CHANNELS.gitCommitDetails);
}

function toProjectRelativeFilePath(projectPath, filePath, allowCurrentDirectory = false) {
  const resolvedProjectPath = resolve(projectPath);
  const resolvedFilePath = resolve(filePath);
  if (!isPathInsideBase(resolvedProjectPath, resolvedFilePath)) {
    return null;
  }

  const relativePath = toRelativePathInsideBase(resolvedProjectPath, resolvedFilePath, {
    allowCurrentDirectory
  });
  if (!relativePath) {
    return null;
  }

  return {
    resolvedProjectPath,
    resolvedFilePath,
    relativePath
  };
}

export function registerGitIpcHandlers({ IPC_CHANNELS, gitService }) {
  removeGitHandlers(IPC_CHANNELS);

  ipcMain.handle(IPC_CHANNELS.gitFileDiff, async (_event, projectPath, filePath) => {
    if (typeof projectPath !== "string" || typeof filePath !== "string") {
      return { ok: false, error: "Project path and file path are required." };
    }

    const relativeInfo = toProjectRelativeFilePath(projectPath, filePath);
    if (!relativeInfo) {
      return { ok: false, error: "Invalid file path." };
    }

    return gitService.getFileDiff(
      relativeInfo.resolvedProjectPath,
      relativeInfo.relativePath,
      relativeInfo.resolvedFilePath
    );
  });

  ipcMain.handle(IPC_CHANNELS.gitStatus, async (_event, projectPath) => {
    if (!projectPath || typeof projectPath !== "string") {
      return { ok: false, error: "Project path is required." };
    }

    return gitService.getStatusForProject(projectPath);
  });

  ipcMain.handle(IPC_CHANNELS.gitRevertFile, async (_event, projectPath, filePath) => {
    if (typeof projectPath !== "string" || typeof filePath !== "string") {
      return { ok: false, error: "Project path and file path are required." };
    }

    const relativeInfo = toProjectRelativeFilePath(projectPath, filePath);
    if (!relativeInfo) {
      return { ok: false, error: "Invalid file path." };
    }

    const repositoryState = await gitService.getRepositoryState(relativeInfo.resolvedProjectPath);
    if (!repositoryState.ok || !repositoryState.available) {
      return repositoryState;
    }

    return gitService.restorePath(relativeInfo.resolvedProjectPath, relativeInfo.relativePath);
  });

  ipcMain.handle(IPC_CHANNELS.gitRevertAll, async (_event, projectPath) => {
    if (typeof projectPath !== "string") {
      return { ok: false, error: "Project path is required." };
    }

    const resolvedProjectPath = resolve(projectPath);
    const repositoryState = await gitService.getRepositoryState(resolvedProjectPath);
    if (!repositoryState.ok || !repositoryState.available) {
      return repositoryState;
    }

    return gitService.restorePath(resolvedProjectPath, ".");
  });

  ipcMain.handle(IPC_CHANNELS.gitLog, async (_event, projectPath, maxCount) => {
    if (!projectPath || typeof projectPath !== "string") {
      return { ok: false, error: "Project path is required." };
    }

    return gitService.getLog(projectPath, maxCount);
  });

  ipcMain.handle(IPC_CHANNELS.gitCommitDetails, async (_event, projectPath, hash) => {
    if (!projectPath || typeof projectPath !== "string") {
      return { ok: false, error: "Project path is required." };
    }

    if (!hash || typeof hash !== "string" || !/^[0-9a-f]{4,40}$/i.test(hash)) {
      return { ok: false, error: "Invalid commit hash." };
    }

    return gitService.getCommitDetails(projectPath, hash);
  });
}
