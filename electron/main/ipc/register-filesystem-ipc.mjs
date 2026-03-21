import { ipcMain } from "electron";
import { access, cp, open, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { toIpcErrorResponse } from "../error-utils.mjs";
import { isPathInsideBase } from "./path-utils.mjs";

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

const BINARY_CHECK_SIZE = 8192;

async function isBinaryFile(filePath) {
  let fileHandle;
  try {
    fileHandle = await open(filePath, "r");
    const buffer = Buffer.alloc(BINARY_CHECK_SIZE);
    const { bytesRead } = await fileHandle.read(buffer, 0, BINARY_CHECK_SIZE, 0);
    for (let i = 0; i < bytesRead; i++) {
      if (buffer[i] === 0) {
        return true;
      }
    }
    return false;
  } finally {
    await fileHandle?.close();
  }
}

function removeFilesystemHandlers(IPC_CHANNELS) {
  ipcMain.removeHandler(IPC_CHANNELS.filesystemReadDirectory);
  ipcMain.removeHandler(IPC_CHANNELS.filesystemReadFile);
  ipcMain.removeHandler(IPC_CHANNELS.filesystemDeletePath);
  ipcMain.removeHandler(IPC_CHANNELS.filesystemWriteFile);
  ipcMain.removeHandler(IPC_CHANNELS.filesystemMovePath);
  ipcMain.removeHandler(IPC_CHANNELS.filesystemCopyPaths);
}

function withIgnoredState(entries, ignoredEntryPathKeySet, toPathKey) {
  return entries.map((entry) => ({
    ...entry,
    isIgnored: ignoredEntryPathKeySet.has(toPathKey(entry.path))
  }));
}

function sortEntries(entries, getFileEntrySortGroup) {
  return entries.sort((left, right) => {
    const groupDiff = getFileEntrySortGroup(left) - getFileEntrySortGroup(right);
    if (groupDiff !== 0) {
      return groupDiff;
    }

    return left.name.localeCompare(right.name);
  });
}

export function registerFilesystemIpcHandlers({ IPC_CHANNELS, gitService }) {
  removeFilesystemHandlers(IPC_CHANNELS);

  ipcMain.handle(IPC_CHANNELS.filesystemReadDirectory, async (_event, dirPath) => {
    if (!dirPath || typeof dirPath !== "string") {
      return { ok: false, error: "Directory path is required." };
    }

    try {
      const dirents = await readdir(dirPath, { withFileTypes: true });
      const entries = dirents.map((dirent) => ({
        name: dirent.name,
        isDirectory: dirent.isDirectory(),
        path: join(dirPath, dirent.name)
      }));
      const ignoredEntryPathKeySet = await gitService.getIgnoredEntryPathKeySet(dirPath, entries);
      const entriesWithIgnoredState = withIgnoredState(
        entries,
        ignoredEntryPathKeySet,
        gitService.toPathKey
      );
      return {
        ok: true,
        entries: sortEntries(entriesWithIgnoredState, gitService.getFileEntrySortGroup)
      };
    } catch (error) {
      return toIpcErrorResponse(error, "Failed to read directory.");
    }
  });

  ipcMain.handle(IPC_CHANNELS.filesystemReadFile, async (_event, projectPath, filePath) => {
    if (typeof projectPath !== "string" || typeof filePath !== "string") {
      return { ok: false, error: "Project path and file path are required." };
    }

    const resolvedFilePath = resolve(filePath);
    if (!isPathInsideBase(projectPath, resolvedFilePath)) {
      return { ok: false, error: "Invalid file path." };
    }

    try {
      if (await isBinaryFile(resolvedFilePath)) {
        return { ok: true, content: null, binary: true };
      }
      const content = await readFile(resolvedFilePath, "utf-8");
      return { ok: true, content };
    } catch (error) {
      return toIpcErrorResponse(error, "Failed to read file.");
    }
  });

  ipcMain.handle(IPC_CHANNELS.filesystemWriteFile, async (_event, projectPath, filePath, content) => {
    if (typeof projectPath !== "string" || typeof filePath !== "string" || typeof content !== "string") {
      return { ok: false, error: "Project path, file path, and content are required." };
    }

    const resolvedFilePath = resolve(filePath);
    if (!isPathInsideBase(projectPath, resolvedFilePath)) {
      return { ok: false, error: "Invalid file path." };
    }

    try {
      await writeFile(resolvedFilePath, content, "utf-8");
      return { ok: true };
    } catch (error) {
      return toIpcErrorResponse(error, "Failed to write file.");
    }
  });

  ipcMain.handle(IPC_CHANNELS.filesystemDeletePath, async (_event, projectPath, targetPath) => {
    if (typeof projectPath !== "string" || typeof targetPath !== "string") {
      return { ok: false, error: "Project path and target path are required." };
    }

    const resolvedTargetPath = resolve(targetPath);
    if (!isPathInsideBase(projectPath, resolvedTargetPath)) {
      return { ok: false, error: "Invalid target path." };
    }

    try {
      await rm(resolvedTargetPath, { recursive: true, force: true });
      return { ok: true };
    } catch (error) {
      return toIpcErrorResponse(error, "Failed to delete path.");
    }
  });

  ipcMain.handle(IPC_CHANNELS.filesystemMovePath, async (_event, projectPath, sourcePath, destinationDirectory) => {

    if (typeof projectPath !== "string" || typeof sourcePath !== "string" || typeof destinationDirectory !== "string") {
      return { ok: false, error: "Project path, source path, and destination directory are required." };
    }

    const resolvedSource = resolve(sourcePath);
    const resolvedDestDir = resolve(destinationDirectory);

    if (!isPathInsideBase(projectPath, resolvedSource)) {

      return { ok: false, error: "Source path is outside project." };
    }
    if (!isPathInsideBase(projectPath, resolvedDestDir)) {

      return { ok: false, error: "Destination is outside project." };
    }
    if (isPathInsideBase(resolvedSource, resolvedDestDir) && resolvedSource !== resolvedDestDir) {

      return { ok: false, error: "Cannot move a folder into itself." };
    }

    const fileName = basename(resolvedSource);
    const resolvedNewPath = join(resolvedDestDir, fileName);

    if (resolvedSource === resolvedNewPath) {
      return { ok: true };
    }

    if (await pathExists(resolvedNewPath)) {
      return { ok: false, error: `"${fileName}" already exists in the destination.` };
    }

    const repoState = await gitService.getRepositoryState(projectPath);
    if (repoState.ok && repoState.available) {
      const gitMvResponse = await gitService.runGitCommandSafe(
        projectPath, ["mv", resolvedSource, resolvedDestDir], "Failed to move path."
      );
      if (gitMvResponse.ok && gitMvResponse.result.code === 0) {
        return { ok: true };
      }
    }

    try {
      await rename(resolvedSource, resolvedNewPath);
      return { ok: true };
    } catch (error) {
      if (error.code === "EXDEV") {
        try {
          await cp(resolvedSource, resolvedNewPath, { recursive: true });
          await rm(resolvedSource, { recursive: true, force: true });
          return { ok: true };
        } catch (copyError) {
          return toIpcErrorResponse(copyError, "Failed to move path.");
        }
      }
      return toIpcErrorResponse(error, "Failed to move path.");
    }
  });

  ipcMain.handle(IPC_CHANNELS.filesystemCopyPaths, async (_event, projectPath, sourcePaths, destinationDirectory) => {

    if (typeof projectPath !== "string" || !Array.isArray(sourcePaths) || typeof destinationDirectory !== "string") {
      return { ok: false, error: "Invalid parameters." };
    }

    const resolvedDestDir = resolve(destinationDirectory);
    if (!isPathInsideBase(projectPath, resolvedDestDir)) {
      return { ok: false, error: "Destination is outside project." };
    }

    try {
      for (const sourcePath of sourcePaths) {
        if (typeof sourcePath !== "string") {
          continue;
        }
        const resolvedSource = resolve(sourcePath);
        const fileName = basename(resolvedSource);
        const resolvedNewPath = join(resolvedDestDir, fileName);

        if (await pathExists(resolvedNewPath)) {
          return { ok: false, error: `"${fileName}" already exists in the destination.` };
        }

        await cp(resolvedSource, resolvedNewPath, { recursive: true });
      }
      return { ok: true };
    } catch (error) {
      return toIpcErrorResponse(error, "Failed to copy files.");
    }
  });
}
