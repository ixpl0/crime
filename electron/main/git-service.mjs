import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  parseCommitFileStats,
  parseGitDiffLines,
  parseGitLogEntries,
  parseGitStatusPorcelain,
  toLineEntries
} from "./git-parsers.mjs";
import {
  getFileEntrySortGroup,
  getGitCommandError,
  isCommandNotFoundError,
  isGitHeadResolutionError,
  isGitPathspecMissingError,
  toErrorMessage,
  toGitRelativePath,
  toPathKey
} from "./git-utils.mjs";

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
    const formatFields = ["%H", "%P", "%an", "%ae", "%aI", "%s", "%D"].join(fieldSeparator);
    const format = `${formatFields}${recordSeparator}`;

    try {
      const result = await runCommand(
        "git",
        ["log", "--all", "--date-order", `--max-count=${String(limit)}`, `--format=${format}`],
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

  async function getCommitFileDiff(projectPath, hash, filePath) {
    const repositoryRoot = await getRepositoryRoot(resolve(projectPath));
    if (repositoryRoot === null) {
      return { ok: true, available: false, reason: "not-a-repository", lines: [] };
    }

    try {
      const diffResponse = await runDiffForPath(repositoryRoot, filePath, [`${hash}^..${hash}`]);
      if (!diffResponse.ok) {
        return diffResponse;
      }

      if (diffResponse.lines.length === 0) {
        // Possibly a newly added file in this commit — show full content as added lines
        const showResult = await runCommand(
          "git",
          ["-c", "core.quotepath=false", "show", `${hash}:${filePath}`],
          repositoryRoot
        );
        if (showResult.code === 0) {
          return {
            ok: true,
            available: true,
            lines: toLineEntries(showResult.stdout.toString("utf-8"), "added")
          };
        }
      }

      return { ok: true, available: true, lines: diffResponse.lines };
    } catch (error) {
      if (isCommandNotFoundError(error)) {
        return { ok: true, available: false, reason: "git-not-installed", lines: [] };
      }

      return { ok: false, error: toErrorMessage(error, "Failed to get commit file diff.") };
    }
  }

  async function getUnmergedFiles(projectPath) {
    try {
      const result = await runCommand("git", ["diff", "--name-only", "--diff-filter=U"], projectPath);
      if (result.code !== 0) {
        return [];
      }
      return result.stdout.toString("utf-8").trim().split("\n").filter(Boolean);
    } catch {
      return [];
    }
  }

  async function hasLocalChanges(projectPath) {
    try {
      const result = await runCommand("git", ["status", "--porcelain"], projectPath);
      return result.code === 0 && result.stdout.toString("utf-8").trim().length > 0;
    } catch {
      return false;
    }
  }

  async function checkout(projectPath, target, remote) {
    const repositoryState = await getRepositoryState(projectPath);
    if (!repositoryState.ok || !repositoryState.available) {
      return repositoryState;
    }

    const didStash = await hasLocalChanges(projectPath);
    if (didStash) {
      const stashResponse = await runGitCommandSafe(projectPath, ["stash", "push", "-u"], "Failed to stash changes.");
      if (!stashResponse.ok || !stashResponse.available || stashResponse.result.code !== 0) {
        const stderr = stashResponse.ok && stashResponse.available ? stashResponse.result.stderr.toString("utf-8").trim() : "";
        return { ok: false, error: stderr || "Failed to stash changes before checkout." };
      }
    }

    let response;
    if (remote) {
      // Check if local branch already exists
      const localExists = await runGitCommandSafe(
        projectPath,
        ["rev-parse", "--verify", `refs/heads/${target}`],
        "Failed to check branch."
      );
      const hasLocalBranch = localExists.ok && localExists.available && localExists.result.code === 0;

      if (hasLocalBranch) {
        response = await runGitCommandSafe(projectPath, ["checkout", target], "Failed to checkout.");
      } else {
        // Create a local tracking branch from the remote branch
        response = await runGitCommandSafe(
          projectPath,
          ["checkout", "-b", target, "--track", `${remote}/${target}`],
          "Failed to checkout."
        );
      }
    } else {
      response = await runGitCommandSafe(projectPath, ["checkout", target], "Failed to checkout.");
    }

    if (!response.ok || !response.available || response.result.code !== 0) {
      if (didStash) {
        const restoreResponse = await runGitCommandSafe(projectPath, ["stash", "pop"], "Failed to restore stash.");
        const restored = restoreResponse.ok && restoreResponse.available && restoreResponse.result.code === 0;
        if (!restored) {
          const stderr = response.ok && response.available ? response.result.stderr.toString("utf-8").trim() : "";
          return { ok: false, error: (stderr || "Failed to checkout.") + " Your changes are saved in git stash." };
        }
      }
      const stderr = response.ok && response.available ? response.result.stderr.toString("utf-8").trim() : "";
      return { ok: false, error: stderr || "Failed to checkout." };
    }

    if (didStash) {
      const popResponse = await runGitCommandSafe(projectPath, ["stash", "pop"], "Failed to restore stashed changes.");
      if (!popResponse.ok || !popResponse.available || popResponse.result.code !== 0) {
        const conflictFiles = await getUnmergedFiles(projectPath);
        return { ok: true, available: true, stashConflict: true, conflictFiles };
      }
    }

    return { ok: true, available: true };
  }

  async function createBranch(projectPath, branchName, startPoint) {
    const repositoryState = await getRepositoryState(projectPath);
    if (!repositoryState.ok || !repositoryState.available) {
      return repositoryState;
    }

    const args = ["branch", "--", branchName];
    if (startPoint) {
      args.push(startPoint);
    }

    const response = await runGitCommandSafe(projectPath, args, "Failed to create branch.");
    if (!response.ok || !response.available) {
      return response;
    }

    if (response.result.code !== 0) {
      const stderr = response.result.stderr.toString("utf-8").trim();
      return { ok: false, error: stderr || "Failed to create branch." };
    }

    return { ok: true, available: true };
  }

  async function getCurrentBranch(projectPath) {
    try {
      const result = await runCommand("git", ["symbolic-ref", "--short", "HEAD"], projectPath);
      if (result.code !== 0) {
        return null;
      }
      const branch = result.stdout.toString("utf-8").trim();
      return branch.length > 0 ? branch : null;
    } catch {
      return null;
    }
  }

  async function deleteBranch(projectPath, branchName) {
    const repositoryState = await getRepositoryState(projectPath);
    if (!repositoryState.ok || !repositoryState.available) {
      return repositoryState;
    }

    const currentBranch = await getCurrentBranch(projectPath);
    if (currentBranch === branchName) {
      const detachResponse = await runGitCommandSafe(
        projectPath,
        ["checkout", "--detach"],
        "Failed to detach HEAD."
      );
      if (!detachResponse.ok || !detachResponse.available) {
        return detachResponse;
      }
      if (detachResponse.result.code !== 0) {
        const stderr = detachResponse.result.stderr.toString("utf-8").trim();
        return { ok: false, error: stderr || "Failed to detach HEAD." };
      }
    }

    const deleteResponse = await runGitCommandSafe(
      projectPath,
      ["branch", "-d", "--", branchName],
      "Failed to delete branch."
    );

    if (!deleteResponse.ok || !deleteResponse.available || deleteResponse.result.code !== 0) {
      if (currentBranch === branchName) {
        await runGitCommandSafe(projectPath, ["checkout", branchName], "Failed to restore branch.");
      }
      const stderr = deleteResponse.ok && deleteResponse.available
        ? deleteResponse.result.stderr.toString("utf-8").trim()
        : "";
      return { ok: false, error: stderr || "Failed to delete branch." };
    }

    return { ok: true, available: true };
  }

  async function deleteRemoteBranch(projectPath, remoteName, branchName) {
    const repositoryState = await getRepositoryState(projectPath);
    if (!repositoryState.ok || !repositoryState.available) {
      return repositoryState;
    }

    const deleteResponse = await runGitCommandSafe(
      projectPath,
      ["push", remoteName, "--delete", "--", branchName],
      "Failed to delete remote branch."
    );
    if (!deleteResponse.ok || !deleteResponse.available) {
      return deleteResponse;
    }

    if (deleteResponse.result.code !== 0) {
      const stderr = deleteResponse.result.stderr.toString("utf-8").trim();
      return { ok: false, error: stderr || "Failed to delete remote branch." };
    }

    return { ok: true, available: true };
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
    getCommitDetails,
    getCommitFileDiff,
    checkout,
    getUnmergedFiles,
    createBranch,
    deleteBranch,
    deleteRemoteBranch,
    runGitCommandSafe
  };
}
