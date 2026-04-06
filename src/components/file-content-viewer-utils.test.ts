import { describe, it, expect } from "vitest";
import { toContextDiffLines, diffLinePrefix } from "./file-content-viewer-utils";

describe("toContextDiffLines", () => {
  it("converts single line to context diff line", () => {
    const result = toContextDiffLines("hello world");
    expect(result).toEqual([{ type: "context", text: "hello world" }]);
  });

  it("splits multi-line content into separate context lines", () => {
    const result = toContextDiffLines("line1\nline2\nline3");
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ type: "context", text: "line1" });
    expect(result[1]).toEqual({ type: "context", text: "line2" });
    expect(result[2]).toEqual({ type: "context", text: "line3" });
  });

  it("handles Windows line endings (CRLF)", () => {
    const result = toContextDiffLines("line1\r\nline2\r\nline3");
    expect(result).toHaveLength(3);
    expect(result[0].text).toBe("line1");
  });

  it("strips trailing empty line (trailing newline)", () => {
    const result = toContextDiffLines("line1\nline2\n");
    expect(result).toHaveLength(2);
    expect(result[1].text).toBe("line2");
  });

  it("returns empty array for empty string", () => {
    const result = toContextDiffLines("");
    expect(result).toEqual([]);
  });

  it("preserves empty lines in the middle", () => {
    const result = toContextDiffLines("a\n\nb");
    expect(result).toHaveLength(3);
    expect(result[1].text).toBe("");
  });

  it("all lines have type context", () => {
    const result = toContextDiffLines("a\nb\nc");
    expect(result.every((line) => line.type === "context")).toBe(true);
  });
});

describe("diffLinePrefix", () => {
  it("returns + for added lines", () => {
    expect(diffLinePrefix("added")).toBe("+");
  });

  it("returns - for removed lines", () => {
    expect(diffLinePrefix("removed")).toBe("-");
  });

  it("returns empty string for context lines", () => {
    expect(diffLinePrefix("context")).toBe("");
  });
});
