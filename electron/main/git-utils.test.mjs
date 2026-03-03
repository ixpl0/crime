import { describe, it, expect } from "vitest";
import {
  toPathKey,
  getFileEntrySortGroup,
  toGitRelativePath,
  isCommandNotFoundError,
  isGitPathspecMissingError,
  isGitHeadResolutionError,
  getGitCommandError
} from "./git-utils.mjs";

describe("toPathKey", () => {
  it("normalizes a simple path", () => {
    const result = toPathKey("/home/user/project");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns consistent key for equivalent paths", () => {
    const key1 = toPathKey("D:\\projects\\app");
    const key2 = toPathKey("D:/projects/app");
    expect(key1).toBe(key2);
  });

  it("resolves relative segments", () => {
    const key1 = toPathKey("D:\\projects\\app");
    const key2 = toPathKey("D:\\projects\\other\\..\\app");
    expect(key1).toBe(key2);
  });
});

describe("getFileEntrySortGroup", () => {
  it("returns 0 for ignored directory", () => {
    expect(getFileEntrySortGroup({ isDirectory: true, isIgnored: true })).toBe(0);
  });

  it("returns 1 for non-ignored directory", () => {
    expect(getFileEntrySortGroup({ isDirectory: true, isIgnored: false })).toBe(1);
  });

  it("returns 1 for directory without isIgnored", () => {
    expect(getFileEntrySortGroup({ isDirectory: true })).toBe(1);
  });

  it("returns 2 for ignored file", () => {
    expect(getFileEntrySortGroup({ isDirectory: false, isIgnored: true })).toBe(2);
  });

  it("returns 3 for non-ignored file", () => {
    expect(getFileEntrySortGroup({ isDirectory: false, isIgnored: false })).toBe(3);
  });

  it("returns 3 for file without isIgnored", () => {
    expect(getFileEntrySortGroup({ isDirectory: false })).toBe(3);
  });
});

describe("toGitRelativePath", () => {
  it("returns relative path for nested path", () => {
    const result = toGitRelativePath("D:\\projects\\app", "D:\\projects\\app\\src\\main.ts");
    expect(result).toBe("src/main.ts");
  });

  it("returns null for same path", () => {
    expect(toGitRelativePath("D:\\projects\\app", "D:\\projects\\app")).toBeNull();
  });

  it("returns null for parent path", () => {
    expect(toGitRelativePath("D:\\projects\\app", "D:\\projects")).toBeNull();
  });

  it("returns null for sibling path", () => {
    expect(toGitRelativePath("D:\\projects\\app", "D:\\projects\\other\\file.ts")).toBeNull();
  });

  it("converts backslashes to forward slashes", () => {
    const result = toGitRelativePath("D:\\projects\\app", "D:\\projects\\app\\dir\\file.ts");
    expect(result).toBe("dir/file.ts");
    expect(result).not.toContain("\\");
  });
});

describe("isCommandNotFoundError", () => {
  it("returns true for ENOENT error", () => {
    const error = new Error("command not found");
    error.code = "ENOENT";
    expect(isCommandNotFoundError(error)).toBe(true);
  });

  it("returns false for other error codes", () => {
    const error = new Error("permission denied");
    error.code = "EACCES";
    expect(isCommandNotFoundError(error)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isCommandNotFoundError(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isCommandNotFoundError(undefined)).toBe(false);
  });

  it("returns false for plain object without code", () => {
    expect(isCommandNotFoundError({ message: "error" })).toBe(false);
  });
});

describe("isGitPathspecMissingError", () => {
  it("returns true for pathspec error message", () => {
    expect(isGitPathspecMissingError(
      "error: pathspec 'file.ts' did not match any file(s) known to git"
    )).toBe(true);
  });

  it("returns false for unrelated error", () => {
    expect(isGitPathspecMissingError("fatal: not a git repository")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isGitPathspecMissingError("")).toBe(false);
  });
});

describe("isGitHeadResolutionError", () => {
  it("returns true for 'could not resolve HEAD'", () => {
    expect(isGitHeadResolutionError("fatal: could not resolve HEAD")).toBe(true);
  });

  it("returns true for 'ambiguous argument HEAD'", () => {
    expect(isGitHeadResolutionError(
      "fatal: ambiguous argument 'HEAD': unknown revision"
    )).toBe(true);
  });

  it("returns true for 'unknown revision or path'", () => {
    expect(isGitHeadResolutionError(
      "fatal: unknown revision or path not in the working tree"
    )).toBe(true);
  });

  it("returns false for unrelated error", () => {
    expect(isGitHeadResolutionError("fatal: merge conflict")).toBe(false);
  });
});

describe("getGitCommandError", () => {
  it("returns stderr when non-empty", () => {
    const result = { stderr: Buffer.from("fatal: error message") };
    expect(getGitCommandError(result, "fallback")).toBe("fatal: error message");
  });

  it("returns fallback when stderr is empty", () => {
    const result = { stderr: Buffer.from("") };
    expect(getGitCommandError(result, "fallback message")).toBe("fallback message");
  });

  it("returns fallback when stderr is whitespace only", () => {
    const result = { stderr: Buffer.from("   \n  ") };
    expect(getGitCommandError(result, "fallback")).toBe("fallback");
  });
});
