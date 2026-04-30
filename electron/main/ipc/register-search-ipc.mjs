import { ipcMain } from "electron";
import { readdir, readFile, open } from "node:fs/promises";
import { basename, join } from "node:path";
import { toIpcErrorResponse } from "../error-utils.mjs";
import { GIT_READ_ONLY_COMMAND_OPTIONS } from "../git-utils.mjs";

const DEFAULT_MAX_RESULTS = 50;
const BINARY_CHECK_SIZE = 8192;
const MAX_FILES_TO_WALK = 50000;
const MAX_LINE_DISPLAY_LENGTH = 300;

const SKIP_DIRECTORIES = new Set([
  ".git", "node_modules", ".next", ".nuxt", "dist", "__pycache__",
  ".cache", ".turbo", ".output", ".svelte-kit", "coverage",
  ".angular", ".expo", "build"
]);

async function isBinaryFile(filePath) {
  let fileHandle;
  try {
    fileHandle = await open(filePath, "r");
    const buffer = Buffer.alloc(BINARY_CHECK_SIZE);
    const { bytesRead } = await fileHandle.read(buffer, 0, BINARY_CHECK_SIZE, 0);
    for (let index = 0; index < bytesRead; index++) {
      if (buffer[index] === 0) {
        return true;
      }
    }
    return false;
  } catch {
    return true;
  } finally {
    await fileHandle?.close();
  }
}

async function collectFilePathsViaGit(projectPath, runCommand, includeIgnored) {
  const args = includeIgnored
    ? ["ls-files", "--cached", "--others"]
    : ["ls-files", "--cached", "--others", "--exclude-standard"];

  const result = await runCommand("git", args, projectPath, GIT_READ_ONLY_COMMAND_OPTIONS);
  if (result.code !== 0) {
    return null;
  }

  const stdout = result.stdout.toString("utf-8").trim();
  if (stdout.length === 0) {
    return [];
  }

  return stdout.split("\n").filter((line) => line.length > 0);
}

async function collectFilePathsManually(rootPath, includeIgnored) {
  const relativePaths = [];
  let fileCount = 0;

  const shouldSkipDirectory = (name) => {
    if (includeIgnored) {
      return false;
    }

    return SKIP_DIRECTORIES.has(name);
  };

  const walk = async (directory, prefix) => {
    if (fileCount >= MAX_FILES_TO_WALK) {
      return;
    }

    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (fileCount >= MAX_FILES_TO_WALK) {
        return;
      }

      if (entry.isDirectory() && shouldSkipDirectory(entry.name)) {
        continue;
      }

      const relativePath = prefix.length > 0
        ? `${prefix}/${entry.name}`
        : entry.name;

      relativePaths.push({ relativePath, isDirectory: entry.isDirectory() });
      fileCount += 1;

      // Never recurse into .git internals even when including ignored
      if (entry.isDirectory() && entry.name !== ".git") {
        await walk(join(directory, entry.name), relativePath);
      }
    }
  };

  await walk(rootPath, "");
  return relativePaths;
}

function extractDirectoriesFromPaths(relativePaths) {
  const directorySet = new Set();
  for (const filePath of relativePaths) {
    const parts = filePath.split("/");
    for (let depth = 1; depth < parts.length; depth++) {
      directorySet.add(parts.slice(0, depth).join("/"));
    }
  }
  return [...directorySet];
}

function scoreFileMatch(relativePath, name, queryLower) {
  const nameLower = name.toLowerCase();
  const pathLower = relativePath.toLowerCase();

  if (nameLower === queryLower) {
    return 0;
  }
  if (nameLower.startsWith(queryLower)) {
    return 1;
  }
  if (nameLower.includes(queryLower)) {
    return 2;
  }
  if (pathLower.includes(queryLower)) {
    return 3;
  }
  return -1;
}

function searchFileNames(entries, query, maxResults) {
  const queryLower = query.toLowerCase();
  const scored = [];

  for (const entry of entries) {
    const score = scoreFileMatch(entry.relativePath, entry.name, queryLower);
    if (score >= 0) {
      scored.push({ ...entry, score });
    }
  }

  scored.sort((left, right) => {
    const scoreDiff = left.score - right.score;
    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    const lengthDiff = left.relativePath.length - right.relativePath.length;
    if (lengthDiff !== 0) {
      return lengthDiff;
    }

    return left.relativePath.localeCompare(right.relativePath);
  });

  return scored.slice(0, maxResults).map(({ relativePath, name, isDirectory }) => ({
    relativePath,
    name,
    isDirectory
  }));
}

function parseGitGrepOutput(stdout, maxResults) {
  const lines = stdout.split("\n");
  const results = [];

  for (const line of lines) {
    if (results.length >= maxResults) {
      break;
    }

    if (line.length === 0) {
      continue;
    }

    const firstColon = line.indexOf(":");
    if (firstColon < 0) {
      continue;
    }

    const secondColon = line.indexOf(":", firstColon + 1);
    if (secondColon < 0) {
      continue;
    }

    const filePath = line.substring(0, firstColon);
    const lineNumber = parseInt(line.substring(firstColon + 1, secondColon), 10);
    const text = line.substring(secondColon + 1);

    if (Number.isNaN(lineNumber)) {
      continue;
    }

    const trimmedText = text.length > MAX_LINE_DISPLAY_LENGTH
      ? text.substring(0, MAX_LINE_DISPLAY_LENGTH)
      : text;

    results.push({
      relativePath: filePath,
      line: lineNumber,
      text: trimmedText
    });
  }

  return results;
}

async function searchContentViaGit(projectPath, query, maxResults, runCommand) {
  const result = await runCommand(
    "git",
    ["grep", "-F", "-n", "--no-color", "-I", "-i", "--", query],
    projectPath,
    GIT_READ_ONLY_COMMAND_OPTIONS
  );

  if (result.code !== 0 && result.code !== 1) {
    return null;
  }

  const stdout = result.stdout.toString("utf-8");
  return parseGitGrepOutput(stdout, maxResults);
}

async function searchContentManually(rootPath, query, maxResults, includeIgnored) {
  const queryLower = query.toLowerCase();
  const results = [];

  const shouldSkipDirectory = (name) => {
    if (name === ".git") {
      return true;
    }

    if (includeIgnored) {
      return false;
    }

    return SKIP_DIRECTORIES.has(name);
  };

  const walk = async (directory) => {
    if (results.length >= maxResults) {
      return;
    }

    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= maxResults) {
        return;
      }

      const fullPath = join(directory, entry.name);

      if (entry.isDirectory()) {
        if (!shouldSkipDirectory(entry.name)) {
          await walk(fullPath);
        }
        continue;
      }

      if (await isBinaryFile(fullPath)) {
        continue;
      }

      let content;
      try {
        content = await readFile(fullPath, "utf-8");
      } catch {
        continue;
      }

      const lines = content.split("\n");
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        if (results.length >= maxResults) {
          break;
        }

        if (lines[lineIndex].toLowerCase().includes(queryLower)) {
          const relativePath = fullPath
            .substring(rootPath.length)
            .replace(/\\/g, "/")
            .replace(/^\//, "");

          const trimmedText = lines[lineIndex].length > MAX_LINE_DISPLAY_LENGTH
            ? lines[lineIndex].substring(0, MAX_LINE_DISPLAY_LENGTH)
            : lines[lineIndex];

          results.push({
            relativePath,
            line: lineIndex + 1,
            text: trimmedText
          });
        }
      }
    }
  };

  await walk(rootPath);
  return results;
}

function removeSearchHandlers(IPC_CHANNELS) {
  ipcMain.removeHandler(IPC_CHANNELS.filesystemSearch);
  ipcMain.removeHandler(IPC_CHANNELS.filesystemSearchContent);
}

export function registerSearchIpcHandlers({ IPC_CHANNELS, runCommand }) {
  removeSearchHandlers(IPC_CHANNELS);

  ipcMain.handle(
    IPC_CHANNELS.filesystemSearch,
    async (_event, projectPath, query, maxResults, includeIgnored) => {
      if (typeof projectPath !== "string" || typeof query !== "string") {
        return { ok: false, error: "Project path and query are required." };
      }

      if (query.trim().length === 0) {
        return { ok: true, results: [] };
      }

      const limit = typeof maxResults === "number" && maxResults > 0
        ? maxResults
        : DEFAULT_MAX_RESULTS;
      const shouldIncludeIgnored = includeIgnored === true;

      try {
        const gitPaths = await collectFilePathsViaGit(
          projectPath, runCommand, shouldIncludeIgnored
        );

        let allEntries;
        if (gitPaths !== null) {
          const fileEntries = gitPaths.map((relativePath) => ({
            relativePath,
            name: basename(relativePath),
            isDirectory: false
          }));

          const directoryPaths = extractDirectoriesFromPaths(gitPaths);
          const directoryEntries = directoryPaths.map((relativePath) => ({
            relativePath,
            name: basename(relativePath),
            isDirectory: true
          }));

          allEntries = [...fileEntries, ...directoryEntries];

          // .git is never in git ls-files output — add it manually
          if (shouldIncludeIgnored) {
            allEntries = [
              ...allEntries,
              { relativePath: ".git", name: ".git", isDirectory: true }
            ];
          }
        } else {
          const manualPaths = await collectFilePathsManually(
            projectPath, shouldIncludeIgnored
          );
          allEntries = manualPaths.map(({ relativePath, isDirectory }) => ({
            relativePath,
            name: basename(relativePath),
            isDirectory
          }));
        }

        const results = searchFileNames(allEntries, query, limit);
        return { ok: true, results };
      } catch (error) {
        return toIpcErrorResponse(error, "Failed to search files.");
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.filesystemSearchContent,
    async (_event, projectPath, query, maxResults, includeIgnored) => {
      if (typeof projectPath !== "string" || typeof query !== "string") {
        return { ok: false, error: "Project path and query are required." };
      }

      if (query.trim().length === 0) {
        return { ok: true, results: [] };
      }

      const limit = typeof maxResults === "number" && maxResults > 0
        ? maxResults
        : DEFAULT_MAX_RESULTS;
      const shouldIncludeIgnored = includeIgnored === true;

      try {
        // git grep only searches tracked files; use manual for includeIgnored
        if (!shouldIncludeIgnored) {
          const gitResults = await searchContentViaGit(
            projectPath, query, limit, runCommand
          );

          if (gitResults !== null) {
            return { ok: true, results: gitResults };
          }
        }

        const manualResults = await searchContentManually(
          projectPath, query, limit, shouldIncludeIgnored
        );
        return { ok: true, results: manualResults };
      } catch (error) {
        return toIpcErrorResponse(error, "Failed to search file contents.");
      }
    }
  );
}
