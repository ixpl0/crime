import { ipcMain } from "electron";
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { toIpcErrorResponse } from "../error-utils.mjs";
import { isPathInsideBase } from "./path-utils.mjs";

function removeFilesystemHandlers(IPC_CHANNELS) {
  ipcMain.removeHandler(IPC_CHANNELS.filesystemReadDirectory);
  ipcMain.removeHandler(IPC_CHANNELS.filesystemReadFile);
  ipcMain.removeHandler(IPC_CHANNELS.filesystemDeletePath);
  ipcMain.removeHandler(IPC_CHANNELS.filesystemWriteFile);
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
}
