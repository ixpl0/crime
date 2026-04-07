import { describe, it, expect } from "vitest";
import { parseBranchRef } from "./use-git-graph-context-menu";

describe("parseBranchRef", () => {
  const defaultRemotes = ["origin"];

  it("returns null for HEAD", () => {
    expect(parseBranchRef("HEAD", defaultRemotes)).toBeNull();
  });

  it("returns null for tags", () => {
    expect(parseBranchRef("tag: v1.0", defaultRemotes)).toBeNull();
    expect(parseBranchRef("tag: release-2024", defaultRemotes)).toBeNull();
  });

  it("parses HEAD -> branchName as local branch", () => {
    const result = parseBranchRef("HEAD -> main", defaultRemotes);
    expect(result).toEqual({ displayName: "main", branchName: "main", remote: null });
  });

  it("parses HEAD -> branchName with slashes as local branch", () => {
    const result = parseBranchRef("HEAD -> fix/blog-filenames", defaultRemotes);
    expect(result).toEqual({
      displayName: "fix/blog-filenames",
      branchName: "fix/blog-filenames",
      remote: null
    });
  });

  it("parses simple local branch without slashes", () => {
    const result = parseBranchRef("main", defaultRemotes);
    expect(result).toEqual({ displayName: "main", branchName: "main", remote: null });
  });

  it("parses local branch with slashes as local (not remote)", () => {
    const result = parseBranchRef("fix/blog-filenames", defaultRemotes);
    expect(result).toEqual({
      displayName: "fix/blog-filenames",
      branchName: "fix/blog-filenames",
      remote: null
    });
  });

  it("parses local branch with multiple slashes as local", () => {
    const result = parseBranchRef("feature/auth/oauth2", defaultRemotes);
    expect(result).toEqual({
      displayName: "feature/auth/oauth2",
      branchName: "feature/auth/oauth2",
      remote: null
    });
  });

  it("parses remote tracking ref with known remote", () => {
    const result = parseBranchRef("origin/main", defaultRemotes);
    expect(result).toEqual({ displayName: "origin/main", branchName: "main", remote: "origin" });
  });

  it("parses remote tracking ref with slashes in branch name", () => {
    const result = parseBranchRef("origin/fix/blog-filenames", defaultRemotes);
    expect(result).toEqual({
      displayName: "origin/fix/blog-filenames",
      branchName: "fix/blog-filenames",
      remote: "origin"
    });
  });

  it("parses remote tracking ref with multiple slashes in branch name", () => {
    const result = parseBranchRef("origin/feature/auth/oauth2", defaultRemotes);
    expect(result).toEqual({
      displayName: "origin/feature/auth/oauth2",
      branchName: "feature/auth/oauth2",
      remote: "origin"
    });
  });

  it("handles multiple remotes correctly", () => {
    const remotes = ["origin", "upstream", "fork"];

    const originRef = parseBranchRef("origin/main", remotes);
    expect(originRef).toEqual({ displayName: "origin/main", branchName: "main", remote: "origin" });

    const upstreamRef = parseBranchRef("upstream/develop", remotes);
    expect(upstreamRef).toEqual({ displayName: "upstream/develop", branchName: "develop", remote: "upstream" });

    const forkRef = parseBranchRef("fork/feature/test", remotes);
    expect(forkRef).toEqual({
      displayName: "fork/feature/test",
      branchName: "feature/test",
      remote: "fork"
    });
  });

  it("treats branch as local when prefix matches no known remote", () => {
    const result = parseBranchRef("fix/blog-filenames", ["origin", "upstream"]);
    expect(result).toEqual({
      displayName: "fix/blog-filenames",
      branchName: "fix/blog-filenames",
      remote: null
    });
  });

  it("treats all branches as local when remotes list is empty", () => {
    const result = parseBranchRef("origin/main", []);
    expect(result).toEqual({
      displayName: "origin/main",
      branchName: "origin/main",
      remote: null
    });
  });

  it("does not confuse similar remote name prefixes", () => {
    const remotes = ["o", "origin"];

    const result = parseBranchRef("origin/main", remotes);
    expect(result).toEqual({ displayName: "origin/main", branchName: "main", remote: "origin" });

    const short = parseBranchRef("o/feature", remotes);
    expect(short).toEqual({ displayName: "o/feature", branchName: "feature", remote: "o" });
  });

  it("does not match remote name without trailing slash", () => {
    const result = parseBranchRef("origins/main", ["origin"]);
    expect(result).toEqual({
      displayName: "origins/main",
      branchName: "origins/main",
      remote: null
    });
  });
});
