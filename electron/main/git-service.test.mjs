import { describe, it, expect, vi, beforeEach } from "vitest";
import { access, readFile, unlink } from "node:fs/promises";
import { createGitService } from "./git-service.mjs";

vi.mock("node:fs/promises", () => ({
  access: vi.fn(),
  readFile: vi.fn(),
  unlink: vi.fn()
}));

function makeCommandResult(code, stdout = "", stderr = "") {
  return {
    code,
    stdout: Buffer.from(stdout),
    stderr: Buffer.from(stderr)
  };
}

function createMockRunCommand(responses = {}) {
  return vi.fn(async (cmd, args) => {
    const key = args[0] === "-c" ? args[2] : args[0];
    if (typeof responses === "function") {
      return responses(cmd, args);
    }
    return responses[key] ?? makeCommandResult(0);
  });
}

describe("createGitService", () => {
  describe("getRepositoryState", () => {
    it("returns available: true for valid git repository", async () => {
      const runCommand = createMockRunCommand({
        "rev-parse": makeCommandResult(0, "true\n")
      });
      const service = createGitService(runCommand);
      const result = await service.getRepositoryState("/project");
      expect(result).toEqual({ ok: true, available: true });
    });

    it("returns available: false for non-repository", async () => {
      const runCommand = createMockRunCommand({
        "rev-parse": makeCommandResult(128, "", "fatal: not a git repository")
      });
      const service = createGitService(runCommand);
      const result = await service.getRepositoryState("/project");
      expect(result.ok).toBe(true);
      expect(result.available).toBe(false);
      expect(result.reason).toBe("not-a-repository");
    });

    it("returns git-not-installed when command not found", async () => {
      const error = new Error("spawn git ENOENT");
      error.code = "ENOENT";
      const runCommand = vi.fn().mockRejectedValue(error);
      const service = createGitService(runCommand);
      const result = await service.getRepositoryState("/project");
      expect(result.ok).toBe(true);
      expect(result.available).toBe(false);
      expect(result.reason).toBe("git-not-installed");
    });

    it("returns ok: false for unexpected errors", async () => {
      const runCommand = vi.fn().mockRejectedValue(new Error("unexpected"));
      const service = createGitService(runCommand);
      const result = await service.getRepositoryState("/project");
      expect(result.ok).toBe(false);
      expect(result.error).toBe("unexpected");
    });
  });

  describe("getStatusForProject", () => {
    it("returns entries for valid repository", async () => {
      const runCommand = vi.fn(async (_cmd, args) => {
        if (args.includes("--is-inside-work-tree")) {
          return makeCommandResult(0, "true\n");
        }
        return makeCommandResult(0, "");
      });
      const service = createGitService(runCommand);
      const result = await service.getStatusForProject("/project");
      expect(result.ok).toBe(true);
      expect(result.available).toBe(true);
      expect(result.entries).toEqual([]);
    });

    it("returns empty entries for non-repository", async () => {
      const runCommand = vi.fn(async () =>
        makeCommandResult(128, "", "fatal: not a git repo")
      );
      const service = createGitService(runCommand);
      const result = await service.getStatusForProject("/project");
      expect(result.ok).toBe(true);
      expect(result.available).toBe(false);
      expect(result.entries).toEqual([]);
    });

    it("returns error when status command fails", async () => {
      const runCommand = vi.fn(async (_cmd, args) => {
        if (args.includes("--is-inside-work-tree")) {
          return makeCommandResult(0, "true\n");
        }
        return makeCommandResult(128, "", "fatal: broken");
      });
      const service = createGitService(runCommand);
      const result = await service.getStatusForProject("/project");
      expect(result.ok).toBe(false);
      expect(result.error).toBe("fatal: broken");
    });
  });

  describe("getLog", () => {
    it("returns empty entries for non-repository", async () => {
      const runCommand = vi.fn(async () =>
        makeCommandResult(128, "", "fatal: not a git repo")
      );
      const service = createGitService(runCommand);
      const result = await service.getLog("/project");
      expect(result.ok).toBe(true);
      expect(result.available).toBe(false);
      expect(result.entries).toEqual([]);
    });

    it("returns empty entries for repository with no commits", async () => {
      const runCommand = vi.fn(async (_cmd, args) => {
        if (args.includes("--show-toplevel")) {
          return makeCommandResult(0, "/project\n");
        }
        return makeCommandResult(128, "", "fatal: your current branch does not have any commits yet");
      });
      const service = createGitService(runCommand);
      const result = await service.getLog("/project");
      expect(result.ok).toBe(true);
      expect(result.available).toBe(true);
      expect(result.entries).toEqual([]);
    });

    it("uses custom maxCount", async () => {
      const runCommand = vi.fn(async (_cmd, args) => {
        if (args.includes("--show-toplevel")) {
          return makeCommandResult(0, "/project\n");
        }
        return makeCommandResult(0, "");
      });
      const service = createGitService(runCommand);
      await service.getLog("/project", 50);
      const logCall = runCommand.mock.calls.find(
        ([, args]) => args.includes("--all")
      );
      expect(logCall).toBeDefined();
      expect(logCall[1]).toContain("--max-count=50");
    });

    it("defaults to 200 for invalid maxCount", async () => {
      const runCommand = vi.fn(async (_cmd, args) => {
        if (args.includes("--show-toplevel")) {
          return makeCommandResult(0, "/project\n");
        }
        return makeCommandResult(0, "");
      });
      const service = createGitService(runCommand);
      await service.getLog("/project", -1);
      const logCall = runCommand.mock.calls.find(
        ([, args]) => args.includes("--all")
      );
      expect(logCall[1]).toContain("--max-count=200");
    });
  });

  describe("getCommitDetails", () => {
    it("returns not-a-repository for invalid path", async () => {
      const runCommand = vi.fn(async () =>
        makeCommandResult(128, "", "fatal: not a git repo")
      );
      const service = createGitService(runCommand);
      const result = await service.getCommitDetails("/project", "abc123");
      expect(result.ok).toBe(true);
      expect(result.available).toBe(false);
    });

    it("parses commit details from formatted output", async () => {
      const fieldSep = "\x1f";
      const bodyMarker = "\x1eBODY\x1e";
      const fields = [
        "abc123def456abc123def456abc123def456abc123",
        "parent123",
        "Author Name",
        "author@example.com",
        "2024-01-15T10:30:00+00:00",
        "Committer Name",
        "committer@example.com",
        "2024-01-15T10:30:00+00:00",
        "HEAD -> main",
        "Fix bug in parser"
      ].join(fieldSep);
      const metaOutput = `${fields}${bodyMarker}Detailed body text${bodyMarker}`;

      const runCommand = vi.fn(async (_cmd, args) => {
        if (args.includes("--show-toplevel")) {
          return makeCommandResult(0, "/project\n");
        }
        if (args.includes("-1")) {
          return makeCommandResult(0, metaOutput);
        }
        if (args.includes("diff-tree")) {
          return makeCommandResult(0, "");
        }
        return makeCommandResult(0, "");
      });

      const service = createGitService(runCommand);
      const result = await service.getCommitDetails("/project", "abc123");
      expect(result.ok).toBe(true);
      expect(result.available).toBe(true);
      expect(result.details.authorName).toBe("Author Name");
      expect(result.details.authorEmail).toBe("author@example.com");
      expect(result.details.subject).toBe("Fix bug in parser");
      expect(result.details.body).toBe("Detailed body text");
      expect(result.details.refs).toContain("HEAD -> main");
      expect(result.details.parentHashes).toEqual(["parent123"]);
    });
  });

  describe("restorePath", () => {
    it("runs restore and clean on success", async () => {
      const runCommand = vi.fn(async () => makeCommandResult(0));
      const service = createGitService(runCommand);
      const result = await service.restorePath("/project", "file.ts");
      expect(result).toEqual({ ok: true, available: true });
      expect(runCommand).toHaveBeenCalledTimes(2);
    });

    it("falls back to rm --cached when HEAD cannot be resolved", async () => {
      let callCount = 0;
      const runCommand = vi.fn(async (_cmd, args) => {
        callCount++;
        if (args.includes("restore") && callCount === 1) {
          return makeCommandResult(128, "", "fatal: could not resolve HEAD");
        }
        return makeCommandResult(0);
      });
      const service = createGitService(runCommand);
      const result = await service.restorePath("/project", "file.ts");
      expect(result).toEqual({ ok: true, available: true });
      const rmCall = runCommand.mock.calls.find(
        ([, args]) => args.includes("rm")
      );
      expect(rmCall).toBeDefined();
    });

    it("returns error for non-recoverable restore failure", async () => {
      const runCommand = vi.fn(async (_cmd, args) => {
        if (args.includes("restore")) {
          return makeCommandResult(128, "", "fatal: some other error");
        }
        return makeCommandResult(0);
      });
      const service = createGitService(runCommand);
      const result = await service.restorePath("/project", "file.ts");
      expect(result.ok).toBe(false);
      expect(result.error).toBe("fatal: some other error");
    });
  });

  describe("getMergeState", () => {
    function setupGitDir(runCommand) {
      // Mock getGitDir to return a known path
      runCommand.mockImplementation(async (_cmd, args) => {
        if (args.includes("--absolute-git-dir")) {
          return makeCommandResult(0, "/project/.git\n");
        }
        return makeCommandResult(0);
      });
    }

    function mockFileExists(paths) {
      access.mockImplementation(async (filePath) => {
        const normalized = filePath.replaceAll("\\", "/");
        if (paths.some((p) => normalized.endsWith(p))) {
          return undefined;
        }
        throw new Error("ENOENT");
      });
    }

    beforeEach(() => {
      vi.mocked(access).mockRejectedValue(new Error("ENOENT"));
      vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));
    });

    it("returns none when git dir is not available", async () => {
      const runCommand = vi.fn(async () => makeCommandResult(128, "", "fatal: not a git repo"));
      const service = createGitService(runCommand);
      const result = await service.getMergeState("/project");
      expect(result).toEqual({ ok: true, state: "none" });
    });

    it("detects merge via MERGE_HEAD", async () => {
      const runCommand = vi.fn();
      setupGitDir(runCommand);
      mockFileExists(["MERGE_HEAD"]);
      const service = createGitService(runCommand);
      const result = await service.getMergeState("/project");
      expect(result).toEqual({ ok: true, state: "merge" });
    });

    it("detects rebase via rebase-merge with head-name", async () => {
      const runCommand = vi.fn();
      setupGitDir(runCommand);
      mockFileExists(["rebase-merge", "rebase-merge/head-name"]);
      const service = createGitService(runCommand);
      const result = await service.getMergeState("/project");
      expect(result).toEqual({ ok: true, state: "rebase" });
    });

    it("skips stale rebase-merge without head-name", async () => {
      const runCommand = vi.fn();
      setupGitDir(runCommand);
      // rebase-merge exists but head-name does not
      mockFileExists(["rebase-merge"]);
      const service = createGitService(runCommand);
      const result = await service.getMergeState("/project");
      expect(result).toEqual({ ok: true, state: "none" });
    });

    it("detects am via rebase-apply with applying", async () => {
      const runCommand = vi.fn();
      setupGitDir(runCommand);
      mockFileExists(["rebase-apply", "rebase-apply/applying"]);
      const service = createGitService(runCommand);
      const result = await service.getMergeState("/project");
      expect(result).toEqual({ ok: true, state: "am" });
    });

    it("detects rebase-apply without applying as rebase", async () => {
      const runCommand = vi.fn();
      setupGitDir(runCommand);
      mockFileExists(["rebase-apply", "rebase-apply/next"]);
      const service = createGitService(runCommand);
      const result = await service.getMergeState("/project");
      expect(result).toEqual({ ok: true, state: "rebase" });
    });

    it("detects cherry-pick via CHERRY_PICK_HEAD", async () => {
      const runCommand = vi.fn();
      setupGitDir(runCommand);
      mockFileExists(["CHERRY_PICK_HEAD"]);
      const service = createGitService(runCommand);
      const result = await service.getMergeState("/project");
      expect(result).toEqual({ ok: true, state: "cherry-pick" });
    });

    it("detects revert via REVERT_HEAD", async () => {
      const runCommand = vi.fn();
      setupGitDir(runCommand);
      mockFileExists(["REVERT_HEAD"]);
      const service = createGitService(runCommand);
      const result = await service.getMergeState("/project");
      expect(result).toEqual({ ok: true, state: "revert" });
    });

    it("detects multi cherry-pick via sequencer/todo", async () => {
      const runCommand = vi.fn();
      setupGitDir(runCommand);
      mockFileExists([]);
      readFile.mockImplementation(async (filePath) => {
        if (filePath.replaceAll("\\", "/").endsWith("sequencer/todo")) {
          return "pick abc123 First commit\npick def456 Second commit\n";
        }
        throw new Error("ENOENT");
      });
      const service = createGitService(runCommand);
      const result = await service.getMergeState("/project");
      expect(result).toEqual({ ok: true, state: "cherry-pick" });
    });

    it("detects multi revert via sequencer/todo", async () => {
      const runCommand = vi.fn();
      setupGitDir(runCommand);
      mockFileExists([]);
      readFile.mockImplementation(async (filePath) => {
        if (filePath.replaceAll("\\", "/").endsWith("sequencer/todo")) {
          return "revert abc123 Revert commit\n";
        }
        throw new Error("ENOENT");
      });
      const service = createGitService(runCommand);
      const result = await service.getMergeState("/project");
      expect(result).toEqual({ ok: true, state: "revert" });
    });

    it("detects squash-merge via SQUASH_MSG", async () => {
      const runCommand = vi.fn();
      setupGitDir(runCommand);
      mockFileExists(["SQUASH_MSG"]);
      const service = createGitService(runCommand);
      const result = await service.getMergeState("/project");
      expect(result).toEqual({ ok: true, state: "squash-merge" });
    });

    it("detects bisect via BISECT_LOG", async () => {
      const runCommand = vi.fn();
      setupGitDir(runCommand);
      mockFileExists(["BISECT_LOG"]);
      const service = createGitService(runCommand);
      const result = await service.getMergeState("/project");
      expect(result).toEqual({ ok: true, state: "bisect" });
    });

    it("MERGE_HEAD takes priority over REBASE_HEAD", async () => {
      const runCommand = vi.fn();
      setupGitDir(runCommand);
      mockFileExists(["MERGE_HEAD", "REBASE_HEAD"]);
      const service = createGitService(runCommand);
      const result = await service.getMergeState("/project");
      expect(result).toEqual({ ok: true, state: "merge" });
    });

    it("REBASE_HEAD is fallback when rebase-merge is stale", async () => {
      const runCommand = vi.fn();
      setupGitDir(runCommand);
      // rebase-merge exists but no head-name, REBASE_HEAD exists
      mockFileExists(["rebase-merge", "REBASE_HEAD"]);
      const service = createGitService(runCommand);
      const result = await service.getMergeState("/project");
      expect(result).toEqual({ ok: true, state: "rebase" });
    });

    it("detects am over rebase when both applying and next exist", async () => {
      const runCommand = vi.fn();
      setupGitDir(runCommand);
      mockFileExists(["rebase-apply", "rebase-apply/applying", "rebase-apply/next"]);
      const service = createGitService(runCommand);
      const result = await service.getMergeState("/project");
      expect(result).toEqual({ ok: true, state: "am" });
    });
  });

  describe("abortMerge", () => {
    function setupMergeState(runCommand, state, fileHits) {
      const callTracker = [];
      runCommand.mockImplementation(async (_cmd, args) => {
        if (args.includes("--absolute-git-dir")) {
          return makeCommandResult(0, "/project/.git\n");
        }
        callTracker.push(args[0] === "-c" ? args[2] : args[0]);
        return makeCommandResult(0);
      });
      // Mock fs to detect the right state
      access.mockImplementation(async (filePath) => {
        const normalized = filePath.replaceAll("\\", "/");
        if ((fileHits ?? []).some((p) => normalized.endsWith(p))) {
          return undefined;
        }
        throw new Error("ENOENT");
      });
      readFile.mockRejectedValue(new Error("ENOENT"));
      return callTracker;
    }

    beforeEach(() => {
      vi.mocked(access).mockRejectedValue(new Error("ENOENT"));
      vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));
      vi.mocked(unlink).mockResolvedValue(undefined);
    });

    it("returns ok when no operation is in progress (race condition)", async () => {
      const runCommand = vi.fn(async () => makeCommandResult(128, "", "fatal"));
      access.mockRejectedValue(new Error("ENOENT"));
      readFile.mockRejectedValue(new Error("ENOENT"));
      const service = createGitService(runCommand);
      const result = await service.abortMerge("/project");
      expect(result.ok).toBe(true);
    });

    it("runs git merge --abort for merge state", async () => {
      const runCommand = vi.fn();
      const calls = setupMergeState(runCommand, "merge", ["MERGE_HEAD"]);
      const service = createGitService(runCommand);
      await service.abortMerge("/project");
      expect(calls).toContain("merge");
    });

    it("runs git rebase --abort for rebase state", async () => {
      const runCommand = vi.fn();
      const calls = setupMergeState(runCommand, "rebase", ["rebase-merge", "rebase-merge/head-name"]);
      const service = createGitService(runCommand);
      await service.abortMerge("/project");
      expect(calls).toContain("rebase");
    });

    it("runs git cherry-pick --abort for cherry-pick state", async () => {
      const runCommand = vi.fn();
      const calls = setupMergeState(runCommand, "cherry-pick", ["CHERRY_PICK_HEAD"]);
      const service = createGitService(runCommand);
      await service.abortMerge("/project");
      expect(calls).toContain("cherry-pick");
    });

    it("runs git revert --abort for revert state", async () => {
      const runCommand = vi.fn();
      const calls = setupMergeState(runCommand, "revert", ["REVERT_HEAD"]);
      const service = createGitService(runCommand);
      await service.abortMerge("/project");
      expect(calls).toContain("revert");
    });

    it("runs git bisect reset for bisect state", async () => {
      const runCommand = vi.fn();
      const calls = setupMergeState(runCommand, "bisect", ["BISECT_LOG"]);
      const service = createGitService(runCommand);
      await service.abortMerge("/project");
      expect(calls).toContain("bisect");
    });

    it("treats 'no rebase in progress' stderr as success and cleans up stale REBASE_HEAD", async () => {
      const runCommand = vi.fn(async (_cmd, args) => {
        if (args.includes("--absolute-git-dir")) {
          return makeCommandResult(0, "/project/.git\n");
        }
        if (args.includes("--abort")) {
          return makeCommandResult(128, "", "fatal: No rebase in progress?");
        }
        return makeCommandResult(0);
      });
      access.mockImplementation(async (filePath) => {
        if (filePath.replaceAll("\\", "/").endsWith("REBASE_HEAD")) {
          return undefined;
        }
        throw new Error("ENOENT");
      });
      readFile.mockRejectedValue(new Error("ENOENT"));
      unlink.mockResolvedValue(undefined);
      const service = createGitService(runCommand);
      const result = await service.abortMerge("/project");
      expect(result.ok).toBe(true);
      const unlinkCalls = unlink.mock.calls.map(([p]) => p.replaceAll("\\", "/"));
      expect(unlinkCalls.some((p) => p.endsWith("/REBASE_HEAD"))).toBe(true);
    });

    it("treats 'no merge to abort' stderr as success and cleans up stale MERGE_HEAD", async () => {
      const runCommand = vi.fn(async (_cmd, args) => {
        if (args.includes("--absolute-git-dir")) {
          return makeCommandResult(0, "/project/.git\n");
        }
        if (args.includes("--abort")) {
          return makeCommandResult(128, "", "fatal: There is no merge to abort (MERGE_HEAD missing).");
        }
        return makeCommandResult(0);
      });
      access.mockImplementation(async (filePath) => {
        if (filePath.replaceAll("\\", "/").endsWith("MERGE_HEAD")) {
          return undefined;
        }
        throw new Error("ENOENT");
      });
      readFile.mockRejectedValue(new Error("ENOENT"));
      unlink.mockResolvedValue(undefined);
      const service = createGitService(runCommand);
      const result = await service.abortMerge("/project");
      expect(result.ok).toBe(true);
      const unlinkCalls = unlink.mock.calls.map(([p]) => p.replaceAll("\\", "/"));
      expect(unlinkCalls.some((p) => p.endsWith("/MERGE_HEAD"))).toBe(true);
    });

    it("cleans up stale state files after successful abort", async () => {
      const runCommand = vi.fn();
      const calls = setupMergeState(runCommand, "cherry-pick", ["CHERRY_PICK_HEAD"]);
      unlink.mockResolvedValue(undefined);
      const service = createGitService(runCommand);
      await service.abortMerge("/project");
      expect(calls).toContain("cherry-pick");
      const unlinkCalls = unlink.mock.calls.map(([p]) => p.replaceAll("\\", "/"));
      expect(unlinkCalls.some((p) => p.endsWith("/CHERRY_PICK_HEAD"))).toBe(true);
    });

    it("runs git reset --merge for squash-merge state", async () => {
      const runCommand = vi.fn();
      const calls = setupMergeState(runCommand, "squash-merge", ["SQUASH_MSG"]);
      const service = createGitService(runCommand);
      await service.abortMerge("/project");
      expect(calls).toContain("reset");
    });

    it("runs git am --abort for am state", async () => {
      const runCommand = vi.fn();
      const calls = setupMergeState(runCommand, "am", ["rebase-apply", "rebase-apply/applying"]);
      const service = createGitService(runCommand);
      await service.abortMerge("/project");
      expect(calls).toContain("am");
    });
  });

  describe("continueMerge", () => {
    beforeEach(() => {
      vi.mocked(access).mockRejectedValue(new Error("ENOENT"));
      vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));
    });

    it("returns error when no operation is in progress", async () => {
      const runCommand = vi.fn(async () => makeCommandResult(128, "", "fatal"));
      const service = createGitService(runCommand);
      const result = await service.continueMerge("/project");
      expect(result.ok).toBe(false);
    });

    it("runs git -c core.editor=true rebase --continue for rebase", async () => {
      const runCommand = vi.fn(async (_cmd, args) => {
        if (args.includes("--absolute-git-dir")) {
          return makeCommandResult(0, "/project/.git\n");
        }
        return makeCommandResult(0);
      });
      access.mockImplementation(async (filePath) => {
        const p = filePath.replaceAll("\\", "/");
        if (p.endsWith("rebase-merge") || p.endsWith("rebase-merge/head-name")) {
          return undefined;
        }
        throw new Error("ENOENT");
      });
      readFile.mockRejectedValue(new Error("ENOENT"));
      const service = createGitService(runCommand);
      await service.continueMerge("/project");
      const continueCall = runCommand.mock.calls.find(
        ([, args]) => args.includes("--continue")
      );
      expect(continueCall).toBeDefined();
      expect(continueCall[1]).toContain("core.editor=true");
      expect(continueCall[1]).toContain("rebase");
    });

    it("runs git commit --no-edit for squash-merge continue", async () => {
      const runCommand = vi.fn(async (_cmd, args) => {
        if (args.includes("--absolute-git-dir")) {
          return makeCommandResult(0, "/project/.git\n");
        }
        return makeCommandResult(0);
      });
      access.mockImplementation(async (filePath) => {
        if (filePath.replaceAll("\\", "/").endsWith("SQUASH_MSG")) {
          return undefined;
        }
        throw new Error("ENOENT");
      });
      readFile.mockRejectedValue(new Error("ENOENT"));
      const service = createGitService(runCommand);
      await service.continueMerge("/project");
      const commitCall = runCommand.mock.calls.find(
        ([, args]) => args.includes("commit")
      );
      expect(commitCall).toBeDefined();
      expect(commitCall[1]).toContain("--no-edit");
    });

    it("runs git cherry-pick --continue for cherry-pick", async () => {
      const runCommand = vi.fn(async (_cmd, args) => {
        if (args.includes("--absolute-git-dir")) {
          return makeCommandResult(0, "/project/.git\n");
        }
        return makeCommandResult(0);
      });
      access.mockImplementation(async (filePath) => {
        if (filePath.replaceAll("\\", "/").endsWith("CHERRY_PICK_HEAD")) {
          return undefined;
        }
        throw new Error("ENOENT");
      });
      readFile.mockRejectedValue(new Error("ENOENT"));
      const service = createGitService(runCommand);
      await service.continueMerge("/project");
      const continueCall = runCommand.mock.calls.find(
        ([, args]) => args.includes("--continue")
      );
      expect(continueCall).toBeDefined();
      expect(continueCall[1]).toContain("cherry-pick");
    });

    it("returns error for bisect (no continue support)", async () => {
      const runCommand = vi.fn(async (_cmd, args) => {
        if (args.includes("--absolute-git-dir")) {
          return makeCommandResult(0, "/project/.git\n");
        }
        return makeCommandResult(0);
      });
      access.mockImplementation(async (filePath) => {
        if (filePath.replaceAll("\\", "/").endsWith("BISECT_LOG")) {
          return undefined;
        }
        throw new Error("ENOENT");
      });
      readFile.mockRejectedValue(new Error("ENOENT"));
      const service = createGitService(runCommand);
      const result = await service.continueMerge("/project");
      expect(result.ok).toBe(false);
      expect(result.error).toContain("не поддерживает продолжение");
    });

    it("passes through git error when continue fails", async () => {
      const runCommand = vi.fn(async (_cmd, args) => {
        if (args.includes("--absolute-git-dir")) {
          return makeCommandResult(0, "/project/.git\n");
        }
        if (args.includes("--continue")) {
          return makeCommandResult(128, "", "error: could not apply abc123");
        }
        return makeCommandResult(0);
      });
      access.mockImplementation(async (filePath) => {
        if (filePath.replaceAll("\\", "/").endsWith("MERGE_HEAD")) {
          return undefined;
        }
        throw new Error("ENOENT");
      });
      readFile.mockRejectedValue(new Error("ENOENT"));
      const service = createGitService(runCommand);
      const result = await service.continueMerge("/project");
      expect(result.ok).toBe(false);
      expect(result.error).toContain("could not apply");
    });
  });
});
