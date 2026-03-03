import { describe, it, expect } from "vitest";
import {
  normalizePathForComparison,
  isPathInsideBase,
  isSamePath
} from "./path-utils";

describe("normalizePathForComparison", () => {
  it("converts backslashes to forward slashes", () => {
    expect(normalizePathForComparison("src\\utils\\file.ts")).toBe("src/utils/file.ts");
  });

  it("collapses multiple slashes", () => {
    expect(normalizePathForComparison("src///utils//file.ts")).toBe("src/utils/file.ts");
  });

  it("removes trailing slashes", () => {
    expect(normalizePathForComparison("src/utils/")).toBe("src/utils");
  });

  it("preserves root path /", () => {
    expect(normalizePathForComparison("/")).toBe("/");
  });

  it("lowercases Windows drive letter paths", () => {
    expect(normalizePathForComparison("C:\\Users\\project")).toBe("c:/users/project");
  });

  it("lowercases mixed-case Windows paths", () => {
    expect(normalizePathForComparison("D:/Projects/Life")).toBe("d:/projects/life");
  });

  it("does not lowercase Unix absolute paths", () => {
    expect(normalizePathForComparison("/Home/User/Project")).toBe("/Home/User/Project");
  });

  it("handles mixed separators with trailing slash", () => {
    expect(normalizePathForComparison("C:\\project\\src\\")).toBe("c:/project/src");
  });

  it("handles empty-like path after removing trailing slash", () => {
    expect(normalizePathForComparison("//")).toBe("/");
  });
});

describe("isPathInsideBase", () => {
  it("returns true when target equals base", () => {
    expect(isPathInsideBase("/project", "/project")).toBe(true);
  });

  it("returns true when target is nested inside base", () => {
    expect(isPathInsideBase("/project", "/project/src/file.ts")).toBe(true);
  });

  it("returns false when target is outside base", () => {
    expect(isPathInsideBase("/project", "/other/file.ts")).toBe(false);
  });

  it("returns false when target is a sibling with matching prefix", () => {
    expect(isPathInsideBase("/project", "/project-other/file.ts")).toBe(false);
  });

  it("handles root base path", () => {
    expect(isPathInsideBase("/", "/anything/nested")).toBe(true);
  });

  it("handles Windows paths case-insensitively", () => {
    expect(isPathInsideBase("C:\\Project", "c:\\project\\src\\file.ts")).toBe(true);
  });

  it("handles trailing slashes in base path", () => {
    expect(isPathInsideBase("/project/", "/project/src")).toBe(true);
  });

  it("returns false for completely unrelated paths", () => {
    expect(isPathInsideBase("/a/b/c", "/x/y/z")).toBe(false);
  });
});

describe("isSamePath", () => {
  it("returns true for identical paths", () => {
    expect(isSamePath("/project/src", "/project/src")).toBe(true);
  });

  it("returns true for paths with different separators", () => {
    expect(isSamePath("C:\\project\\src", "C:/project/src")).toBe(true);
  });

  it("returns true for Windows paths differing only in case", () => {
    expect(isSamePath("C:\\Project\\SRC", "c:/project/src")).toBe(true);
  });

  it("returns false for different paths", () => {
    expect(isSamePath("/project/src", "/project/dist")).toBe(false);
  });

  it("ignores trailing slashes", () => {
    expect(isSamePath("/project/src/", "/project/src")).toBe(true);
  });
});
