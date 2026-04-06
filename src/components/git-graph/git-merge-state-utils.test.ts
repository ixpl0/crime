import { describe, it, expect } from "vitest";
import { getMergeStateLabel, getConflictCountWord, getMergeAbortCommand } from "./git-merge-state-utils";

describe("getMergeStateLabel", () => {
  it("returns merge label for merge state", () => {
    expect(getMergeStateLabel("merge", false)).toBe("Слияние (merge)");
  });

  it("returns rebase label for rebase state", () => {
    expect(getMergeStateLabel("rebase", false)).toBe("Перебазирование (rebase)");
  });

  it("returns cherry-pick label", () => {
    expect(getMergeStateLabel("cherry-pick", false)).toBe("Cherry-pick");
  });

  it("returns stash conflict label when state is none and has stash conflicts", () => {
    expect(getMergeStateLabel("none", true)).toBe("Конфликты stash");
  });

  it("returns empty string when state is none and no stash conflicts", () => {
    expect(getMergeStateLabel("none", false)).toBe("");
  });
});

describe("getConflictCountWord", () => {
  it("returns singular for 1", () => {
    expect(getConflictCountWord(1)).toBe("конфликт");
  });

  it("returns genitive singular for 2-4", () => {
    expect(getConflictCountWord(2)).toBe("конфликта");
    expect(getConflictCountWord(3)).toBe("конфликта");
    expect(getConflictCountWord(4)).toBe("конфликта");
  });

  it("returns genitive plural for 5-20", () => {
    expect(getConflictCountWord(5)).toBe("конфликтов");
    expect(getConflictCountWord(11)).toBe("конфликтов");
    expect(getConflictCountWord(12)).toBe("конфликтов");
    expect(getConflictCountWord(20)).toBe("конфликтов");
  });

  it("handles 21 correctly (singular)", () => {
    expect(getConflictCountWord(21)).toBe("конфликт");
  });

  it("handles 22 correctly (genitive singular)", () => {
    expect(getConflictCountWord(22)).toBe("конфликта");
  });

  it("handles 0", () => {
    expect(getConflictCountWord(0)).toBe("конфликтов");
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
