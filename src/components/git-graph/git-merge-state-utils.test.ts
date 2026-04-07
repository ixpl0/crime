import { describe, it, expect } from "vitest";
import { getMergeStateLabel, getConflictCountWord, getMergeAbortCommand, canContinueState } from "./git-merge-state-utils";

const ALL_STATES: GitMergeStateKind[] = ["merge", "squash-merge", "rebase", "cherry-pick", "revert", "am", "bisect"];

describe("getMergeStateLabel", () => {
  it.each(ALL_STATES)("returns non-empty label for %s state", (state) => {
    expect(getMergeStateLabel(state, false).length).toBeGreaterThan(0);
  });

  it("returns non-empty label when state is none and has stash conflicts", () => {
    expect(getMergeStateLabel("none", true).length).toBeGreaterThan(0);
  });

  it("returns empty string when state is none and no stash conflicts", () => {
    expect(getMergeStateLabel("none", false)).toBe("");
  });

  it("returns unique labels for all non-none states", () => {
    const labels = ALL_STATES.map((state) => getMergeStateLabel(state, false));
    expect(new Set(labels).size).toBe(ALL_STATES.length);
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
  it.each([
    ["rebase", "rebase"],
    ["cherry-pick", "cherry-pick"],
    ["merge", "merge"],
    ["revert", "revert"],
    ["am", "am"],
    ["squash-merge", "reset --merge"],
    ["bisect", "bisect reset"]
  ] as const)("returns correct command for %s state", (state, expected) => {
    expect(getMergeAbortCommand(state as GitMergeStateKind)).toBe(expected);
  });

  it("returns merge for none state", () => {
    expect(getMergeAbortCommand("none")).toBe("merge");
  });
});

describe("canContinueState", () => {
  it.each(["merge", "squash-merge", "rebase", "cherry-pick", "revert", "am"] as const)(
    "returns true for %s",
    (state) => {
      expect(canContinueState(state)).toBe(true);
    }
  );

  it.each(["none", "bisect"] as const)(
    "returns false for %s",
    (state) => {
      expect(canContinueState(state)).toBe(false);
    }
  );
});
