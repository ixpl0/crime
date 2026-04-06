import { describe, it, expect } from "vitest";
import { parseConflictRegions, hasConflictMarkers } from "./conflict-decorations";

describe("hasConflictMarkers", () => {
  it("returns true when all markers present", () => {
    const content = "before\n<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> branch\nafter";
    expect(hasConflictMarkers(content)).toBe(true);
  });

  it("returns false for normal content", () => {
    expect(hasConflictMarkers("normal file content")).toBe(false);
  });

  it("returns false when only some markers present", () => {
    expect(hasConflictMarkers("<<<<<<< HEAD\nsome text")).toBe(false);
    expect(hasConflictMarkers("=======\n>>>>>>>")).toBe(false);
  });
});

describe("parseConflictRegions", () => {
  it("returns empty array for content without conflicts", () => {
    expect(parseConflictRegions("normal\ncontent")).toEqual([]);
  });

  it("parses single conflict region", () => {
    const content = "before\n<<<<<<< HEAD\nour line\n=======\ntheir line\n>>>>>>> branch\nafter";
    const regions = parseConflictRegions(content);
    expect(regions).toHaveLength(1);
    expect(regions[0]).toEqual({
      oursStartLine: 1,
      separatorLine: 3,
      theirsEndLine: 5
    });
  });

  it("parses multiple conflict regions", () => {
    const content = [
      "<<<<<<< HEAD",
      "ours1",
      "=======",
      "theirs1",
      ">>>>>>> branch",
      "middle",
      "<<<<<<< HEAD",
      "ours2",
      "=======",
      "theirs2",
      ">>>>>>> branch"
    ].join("\n");
    const regions = parseConflictRegions(content);
    expect(regions).toHaveLength(2);
    expect(regions[0]).toEqual({ oursStartLine: 0, separatorLine: 2, theirsEndLine: 4 });
    expect(regions[1]).toEqual({ oursStartLine: 6, separatorLine: 8, theirsEndLine: 10 });
  });

  it("handles multi-line ours and theirs sections", () => {
    const content = [
      "<<<<<<< HEAD",
      "our line 1",
      "our line 2",
      "our line 3",
      "=======",
      "their line 1",
      "their line 2",
      ">>>>>>> feature"
    ].join("\n");
    const regions = parseConflictRegions(content);
    expect(regions).toHaveLength(1);
    expect(regions[0]).toEqual({ oursStartLine: 0, separatorLine: 4, theirsEndLine: 7 });
  });

  it("ignores incomplete conflict markers (no end marker)", () => {
    const content = "<<<<<<< HEAD\nours\n=======\ntheirs";
    expect(parseConflictRegions(content)).toEqual([]);
  });

  it("ignores separator without start marker", () => {
    const content = "=======\ntheirs\n>>>>>>> branch";
    expect(parseConflictRegions(content)).toEqual([]);
  });

  it("handles markers with leading whitespace", () => {
    const content = "  <<<<<<< HEAD\n  ours\n  =======\n  theirs\n  >>>>>>> branch";
    const regions = parseConflictRegions(content);
    expect(regions).toHaveLength(1);
  });
});
