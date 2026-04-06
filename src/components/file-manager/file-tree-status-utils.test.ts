import { describe, it, expect } from "vitest";
import {
  buildEntryListSnapshot,
  mergeDirectoryEntries,
  toGitStatusMap,
  buildDeletedChildrenByParent
} from "./file-tree-status-utils";

const makeEntry = (
  name: string,
  path: string,
  options: { isDirectory?: boolean; isVirtual?: boolean; isIgnored?: boolean } = {}
): FileEntry => ({
  name,
  path,
  isDirectory: options.isDirectory ?? false,
  isVirtual: options.isVirtual ?? false,
  isIgnored: options.isIgnored ?? false
});

describe("buildEntryListSnapshot", () => {
  it("returns empty string for empty array", () => {
    expect(buildEntryListSnapshot([])).toBe("");
  });

  it("serializes file entry with path, type, reality and ignored flags", () => {
    const entries = [makeEntry("app.ts", "/project/app.ts")];
    const snapshot = buildEntryListSnapshot(entries);
    expect(snapshot).toContain("/project/app.ts");
    expect(snapshot).toContain("f");
    expect(snapshot).not.toContain("d");
  });

  it("marks directories distinctly from files", () => {
    const file = [makeEntry("app.ts", "/project/app.ts")];
    const dir = [makeEntry("src", "/project/src", { isDirectory: true })];
    expect(buildEntryListSnapshot(file)).not.toBe(buildEntryListSnapshot(dir));
  });

  it("marks virtual entries distinctly from real entries", () => {
    const real = [makeEntry("a.ts", "/p/a.ts")];
    const virtual = [makeEntry("a.ts", "/p/a.ts", { isVirtual: true })];
    expect(buildEntryListSnapshot(real)).not.toBe(buildEntryListSnapshot(virtual));
  });

  it("marks ignored entries distinctly from non-ignored", () => {
    const normal = [makeEntry("src", "/p/src", { isDirectory: true })];
    const ignored = [makeEntry("src", "/p/src", { isDirectory: true, isIgnored: true })];
    expect(buildEntryListSnapshot(normal)).not.toBe(buildEntryListSnapshot(ignored));
  });

  it("joins multiple entries with newlines", () => {
    const entries = [
      makeEntry("a.ts", "/p/a.ts"),
      makeEntry("b.ts", "/p/b.ts")
    ];
    const snapshot = buildEntryListSnapshot(entries);
    const lines = snapshot.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("/p/a.ts");
    expect(lines[1]).toContain("/p/b.ts");
  });
});

describe("mergeDirectoryEntries", () => {
  it("returns sorted actual entries when no virtual entries", () => {
    const actual = [
      makeEntry("b.ts", "/p/b.ts"),
      makeEntry("a.ts", "/p/a.ts")
    ];
    const result = mergeDirectoryEntries(actual, []);
    expect(result.map((entry) => entry.name)).toEqual(["a.ts", "b.ts"]);
  });

  it("merges virtual entries with actual entries", () => {
    const actual = [makeEntry("real.ts", "/p/real.ts")];
    const virtual = [makeEntry("virtual.ts", "/p/virtual.ts", { isVirtual: true })];
    const result = mergeDirectoryEntries(actual, virtual);
    expect(result).toHaveLength(2);
    expect(result.map((entry) => entry.name)).toEqual(["real.ts", "virtual.ts"]);
  });

  it("does not duplicate entries with same path", () => {
    const actual = [makeEntry("file.ts", "/p/file.ts")];
    const virtual = [makeEntry("file.ts", "/p/file.ts", { isVirtual: true })];
    const result = mergeDirectoryEntries(actual, virtual);
    expect(result).toHaveLength(1);
    expect(result[0].isVirtual).toBe(false);
  });

  it("sorts directories before files", () => {
    const actual = [
      makeEntry("file.ts", "/p/file.ts"),
      makeEntry("src", "/p/src", { isDirectory: true })
    ];
    const result = mergeDirectoryEntries(actual, []);
    expect(result[0].name).toBe("src");
    expect(result[1].name).toBe("file.ts");
  });

  it("sorts ignored directories before non-ignored directories", () => {
    const actual = [
      makeEntry("src", "/p/src", { isDirectory: true }),
      makeEntry("node_modules", "/p/node_modules", { isDirectory: true, isIgnored: true })
    ];
    const result = mergeDirectoryEntries(actual, []);
    expect(result[0].name).toBe("node_modules");
    expect(result[1].name).toBe("src");
  });

  it("sorts ignored files before non-ignored files", () => {
    const actual = [
      makeEntry("app.ts", "/p/app.ts"),
      makeEntry(".gitignore", "/p/.gitignore", { isIgnored: true })
    ];
    const result = mergeDirectoryEntries(actual, []);
    expect(result[0].name).toBe(".gitignore");
    expect(result[1].name).toBe("app.ts");
  });
});

describe("toGitStatusMap", () => {
  it("returns empty object for empty entries", () => {
    expect(toGitStatusMap([])).toEqual({});
  });

  it("converts entries array to path-keyed map", () => {
    const entries: GitStatusEntry[] = [
      { path: "/p/a.ts", status: "modified" },
      { path: "/p/b.ts", status: "added" },
      { path: "/p/c.ts", status: "deleted" }
    ];
    const result = toGitStatusMap(entries);
    expect(result).toEqual({
      "/p/a.ts": "modified",
      "/p/b.ts": "added",
      "/p/c.ts": "deleted"
    });
  });
});

describe("buildDeletedChildrenByParent", () => {
  it("returns empty object when no deleted entries", () => {
    const entries: GitStatusEntry[] = [
      { path: "/project/src/app.ts", status: "modified" }
    ];
    const result = buildDeletedChildrenByParent("/project", entries);
    expect(result).toEqual({});
  });

  it("builds virtual children for deleted file in root", () => {
    const entries: GitStatusEntry[] = [
      { path: "/project/deleted.ts", status: "deleted" }
    ];
    const result = buildDeletedChildrenByParent("/project", entries);
    expect(result["/project"]).toBeDefined();
    expect(result["/project"]).toHaveLength(1);
    expect(result["/project"]?.[0].name).toBe("deleted.ts");
    expect(result["/project"]?.[0].isVirtual).toBe(true);
    expect(result["/project"]?.[0].isDirectory).toBe(false);
  });

  it("builds virtual directory chain for nested deleted file", () => {
    const entries: GitStatusEntry[] = [
      { path: "/project/src/deep/file.ts", status: "deleted" }
    ];
    const result = buildDeletedChildrenByParent("/project", entries);
    expect(result["/project"]).toBeDefined();
    expect(result["/project"]?.[0].name).toBe("src");
    expect(result["/project"]?.[0].isDirectory).toBe(true);
    expect(result["/project/src"]).toBeDefined();
    expect(result["/project/src"]?.[0].name).toBe("deep");
    expect(result["/project/src/deep"]).toBeDefined();
    expect(result["/project/src/deep"]?.[0].name).toBe("file.ts");
  });

  it("handles Windows paths with backslash separator", () => {
    const entries: GitStatusEntry[] = [
      { path: "C:\\project\\src\\deleted.ts", status: "deleted" }
    ];
    const result = buildDeletedChildrenByParent("C:\\project", entries);
    expect(result["C:\\project"]).toBeDefined();
    expect(result["C:\\project"]?.[0].name).toBe("src");
    expect(result["C:\\project"]?.[0].isDirectory).toBe(true);
  });

  it("ignores non-deleted entries", () => {
    const entries: GitStatusEntry[] = [
      { path: "/project/added.ts", status: "added" },
      { path: "/project/modified.ts", status: "modified" },
      { path: "/project/deleted.ts", status: "deleted" }
    ];
    const result = buildDeletedChildrenByParent("/project", entries);
    const rootChildren = result["/project"];
    expect(rootChildren).toHaveLength(1);
    expect(rootChildren?.[0].name).toBe("deleted.ts");
  });

  it("does not duplicate virtual children for multiple deleted files in same directory", () => {
    const entries: GitStatusEntry[] = [
      { path: "/project/src/a.ts", status: "deleted" },
      { path: "/project/src/b.ts", status: "deleted" }
    ];
    const result = buildDeletedChildrenByParent("/project", entries);
    const projectChildren = result["/project"];
    expect(projectChildren).toHaveLength(1);
    expect(projectChildren?.[0].name).toBe("src");

    const srcChildren = result["/project/src"];
    expect(srcChildren).toHaveLength(2);
    expect(srcChildren?.map((entry) => entry.name).sort()).toEqual(["a.ts", "b.ts"]);
  });
});
