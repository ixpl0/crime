import { normalize, relative, resolve } from "node:path";

export function toPathKey(path) {
  const normalizedPath = normalize(resolve(path));
  return process.platform === "win32" ? normalizedPath.toLowerCase() : normalizedPath;
}

export function getFileEntrySortGroup(entry) {
  if (entry.isDirectory) {
    return entry.isIgnored === true ? 0 : 1;
  }

  return entry.isIgnored === true ? 2 : 3;
}

export function toGitRelativePath(basePath, targetPath) {
  const relativePath = relative(basePath, targetPath).split("\\").join("/");
  if (
    relativePath.length === 0 ||
    relativePath === "." ||
    relativePath === ".." ||
    relativePath.startsWith("../")
  ) {
    return null;
  }

  return relativePath;
}

export function toErrorMessage(error, fallbackMessage) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.length > 0) {
    return error;
  }

  return fallbackMessage;
}

export function isCommandNotFoundError(error) {
  return error && typeof error === "object" && "code" in error && error.code === "ENOENT";
}

export function isGitPathspecMissingError(stderr) {
  return /did not match any file\(s\) known to git/i.test(stderr);
}

export function isGitHeadResolutionError(stderr) {
  return /could not resolve head|ambiguous argument 'head'|unknown revision or path not in the working tree/i.test(stderr);
}

export function getGitCommandError(result, fallbackMessage) {
  const stderr = result.stderr.toString("utf-8").trim();
  return stderr.length > 0 ? stderr : fallbackMessage;
}
