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
  ipcMain.removeHandler(IPC_CHANNELS.gitCommitFileDiff);
  ipcMain.removeHandler(IPC_CHANNELS.gitCheckout);
  ipcMain.removeHandler(IPC_CHANNELS.gitUnmergedFiles);
  ipcMain.removeHandler(IPC_CHANNELS.gitCreateBranch);
  ipcMain.removeHandler(IPC_CHANNELS.gitDeleteBranch);
  ipcMain.removeHandler(IPC_CHANNELS.gitDeleteRemoteBranch);
  ipcMain.removeHandler(IPC_CHANNELS.gitMergeState);
  ipcMain.removeHandler(IPC_CHANNELS.gitResolveFile);
  ipcMain.removeHandler(IPC_CHANNELS.gitAcceptConflictVersion);
  ipcMain.removeHandler(IPC_CHANNELS.gitAbortMerge);
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

  ipcMain.handle(IPC_CHANNELS.gitCommitFileDiff, async (_event, projectPath, hash, filePath) => {
    if (!projectPath || typeof projectPath !== "string") {
      return { ok: false, error: "Project path is required." };
    }

    if (!hash || typeof hash !== "string" || !/^[0-9a-f]{4,40}$/i.test(hash)) {
      return { ok: false, error: "Invalid commit hash." };
    }

    if (!filePath || typeof filePath !== "string") {
      return { ok: false, error: "File path is required." };
    }

    return gitService.getCommitFileDiff(projectPath, hash, filePath);
  });

  ipcMain.handle(IPC_CHANNELS.gitCheckout, async (_event, projectPath, target, remote) => {
    if (!projectPath || typeof projectPath !== "string") {
      return { ok: false, error: "Project path is required." };
    }

    if (!target || typeof target !== "string" || target.startsWith("-")) {
      return { ok: false, error: "Invalid checkout target." };
    }

    if (remote !== undefined && (typeof remote !== "string" || remote.startsWith("-"))) {
      return { ok: false, error: "Invalid remote name." };
    }

    return gitService.checkout(projectPath, target, remote);
  });

  ipcMain.handle(IPC_CHANNELS.gitUnmergedFiles, async (_event, projectPath) => {
    if (!projectPath || typeof projectPath !== "string") {
      return [];
    }

    return gitService.getUnmergedFiles(projectPath);
  });

  ipcMain.handle(IPC_CHANNELS.gitCreateBranch, async (_event, projectPath, branchName, startPoint) => {
    if (!projectPath || typeof projectPath !== "string") {
      return { ok: false, error: "Project path is required." };
    }

    if (!branchName || typeof branchName !== "string" || branchName.startsWith("-")) {
      return { ok: false, error: "Invalid branch name." };
    }

    if (startPoint !== undefined && (typeof startPoint !== "string" || !/^[0-9a-f]{4,40}$/i.test(startPoint))) {
      return { ok: false, error: "Invalid start point." };
    }

    return gitService.createBranch(projectPath, branchName, startPoint);
  });

  ipcMain.handle(IPC_CHANNELS.gitDeleteBranch, async (_event, projectPath, branchName) => {
    if (!projectPath || typeof projectPath !== "string") {
      return { ok: false, error: "Project path is required." };
    }

    if (!branchName || typeof branchName !== "string" || branchName.startsWith("-")) {
      return { ok: false, error: "Invalid branch name." };
    }

    return gitService.deleteBranch(projectPath, branchName);
  });

  ipcMain.handle(IPC_CHANNELS.gitDeleteRemoteBranch, async (_event, projectPath, remoteName, branchName) => {
    if (!projectPath || typeof projectPath !== "string") {
      return { ok: false, error: "Project path is required." };
    }

    if (!remoteName || typeof remoteName !== "string" || remoteName.startsWith("-")) {
      return { ok: false, error: "Invalid remote name." };
    }

    if (!branchName || typeof branchName !== "string" || branchName.startsWith("-")) {
      return { ok: false, error: "Invalid branch name." };
    }

    return gitService.deleteRemoteBranch(projectPath, remoteName, branchName);
  });

  ipcMain.handle(IPC_CHANNELS.gitMergeState, async (_event, projectPath) => {
    if (!projectPath || typeof projectPath !== "string") {
      return { ok: true, state: "none" };
    }

    return gitService.getMergeState(projectPath);
  });

  ipcMain.handle(IPC_CHANNELS.gitResolveFile, async (_event, projectPath, filePath) => {
    if (typeof projectPath !== "string" || typeof filePath !== "string") {
      return { ok: false, error: "Project path and file path are required." };
    }

    const relativeInfo = toProjectRelativeFilePath(projectPath, filePath);
    if (!relativeInfo) {
      return { ok: false, error: "Invalid file path." };
    }

    return gitService.resolveConflictFile(relativeInfo.resolvedProjectPath, relativeInfo.relativePath);
  });

  ipcMain.handle(IPC_CHANNELS.gitAcceptConflictVersion, async (_event, projectPath, filePath, version) => {
    if (typeof projectPath !== "string" || typeof filePath !== "string") {
      return { ok: false, error: "Project path and file path are required." };
    }

    if (version !== "ours" && version !== "theirs") {
      return { ok: false, error: "Version must be 'ours' or 'theirs'." };
    }

    const relativeInfo = toProjectRelativeFilePath(projectPath, filePath);
    if (!relativeInfo) {
      return { ok: false, error: "Invalid file path." };
    }

    return gitService.acceptConflictVersion(relativeInfo.resolvedProjectPath, relativeInfo.relativePath, version);
  });

  ipcMain.handle(IPC_CHANNELS.gitAbortMerge, async (_event, projectPath) => {
    if (!projectPath || typeof projectPath !== "string") {
      return { ok: false, error: "Project path is required." };
    }

    return gitService.abortMerge(projectPath);
  });
}
