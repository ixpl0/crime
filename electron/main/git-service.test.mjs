import { describe, it, expect, vi } from "vitest";
import { createGitService } from "./git-service.mjs";

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
});
