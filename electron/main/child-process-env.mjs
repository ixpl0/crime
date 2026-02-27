import { dirname, delimiter, join, normalize, resolve } from "node:path";
import { existsSync } from "node:fs";

function stripWrappingQuotes(value) {
  if (value.length >= 2 && value.startsWith("\"") && value.endsWith("\"")) {
    return value.slice(1, -1);
  }
  return value;
}

function normalizePathEntry(value) {
  const sanitized = normalize(stripWrappingQuotes(value));
  return process.platform === "win32" ? sanitized.toLowerCase() : sanitized;
}

function getPathKey(env) {
  const keys = Object.keys(env).filter((key) => key.toLowerCase() === "path");
  if (keys.length === 0) {
    return "PATH";
  }

  const preferred = keys.find((key) => key === "Path");
  return preferred ?? keys[0];
}

function collectWorkspaceNodeBinPaths(cwd) {
  const collected = [];
  let currentPath = resolve(cwd);

  while (true) {
    const nodeBinPath = join(currentPath, "node_modules", ".bin");
    if (existsSync(nodeBinPath)) {
      collected.push(nodeBinPath);
    }

    const parentPath = dirname(currentPath);
    if (parentPath === currentPath) {
      break;
    }

    currentPath = parentPath;
  }

  return collected;
}

function getBasePathEntries(pathValue) {
  if (typeof pathValue !== "string" || pathValue.length === 0) {
    return [];
  }

  return pathValue.split(delimiter).filter((entry) => entry.length > 0);
}

function buildPathEntries(basePathEntries, workspaceNodeBinPaths, blockedPathEntry) {
  const orderedPathEntries = [...workspaceNodeBinPaths, ...basePathEntries];
  const seen = new Set();
  const nextPathEntries = [];

  for (const entry of orderedPathEntries) {
    const normalizedEntry = normalizePathEntry(entry);
    if (normalizedEntry === blockedPathEntry || seen.has(normalizedEntry)) {
      continue;
    }

    seen.add(normalizedEntry);
    nextPathEntries.push(entry);
  }

  return nextPathEntries;
}

function syncPathAliases(env, pathKey) {
  if (pathKey !== "PATH" && !Object.prototype.hasOwnProperty.call(env, "PATH")) {
    env.PATH = env[pathKey];
  }

  const needsWindowsPathAlias =
    pathKey !== "Path" &&
    process.platform === "win32" &&
    !Object.prototype.hasOwnProperty.call(env, "Path");
  if (needsWindowsPathAlias) {
    env.Path = env[pathKey];
  }
}

export function buildChildProcessEnv(cwd, ideNodeModulesBinPath) {
  const env = { ...process.env };
  const pathKey = getPathKey(env);
  const basePathEntries = getBasePathEntries(env[pathKey]);
  const blockedPathEntry = normalizePathEntry(ideNodeModulesBinPath);
  const workspaceNodeBinPaths = collectWorkspaceNodeBinPaths(cwd);
  const nextPathEntries = buildPathEntries(
    basePathEntries,
    workspaceNodeBinPaths,
    blockedPathEntry
  );

  env[pathKey] = nextPathEntries.join(delimiter);
  syncPathAliases(env, pathKey);
  return env;
}
