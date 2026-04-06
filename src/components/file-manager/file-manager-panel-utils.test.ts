import { describe, it, expect } from "vitest";
import { normalizeGitState, buildNextTreeState } from "./file-manager-panel-utils";

describe("normalizeGitState", () => {
  it("returns empty statuses and error message when response is not ok", () => {
    const result = normalizeGitState("/project", {
      ok: false,
      error: "git failed"
    } as GitStatusResponse);
    expect(result.statuses).toEqual({});
    expect(result.deletedChildren).toEqual({});
    expect(result.infoMessage).toContain("git failed");
  });

  it("returns generic error message when response has no error text", () => {
    const result = normalizeGitState("/project", {
      ok: false
    } as GitStatusResponse);
    expect(result.infoMessage.length).toBeGreaterThan(0);
  });

  it("returns empty statuses and info when git is not installed", () => {
    const result = normalizeGitState("/project", {
      ok: true,
      available: false,
      reason: "git-not-installed"
    } as GitStatusResponse);
    expect(result.statuses).toEqual({});
    expect(result.deletedChildren).toEqual({});
    expect(result.infoMessage.length).toBeGreaterThan(0);
    expect(result.infoMessage.toLowerCase()).toContain("git");
  });

  it("returns empty statuses and info when not a git repository", () => {
    const result = normalizeGitState("/project", {
      ok: true,
      available: false,
      reason: "not-a-repository"
    } as GitStatusResponse);
    expect(result.statuses).toEqual({});
    expect(result.infoMessage.length).toBeGreaterThan(0);
  });

  it("returns statuses map from git entries", () => {
    const result = normalizeGitState("/project", {
      ok: true,
      available: true,
      entries: [
        { path: "/project/a.ts", status: "modified" },
        { path: "/project/b.ts", status: "added" }
      ]
    } as GitStatusResponse);
    expect(result.statuses).toEqual({
      "/project/a.ts": "modified",
      "/project/b.ts": "added"
    });
    expect(result.infoMessage).toBe("");
  });

  it("builds deleted children from deleted entries", () => {
    const result = normalizeGitState("/project", {
      ok: true,
      available: true,
      entries: [
        { path: "/project/removed.ts", status: "deleted" }
      ]
    } as GitStatusResponse);
    expect(result.deletedChildren["/project"]).toBeDefined();
    expect(result.deletedChildren["/project"]?.[0].name).toBe("removed.ts");
  });

  it("handles empty entries array", () => {
    const result = normalizeGitState("/project", {
      ok: true,
      available: true,
      entries: []
    } as GitStatusResponse);
    expect(result.statuses).toEqual({});
    expect(result.deletedChildren).toEqual({});
    expect(result.infoMessage).toBe("");
  });

  it("handles missing entries (undefined)", () => {
    const result = normalizeGitState("/project", {
      ok: true,
      available: true
    } as GitStatusResponse);
    expect(result.statuses).toEqual({});
    expect(result.deletedChildren).toEqual({});
  });
});

describe("buildNextTreeState", () => {
  const makeGitResponse = (entries: GitStatusEntry[] = []): GitStatusResponse =>
    ({
      ok: true,
      available: true,
      entries
    }) as GitStatusResponse;

  const makeDirResponse = (entries: FileEntry[] = []): FilesystemReadResponse =>
    ({
      ok: true,
      entries
    }) as FilesystemReadResponse;

  const makeEntry = (name: string, path: string, isDirectory = false): FileEntry => ({
    name,
    path,
    isDirectory,
    isVirtual: false,
    isIgnored: false
  });

  it("combines filesystem and git data into tree state", () => {
    const dirResponse = makeDirResponse([
      makeEntry("app.ts", "/project/app.ts"),
      makeEntry("src", "/project/src", true)
    ]);
    const gitResponse = makeGitResponse([
      { path: "/project/app.ts", status: "modified" }
    ]);
    const result = buildNextTreeState("/project", dirResponse, gitResponse);
    expect(result.entries.length).toBeGreaterThanOrEqual(2);
    expect(result.statuses["/project/app.ts"]).toBe("modified");
    expect(result.loadError).toBe("");
    expect(result.infoMessage).toBe("");
  });

  it("produces non-empty stateSnapshot", () => {
    const result = buildNextTreeState(
      "/project",
      makeDirResponse([makeEntry("a.ts", "/project/a.ts")]),
      makeGitResponse()
    );
    expect(result.stateSnapshot.length).toBeGreaterThan(0);
  });

  it("produces non-empty structureSnapshot", () => {
    const result = buildNextTreeState(
      "/project",
      makeDirResponse([makeEntry("a.ts", "/project/a.ts")]),
      makeGitResponse()
    );
    expect(result.structureSnapshot.length).toBeGreaterThan(0);
  });

  it("returns same snapshots for same inputs", () => {
    const dir = makeDirResponse([makeEntry("a.ts", "/p/a.ts")]);
    const git = makeGitResponse([{ path: "/p/a.ts", status: "modified" }]);
    const result1 = buildNextTreeState("/p", dir, git);
    const result2 = buildNextTreeState("/p", dir, git);
    expect(result1.stateSnapshot).toBe(result2.stateSnapshot);
    expect(result1.structureSnapshot).toBe(result2.structureSnapshot);
  });

  it("returns different stateSnapshot when git status changes", () => {
    const dir = makeDirResponse([makeEntry("a.ts", "/p/a.ts")]);
    const git1 = makeGitResponse([{ path: "/p/a.ts", status: "modified" }]);
    const git2 = makeGitResponse([{ path: "/p/a.ts", status: "added" }]);
    const result1 = buildNextTreeState("/p", dir, git1);
    const result2 = buildNextTreeState("/p", dir, git2);
    expect(result1.stateSnapshot).not.toBe(result2.stateSnapshot);
  });

  it("sets loadError when directory response is not ok", () => {
    const dirResponse = { ok: false, error: "Permission denied" } as FilesystemReadResponse;
    const result = buildNextTreeState("/project", dirResponse, makeGitResponse());
    expect(result.loadError).toContain("Permission denied");
    expect(result.entries).toEqual([]);
  });

  it("sets generic loadError when directory error text is absent", () => {
    const dirResponse = { ok: false } as FilesystemReadResponse;
    const result = buildNextTreeState("/project", dirResponse, makeGitResponse());
    expect(result.loadError.length).toBeGreaterThan(0);
  });

  it("merges virtual deleted entries into the entries list", () => {
    const dirResponse = makeDirResponse([makeEntry("kept.ts", "/project/kept.ts")]);
    const gitResponse = makeGitResponse([
      { path: "/project/removed.ts", status: "deleted" }
    ]);
    const result = buildNextTreeState("/project", dirResponse, gitResponse);
    const names = result.entries.map((entry) => entry.name);
    expect(names).toContain("kept.ts");
    expect(names).toContain("removed.ts");
  });

  it("sorts entries: directories before files", () => {
    const dirResponse = makeDirResponse([
      makeEntry("file.ts", "/p/file.ts"),
      makeEntry("src", "/p/src", true)
    ]);
    const result = buildNextTreeState("/p", dirResponse, makeGitResponse());
    expect(result.entries[0].name).toBe("src");
    expect(result.entries[1].name).toBe("file.ts");
  });
});
