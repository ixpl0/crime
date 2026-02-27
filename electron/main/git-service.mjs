import { readFile } from "node:fs/promises";
import { normalize, relative, resolve } from "node:path";

const GIT_STATUS_PRIORITY = {
  modified: 1,
  added: 2,
  deleted: 3
};

function toErrorMessage(error, fallbackMessage) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.length > 0) {
    return error;
  }

  return fallbackMessage;
}

function isCommandNotFoundError(error) {
  return error && typeof error === "object" && "code" in error && error.code === "ENOENT";
}

function getGitStatusKind(x, y) {
  if (x === "D" || y === "D") {
    return "deleted";
  }

  if (x === "A" || y === "A" || x === "?" || y === "?") {
    return "added";
  }

  return "modified";
}

function upsertGitStatus(statusByPath, absolutePath, nextStatus) {
  const currentStatus = statusByPath.get(absolutePath);
  if (!currentStatus) {
    statusByPath.set(absolutePath, nextStatus);
    return;
  }

  if (GIT_STATUS_PRIORITY[nextStatus] > GIT_STATUS_PRIORITY[currentStatus]) {
    statusByPath.set(absolutePath, nextStatus);
  }
}

function parseGitStatusPorcelain(output, cwd) {
  const statusByPath = new Map();
  const records = output.split("\0");

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record || record.length < 4 || record[2] !== " ") {
      continue;
    }

    const x = record[0];
    const y = record[1];
    const firstPath = record.slice(3);
    const isRenameOrCopy = x === "R" || x === "C" || y === "R" || y === "C";

    if (isRenameOrCopy) {
      const secondPath = records[index + 1];
      index += 1;

      if (firstPath) {
        upsertGitStatus(statusByPath, resolve(cwd, firstPath), "modified");
      }

      if (typeof secondPath === "string" && secondPath.length > 0) {
        upsertGitStatus(statusByPath, resolve(cwd, secondPath), "modified");
      }
      continue;
    }

    if (!firstPath) {
      continue;
    }

    upsertGitStatus(statusByPath, resolve(cwd, firstPath), getGitStatusKind(x, y));
  }

  return Array.from(statusByPath.entries()).map(([path, status]) => ({ path, status }));
}

function parseGitDiffLines(diffOutput) {
  const lines = [];
  const rawLines = diffOutput.split(/\r?\n/);
  let isInHunk = false;

  for (const rawLine of rawLines) {
    if (rawLine.startsWith("diff --git ")) {
      isInHunk = false;
      continue;
    }

    if (rawLine.startsWith("@@")) {
      isInHunk = true;
      continue;
    }

    if (!isInHunk || rawLine.startsWith("\\ No newline at end of file")) {
      continue;
    }

    if (rawLine.startsWith("+")) {
      lines.push({ type: "added", text: rawLine.slice(1) });
      continue;
    }

    if (rawLine.startsWith("-")) {
      lines.push({ type: "removed", text: rawLine.slice(1) });
      continue;
    }

    if (rawLine.startsWith(" ")) {
      lines.push({ type: "context", text: rawLine.slice(1) });
    }
  }

  return lines;
}

function toLineEntries(content, type = "context") {
  const rawLines = content.split(/\r?\n/);
  if (rawLines.length > 0 && rawLines[rawLines.length - 1] === "") {
    rawLines.pop();
  }

  return rawLines.map((text) => ({ type, text }));
}

function toPathKey(path) {
  const normalizedPath = normalize(resolve(path));
  return process.platform === "win32" ? normalizedPath.toLowerCase() : normalizedPath;
}

function getFileEntrySortGroup(entry) {
  if (entry.isDirectory) {
    return entry.isIgnored === true ? 0 : 1;
  }

  return entry.isIgnored === true ? 2 : 3;
}

function toGitRelativePath(basePath, targetPath) {
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

function isGitPathspecMissingError(stderr) {
  return /did not match any file\(s\) known to git/i.test(stderr);
}

function isGitHeadResolutionError(stderr) {
  return /could not resolve head|ambiguous argument 'head'|unknown revision or path not in the working tree/i.test(stderr);
}

function getGitCommandError(result, fallbackMessage) {
  const stderr = result.stderr.toString("utf-8").trim();
  return stderr.length > 0 ? stderr : fallbackMessage;
}

function parseGitLogEntries(rawOutput, recordSeparator, fieldSeparator) {
  const records = rawOutput
    .split(recordSeparator)
    .filter((record) => record.trim().length > 0);
  const entries = [];

  for (const record of records) {
    const fields = record.trim().split(fieldSeparator);
    if (fields.length < 6) {
      continue;
    }

    const refs = fields[5].length > 0
      ? fields[5].split(",").map((ref) => ref.trim()).filter((ref) => ref.length > 0)
      : [];
    entries.push({
      hash: fields[0],
      parentHashes: fields[1].length > 0 ? fields[1].split(" ") : [],
      author: fields[2],
      date: fields[3],
      subject: fields[4],
      refs
    });
  }

  return entries;
}

function parseCommitFileStats(statsOutput) {
  const files = [];
  const trimmed = statsOutput.trim();
  if (trimmed.length === 0) {
    return files;
  }

  for (const line of trimmed.split("\n")) {
    const parts = line.split("\t");
    if (parts.length < 3) {
      continue;
    }

    const additions = parts[0] === "-" ? 0 : parseInt(parts[0], 10);
    const deletions = parts[1] === "-" ? 0 : parseInt(parts[1], 10);
    const path = parts.slice(2).join("\t");
    files.push({ path, additions, deletions });
  }

  return files;
}

export function createGitService(runCommand) {
  async function getRepositoryRoot(path) {
    try {
      const result = await runCommand("git", ["rev-parse", "--show-toplevel"], path);
      if (result.code !== 0) {
        return null;
      }

      const repositoryRoot = result.stdout.toString("utf-8").trim();
      return repositoryRoot.length > 0 ? repositoryRoot : null;
    } catch {
      return null;
    }
  }

  async function getIgnoredEntryPathKeySet(dirPath, entries) {
    if (!Array.isArray(entries) || entries.length === 0) {
      return new Set();
    }

    const repositoryRoot = await getRepositoryRoot(dirPath);
    if (!repositoryRoot) {
      return new Set();
    }

    const relativeEntryPaths = [];
    for (const entry of entries) {
      const relativeEntryPath = toGitRelativePath(repositoryRoot, entry.path);
      if (relativeEntryPath) {
        relativeEntryPaths.push(relativeEntryPath);
      }
    }

    if (relativeEntryPaths.length === 0) {
      return new Set();
    }

    try {
      const checkIgnoreResult = await runCommand(
        "git",
        ["-c", "core.quotepath=false", "check-ignore", "--", ...relativeEntryPaths],
        repositoryRoot
      );
      if (checkIgnoreResult.code !== 0 && checkIgnoreResult.code !== 1) {
        return new Set();
      }

      if (checkIgnoreResult.stdout.length === 0) {
        return new Set();
      }

      const ignoredPaths = checkIgnoreResult.stdout
        .toString("utf-8")
        .split(/\r?\n/)
        .filter((value) => value.length > 0);
      const ignoredPathKeySet = new Set();
      for (const ignoredPath of ignoredPaths) {
        ignoredPathKeySet.add(toPathKey(resolve(repositoryRoot, ignoredPath)));
      }

      return ignoredPathKeySet;
    } catch {
      return new Set();
    }
  }

  async function getRepositoryState(projectPath) {
    try {
      const revParseResult = await runCommand(
        "git",
        ["rev-parse", "--is-inside-work-tree"],
        projectPath
      );
      const isInsideWorkTree = revParseResult.stdout.toString("utf-8").trim() === "true";
      if (revParseResult.code !== 0 || !isInsideWorkTree) {
        return { ok: true, available: false, reason: "not-a-repository" };
      }
      return { ok: true, available: true };
    } catch (error) {
      if (isCommandNotFoundError(error)) {
        return { ok: true, available: false, reason: "git-not-installed" };
      }

      return {
        ok: false,
        error: toErrorMessage(error, "Failed to check git availability.")
      };
    }
  }

  async function getStatusForPath(projectPath, relativePath) {
    try {
      const statusResult = await runCommand(
        "git",
        ["-c", "core.quotepath=false", "status", "--porcelain=v1", "-z", "--", relativePath],
        projectPath
      );
      if (statusResult.code !== 0) {
        const stderr = statusResult.stderr.toString("utf-8").trim();
        return {
          ok: false,
          error: stderr.length > 0 ? stderr : "Failed to read file git status."
        };
      }

      const entries = parseGitStatusPorcelain(statusResult.stdout.toString("utf-8"), projectPath);
      const filePathKey = toPathKey(resolve(projectPath, relativePath));
      const match = entries.find((entry) => toPathKey(entry.path) === filePathKey);
      return { ok: true, available: true, status: match?.status ?? null };
    } catch (error) {
      if (isCommandNotFoundError(error)) {
        return { ok: true, available: false, reason: "git-not-installed", status: null };
      }

      return {
        ok: false,
        error: toErrorMessage(error, "Failed to read file git status.")
      };
    }
  }

  async function getStatusForProject(projectPath) {
    const repositoryState = await getRepositoryState(projectPath);
    if (!repositoryState.ok) {
      return repositoryState;
    }

    if (!repositoryState.available) {
      return { ...repositoryState, entries: [] };
    }

    try {
      const statusResult = await runCommand(
        "git",
        [
          "-c",
          "core.quotepath=false",
          "status",
          "--porcelain=v1",
          "-z",
          "--untracked-files=all",
          "--",
          "."
        ],
        projectPath
      );
      if (statusResult.code !== 0) {
        const stderr = statusResult.stderr.toString("utf-8").trim();
        return { ok: false, error: stderr.length > 0 ? stderr : "Failed to read git status." };
      }

      return {
        ok: true,
        available: true,
        entries: parseGitStatusPorcelain(statusResult.stdout.toString("utf-8"), projectPath)
      };
    } catch (error) {
      if (isCommandNotFoundError(error)) {
        return { ok: true, available: false, reason: "git-not-installed", entries: [] };
      }

      return {
        ok: false,
        error: toErrorMessage(error, "Failed to read git status.")
      };
    }
  }

  async function runGitCommandSafe(projectPath, args, fallbackMessage) {
    try {
      const result = await runCommand("git", args, projectPath);
      return { ok: true, available: true, result };
    } catch (error) {
      if (isCommandNotFoundError(error)) {
        return { ok: true, available: false, reason: "git-not-installed" };
      }

      return { ok: false, error: toErrorMessage(error, fallbackMessage) };
    }
  }

  async function restorePath(projectPath, pathspec) {
    const restoreResponse = await runGitCommandSafe(
      projectPath,
      ["restore", "--source=HEAD", "--staged", "--worktree", "--", pathspec],
      "Failed to revert git changes."
    );
    if (!restoreResponse.ok || !restoreResponse.available) {
      return restoreResponse;
    }

    const restoreResult = restoreResponse.result;
    if (restoreResult.code !== 0) {
      const restoreError = getGitCommandError(restoreResult, "Failed to revert git changes.");
      const shouldTryRmCached = isGitHeadResolutionError(restoreError);
      const canContinueAfterRestoreFailure =
        shouldTryRmCached || isGitPathspecMissingError(restoreError);
      if (!canContinueAfterRestoreFailure) {
        return { ok: false, error: restoreError };
      }

      if (shouldTryRmCached) {
        const rmCachedResponse = await runGitCommandSafe(
          projectPath,
          ["rm", "-rf", "--cached", "--", pathspec],
          "Failed to revert git index changes."
        );
        if (!rmCachedResponse.ok || !rmCachedResponse.available) {
          return rmCachedResponse;
        }

        if (rmCachedResponse.result.code !== 0) {
          const rmCachedError = getGitCommandError(
            rmCachedResponse.result,
            "Failed to revert git index changes."
          );
          if (!isGitPathspecMissingError(rmCachedError)) {
            return { ok: false, error: rmCachedError };
          }
        }
      }
    }

    const cleanResponse = await runGitCommandSafe(
      projectPath,
      ["clean", "-fd", "--", pathspec],
      "Failed to clean untracked files."
    );
    if (!cleanResponse.ok || !cleanResponse.available) {
      return cleanResponse;
    }

    if (cleanResponse.result.code !== 0) {
      return {
        ok: false,
        error: getGitCommandError(cleanResponse.result, "Failed to clean untracked files.")
      };
    }

    return { ok: true, available: true };
  }

  async function runDiffForPath(projectPath, relativePath, extraArgs = []) {
    const diffResult = await runCommand(
      "git",
      [
        "-c",
        "core.quotepath=false",
        "diff",
        "--no-color",
        "--unified=999999",
        "--no-ext-diff",
        ...extraArgs,
        "--",
        relativePath
      ],
      projectPath
    );
    if (diffResult.code !== 0) {
      const stderr = diffResult.stderr.toString("utf-8").trim();
      return { ok: false, error: stderr.length > 0 ? stderr : "Failed to get file diff." };
    }

    return { ok: true, lines: parseGitDiffLines(diffResult.stdout.toString("utf-8")) };
  }

  async function getFileDiff(projectPath, relativePath, resolvedFilePath) {
    const repositoryState = await getRepositoryState(projectPath);
    if (!repositoryState.ok) {
      return repositoryState;
    }

    if (!repositoryState.available) {
      return { ...repositoryState, lines: [], status: null };
    }

    const fileStatusResponse = await getStatusForPath(projectPath, relativePath);
    if (!fileStatusResponse.ok) {
      return fileStatusResponse;
    }

    let diffLines;
    try {
      const initialDiffResponse = await runDiffForPath(projectPath, relativePath);
      if (!initialDiffResponse.ok) {
        return initialDiffResponse;
      }

      diffLines = initialDiffResponse.lines;
      if (diffLines.length === 0 && fileStatusResponse.status === "modified") {
        const cachedDiffResponse = await runDiffForPath(projectPath, relativePath, ["--cached"]);
        if (!cachedDiffResponse.ok) {
          return cachedDiffResponse;
        }
        diffLines = cachedDiffResponse.lines;
      }
    } catch (error) {
      return { ok: false, error: toErrorMessage(error, "Failed to get file diff.") };
    }

    if (diffLines.length === 0 && fileStatusResponse.status === "added") {
      try {
        const content = await readFile(resolvedFilePath, "utf-8");
        diffLines = toLineEntries(content, "added");
      } catch {
        diffLines = [];
      }
    }

    if (diffLines.length === 0 && fileStatusResponse.status === "deleted") {
      try {
        const showResult = await runCommand(
          "git",
          ["-c", "core.quotepath=false", "show", `HEAD:${relativePath}`],
          projectPath
        );
        if (showResult.code === 0) {
          diffLines = toLineEntries(showResult.stdout.toString("utf-8"), "removed");
        }
      } catch {
        diffLines = [];
      }
    }

    return {
      ok: true,
      available: true,
      status: fileStatusResponse.status ?? null,
      lines: diffLines
    };
  }

  async function getLog(projectPath, maxCount) {
    const repositoryRoot = await getRepositoryRoot(resolve(projectPath));
    if (repositoryRoot === null) {
      return { ok: true, available: false, reason: "not-a-repository", entries: [] };
    }

    const limit = typeof maxCount === "number" && maxCount > 0 ? maxCount : 200;
    const fieldSeparator = "\x1f";
    const recordSeparator = "\x1e";
    const formatFields = ["%H", "%P", "%an", "%aI", "%s", "%D"].join(fieldSeparator);
    const format = `${formatFields}${recordSeparator}`;

    try {
      const result = await runCommand(
        "git",
        ["log", "--all", "--topo-order", `--max-count=${String(limit)}`, `--format=${format}`],
        repositoryRoot
      );
      if (result.code !== 0) {
        const stderr = result.stderr.toString("utf-8").trim();
        if (stderr.includes("does not have any commits")) {
          return { ok: true, available: true, entries: [] };
        }

        return { ok: false, error: stderr || "git log failed." };
      }

      const raw = result.stdout.toString("utf-8");
      const entries = parseGitLogEntries(raw, recordSeparator, fieldSeparator);
      return { ok: true, available: true, entries };
    } catch (error) {
      if (isCommandNotFoundError(error)) {
        return { ok: true, available: false, reason: "git-not-installed", entries: [] };
      }

      return { ok: false, error: toErrorMessage(error, "Failed to run git log.") };
    }
  }

  async function getCommitDetails(projectPath, hash) {
    const repositoryRoot = await getRepositoryRoot(resolve(projectPath));
    if (repositoryRoot === null) {
      return { ok: true, available: false, reason: "not-a-repository" };
    }

    const fieldSeparator = "\x1f";
    const formatFields = [
      "%H",
      "%P",
      "%an",
      "%ae",
      "%aI",
      "%cn",
      "%ce",
      "%cI",
      "%D",
      "%s"
    ].join(fieldSeparator);
    const bodyMarker = "\x1eBODY\x1e";
    const format = `${formatFields}${bodyMarker}%b${bodyMarker}`;

    let metaResult;
    try {
      metaResult = await runCommand(
        "git",
        ["log", "-1", `--format=${format}`, hash],
        repositoryRoot
      );
    } catch (error) {
      if (isCommandNotFoundError(error)) {
        return { ok: true, available: false, reason: "git-not-installed" };
      }
      return { ok: false, error: toErrorMessage(error, "Failed to get commit details.") };
    }

    if (metaResult.code !== 0) {
      const stderr = metaResult.stderr.toString("utf-8").trim();
      return { ok: false, error: stderr || "git log failed." };
    }

    const metaRaw = metaResult.stdout.toString("utf-8");
    const bodyStart = metaRaw.indexOf(bodyMarker);
    const bodyEnd = metaRaw.lastIndexOf(bodyMarker);
    if (bodyStart === -1 || bodyEnd === -1 || bodyStart === bodyEnd) {
      return { ok: false, error: "Failed to parse commit details." };
    }

    const fields = metaRaw.slice(0, bodyStart).split(fieldSeparator);
    if (fields.length < 10) {
      return { ok: false, error: "Unexpected commit format." };
    }

    const body = metaRaw.slice(bodyStart + bodyMarker.length, bodyEnd).trim();
    const refs = fields[8].length > 0
      ? fields[8].split(",").map((ref) => ref.trim()).filter((ref) => ref.length > 0)
      : [];

    let files = [];
    try {
      const statsResult = await runCommand(
        "git",
        ["diff-tree", "--no-commit-id", "-r", "--numstat", hash],
        repositoryRoot
      );
      if (statsResult.code === 0) {
        files = parseCommitFileStats(statsResult.stdout.toString("utf-8"));
      }
    } catch {
      files = [];
    }

    return {
      ok: true,
      available: true,
      details: {
        hash: fields[0],
        parentHashes: fields[1].length > 0 ? fields[1].split(" ") : [],
        authorName: fields[2],
        authorEmail: fields[3],
        authorDate: fields[4],
        committerName: fields[5],
        committerEmail: fields[6],
        committerDate: fields[7],
        subject: fields[9],
        body,
        refs,
        files
      }
    };
  }

  return {
    toPathKey,
    getIgnoredEntryPathKeySet,
    getFileEntrySortGroup,
    getRepositoryState,
    getStatusForProject,
    getFileDiff,
    restorePath,
    getLog,
    getCommitDetails
  };
}
