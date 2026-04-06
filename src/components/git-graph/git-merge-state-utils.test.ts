import { describe, it, expect } from "vitest";
import { getMergeStateLabel, getConflictCountWord, getMergeAbortCommand } from "./git-merge-state-utils";

describe("getMergeStateLabel", () => {
  it("returns non-empty label for merge state", () => {
    const label = getMergeStateLabel("merge", false);
    expect(label.length).toBeGreaterThan(0);
    expect(label.toLowerCase()).toContain("merge");
  });

  it("returns non-empty label for rebase state", () => {
    const label = getMergeStateLabel("rebase", false);
    expect(label.length).toBeGreaterThan(0);
    expect(label.toLowerCase()).toContain("rebase");
  });

  it("returns non-empty label for cherry-pick state", () => {
    const label = getMergeStateLabel("cherry-pick", false);
    expect(label.length).toBeGreaterThan(0);
    expect(label.toLowerCase()).toContain("cherry-pick");
  });

  it("returns non-empty label when state is none and has stash conflicts", () => {
    expect(getMergeStateLabel("none", true).length).toBeGreaterThan(0);
  });

  it("returns empty string when state is none and no stash conflicts", () => {
    expect(getMergeStateLabel("none", false)).toBe("");
  });

  it("returns different labels for different states", () => {
    const mergeLabel = getMergeStateLabel("merge", false);
    const rebaseLabel = getMergeStateLabel("rebase", false);
    const cherryPickLabel = getMergeStateLabel("cherry-pick", false);
    expect(mergeLabel).not.toBe(rebaseLabel);
    expect(mergeLabel).not.toBe(cherryPickLabel);
    expect(rebaseLabel).not.toBe(cherryPickLabel);
  });
});

describe("getConflictCountWord", () => {
  it("returns consistent form for count 1 (singular)", () => {
    const word1 = getConflictCountWord(1);
    expect(getConflictCountWord(21)).toBe(word1);
    expect(getConflictCountWord(31)).toBe(word1);
    expect(getConflictCountWord(101)).toBe(word1);
  });

  it("returns consistent form for counts 2-4 (genitive singular)", () => {
    const word2 = getConflictCountWord(2);
    expect(getConflictCountWord(3)).toBe(word2);
    expect(getConflictCountWord(4)).toBe(word2);
    expect(getConflictCountWord(22)).toBe(word2);
    expect(getConflictCountWord(33)).toBe(word2);
  });

  it("returns consistent form for counts 5-20 (genitive plural)", () => {
    const word5 = getConflictCountWord(5);
    expect(getConflictCountWord(0)).toBe(word5);
    expect(getConflictCountWord(6)).toBe(word5);
    expect(getConflictCountWord(11)).toBe(word5);
    expect(getConflictCountWord(12)).toBe(word5);
    expect(getConflictCountWord(15)).toBe(word5);
    expect(getConflictCountWord(20)).toBe(word5);
  });

  it("returns three distinct word forms", () => {
    const forms = new Set([
      getConflictCountWord(1),
      getConflictCountWord(2),
      getConflictCountWord(5)
    ]);
    expect(forms.size).toBe(3);
  });

  it("handles teen numbers as plural (11-19)", () => {
    const pluralForm = getConflictCountWord(5);
    for (let i = 11; i <= 19; i++) {
      expect(getConflictCountWord(i)).toBe(pluralForm);
    }
  });
});

describe("getMergeAbortCommand", () => {
  it("returns rebase for rebase state", () => {
    expect(getMergeAbortCommand("rebase")).toBe("rebase");
  });

  it("returns cherry-pick for cherry-pick state", () => {
    expect(getMergeAbortCommand("cherry-pick")).toBe("cherry-pick");
  });

  it("returns merge for merge state", () => {
    expect(getMergeAbortCommand("merge")).toBe("merge");
  });

  it("returns merge for none state", () => {
    expect(getMergeAbortCommand("none")).toBe("merge");
  });
});
