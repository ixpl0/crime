import { access, readFile, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";

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

  async function getGitDir(path) {
    try {
      const result = await runCommand("git", ["rev-parse", "--absolute-git-dir"], path);
      if (result.code !== 0) {
        return null;
      }

      const gitDir = result.stdout.toString("utf-8").trim();
      return gitDir.length > 0 ? gitDir : null;
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
      const [statusResult, branch, mergeState] = await Promise.all([
        runCommand(
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
        ),
        getCurrentBranch(projectPath),
        getMergeState(projectPath)
      ]);
      if (statusResult.code !== 0) {
        const stderr = statusResult.stderr.toString("utf-8").trim();
        return { ok: false, error: stderr.length > 0 ? stderr : "Failed to read git status." };
      }

      return {
        ok: true,
        available: true,
        branch,
        mergeState: mergeState.state,
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

  async function getRemoteNames(repositoryRoot) {
    try {
      const result = await runCommand("git", ["remote"], repositoryRoot);
      if (result.code !== 0) {
        return [];
      }
      return result.stdout
        .toString("utf-8")
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    } catch {
      return [];
    }
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
      const [result, remotes] = await Promise.all([
        runCommand(
          "git",
          ["log", "--all", "--date-order", `--max-count=${String(limit)}`, `--format=${format}`],
          repositoryRoot
        ),
        getRemoteNames(repositoryRoot)
      ]);
      if (result.code !== 0) {
        const stderr = result.stderr.toString("utf-8").trim();
        if (stderr.includes("does not have any commits")) {
          return { ok: true, available: true, entries: [], remotes };
        }

        return { ok: false, error: stderr || "git log failed." };
      }

      const raw = result.stdout.toString("utf-8");
      const entries = parseGitLogEntries(raw, recordSeparator, fieldSeparator);
      return { ok: true, available: true, entries, remotes };
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

  async function getMergeState(projectPath) {
    // Use --absolute-git-dir instead of hardcoding ".git" to support
    // worktrees (where .git is a file) and submodules
    const gitDir = await getGitDir(resolve(projectPath));
    if (!gitDir) {
      return { ok: true, state: "none" };
    }
    // Check order matches git's own wt_status_get_state() priority (wt-status.c):
    // 1. MERGE_HEAD  2. rebase dirs  3. REBASE_HEAD (fallback)
    // 4. CHERRY_PICK_HEAD  5. REVERT_HEAD  6. sequencer/todo (multi cherry-pick/revert)
    const checks = [
      { file: "MERGE_HEAD", state: "merge" },
      { file: "rebase-merge", state: "rebase", verifyFile: "head-name" },
      { file: "rebase-apply", state: "am", verifyFile: "applying" },
      { file: "rebase-apply", state: "rebase", verifyFile: "next" },
      { file: "REBASE_HEAD", state: "rebase" },
      { file: "CHERRY_PICK_HEAD", state: "cherry-pick" },
      { file: "REVERT_HEAD", state: "revert" }
    ];

    for (const check of checks) {
      try {
        await access(join(gitDir, check.file));
        // For directories (rebase-merge, rebase-apply), verify a key file exists
        // inside to avoid false positives from stale/empty directories
        if (check.verifyFile) {
          await access(join(gitDir, check.file, check.verifyFile));
        }
        return { ok: true, state: check.state };
      } catch {
        // file doesn't exist or directory is stale, continue checking
      }
    }

    // Multi cherry-pick/revert: CHERRY_PICK_HEAD/REVERT_HEAD is absent between
    // commits, but sequencer/todo tracks remaining operations (sequencer.c)
    try {
      const todoPath = join(gitDir, "sequencer", "todo");
      const todoContent = await readFile(todoPath, "utf-8");
      const firstLine = todoContent.trim().split("\n")[0] ?? "";
      if (firstLine.startsWith("pick")) {
        return { ok: true, state: "cherry-pick" };
      }
      if (firstLine.startsWith("revert")) {
        return { ok: true, state: "revert" };
      }
    } catch {
      // no sequencer directory or todo file
    }

    // Squash merge: no MERGE_HEAD but SQUASH_MSG indicates pending squash commit
    try {
      await access(join(gitDir, "SQUASH_MSG"));
      return { ok: true, state: "squash-merge" };
    } catch {
      // no squash merge
    }

    // Bisect session: BISECT_LOG tracks bisect progress
    try {
      await access(join(gitDir, "BISECT_LOG"));
      return { ok: true, state: "bisect" };
    } catch {
      // no bisect
    }

    return { ok: true, state: "none" };
  }

  async function resolveConflictFile(projectPath, relativePath) {
    const response = await runGitCommandSafe(
      projectPath,
      ["add", "--", relativePath],
      "Failed to mark file as resolved."
    );
    if (!response.ok || !response.available) {
      return response;
    }

    if (response.result.code !== 0) {
      return {
        ok: false,
        error: getGitCommandError(response.result, "Failed to mark file as resolved.")
      };
    }

    return { ok: true, available: true };
  }

  async function acceptConflictVersion(projectPath, relativePath, version) {
    const flag = version === "ours" ? "--ours" : "--theirs";
    const checkoutResponse = await runGitCommandSafe(
      projectPath,
      ["checkout", flag, "--", relativePath],
      `Failed to accept ${version} version.`
    );
    if (!checkoutResponse.ok || !checkoutResponse.available) {
      return checkoutResponse;
    }

    if (checkoutResponse.result.code !== 0) {
      return {
        ok: false,
        error: getGitCommandError(checkoutResponse.result, `Failed to accept ${version} version.`)
      };
    }

    return resolveConflictFile(projectPath, relativePath);
  }

  // Stale state files that git may leave behind after abort or when an operation
  // ends abnormally. Keyed by detected state; values are files to remove from gitDir.
  const STALE_STATE_FILES = {
    merge: ["MERGE_HEAD", "MERGE_MSG", "MERGE_MODE"],
    "squash-merge": ["SQUASH_MSG"],
    rebase: ["REBASE_HEAD"],
    "cherry-pick": ["CHERRY_PICK_HEAD"],
    revert: ["REVERT_HEAD"]
  };

  async function cleanupStaleStateFiles(projectPath, state) {
    const files = STALE_STATE_FILES[state];
    if (!files || files.length === 0) {
      return;
    }

    const gitDir = await getGitDir(resolve(projectPath));
    if (!gitDir) {
      return;
    }

    await Promise.all(
      files.map((file) => unlink(join(gitDir, file)).catch(() => { /* already removed */ }))
    );
  }

  async function abortMerge(projectPath) {
    const mergeState = await getMergeState(projectPath);
    if (!mergeState.ok) {
      return { ok: false, error: "Не удалось определить состояние операции." };
    }
    // If no operation is detected, treat as already resolved
    // (covers race condition: rebase finished between UI render and abort click)
    if (mergeState.state === "none") {
      return { ok: true, available: true };
    }

    const abortCommands = {
      merge: ["merge", "--abort"],
      "squash-merge": ["reset", "--merge"],
      rebase: ["rebase", "--abort"],
      "cherry-pick": ["cherry-pick", "--abort"],
      revert: ["revert", "--abort"],
      am: ["am", "--abort"],
      bisect: ["bisect", "reset"]
    };
    const command = abortCommands[mergeState.state] ?? ["merge", "--abort"];

    const response = await runGitCommandSafe(projectPath, command, "Не удалось отменить операцию.");
    if (!response.ok || !response.available) {
      return response;
    }

    if (response.result.code !== 0) {
      const stderr = getGitCommandError(response.result, "Не удалось отменить операцию.");
      const lower = stderr.toLowerCase();
      // If git says the operation is not in progress, treat as successful abort
      // (handles race conditions and stale .git state)
      // Error messages verified against git source:
      //   builtin/rebase.c:  "No rebase in progress?"
      //   builtin/merge.c:   "There is no merge to abort (MERGE_HEAD missing)."
      //   sequencer.c:       "no cherry-pick or revert in progress"
      //   builtin/am.c:      "There is no am session in progress"
      //   builtin/bisect.c:  "We are not bisecting."
      const isAlreadyAborted = lower.includes("no rebase in progress") ||
        lower.includes("no merge to abort") ||
        lower.includes("no cherry-pick or revert in progress") ||
        lower.includes("no am session in progress") ||
        lower.includes("we are not bisecting");
      if (isAlreadyAborted) {
        await cleanupStaleStateFiles(projectPath, mergeState.state);
        return { ok: true, available: true };
      }
      return { ok: false, error: stderr };
    }

    // Clean up stale state files that git may not remove on its own
    await cleanupStaleStateFiles(projectPath, mergeState.state);

    return { ok: true, available: true };
  }

  async function continueMerge(projectPath) {
    const mergeState = await getMergeState(projectPath);
    if (!mergeState.ok) {
      return { ok: false, error: "Не удалось определить состояние операции." };
    }
    if (mergeState.state === "none") {
      return { ok: false, error: "Нет активной операции." };
    }

    const continueCommands = {
      merge: ["merge", "--continue"],
      "squash-merge": ["commit", "--no-edit"],
      rebase: ["rebase", "--continue"],
      "cherry-pick": ["cherry-pick", "--continue"],
      revert: ["revert", "--continue"],
      am: ["am", "--continue"]
    };
    const baseCommand = continueCommands[mergeState.state];
    if (!baseCommand) {
      return { ok: false, error: "Эта операция не поддерживает продолжение." };
    }

    // Prevent git from opening an interactive editor (e.g. during rebase reword/edit)
    // since we run in a non-TTY IPC context with stdin closed.
    // "true" is a no-op command (exits 0) — git keeps the message file as-is.
    // Empty string would NOT work: git falls back to GIT_EDITOR/VISUAL/EDITOR/vi.
    const command = ["-c", "core.editor=true", ...baseCommand];

    const response = await runGitCommandSafe(projectPath, command, "Не удалось продолжить операцию.");
    if (!response.ok || !response.available) {
      return response;
    }

    if (response.result.code !== 0) {
      return {
        ok: false,
        error: getGitCommandError(response.result, "Не удалось продолжить операцию.")
      };
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
    getMergeState,
    resolveConflictFile,
    acceptConflictVersion,
    abortMerge,
    continueMerge,
    createBranch,
    deleteBranch,
    deleteRemoteBranch,
    runGitCommandSafe
  };
}
