import { describe, it, expect } from "vitest";
import {
  getNormalizedTodoDrafts,
  hasTodoDraftPlaceholder,
  getPersistedTodoEntries
} from "./todo-drafts-utils";

describe("getNormalizedTodoDrafts", () => {
  it("returns single empty string for empty array", () => {
    expect(getNormalizedTodoDrafts([])).toEqual([""]);
  });

  it("returns single empty string for array of only whitespace entries", () => {
    expect(getNormalizedTodoDrafts(["", "  ", "\t"])).toEqual([""]);
  });

  it("appends placeholder to non-empty entries by default", () => {
    expect(getNormalizedTodoDrafts(["task 1", "task 2"])).toEqual(["task 1", "task 2", ""]);
  });

  it("filters out empty entries and appends placeholder", () => {
    expect(getNormalizedTodoDrafts(["task 1", "", "task 2", "  "])).toEqual(["task 1", "task 2", ""]);
  });

  it("does not append placeholder when includePlaceholder is false", () => {
    expect(getNormalizedTodoDrafts(["task 1", "task 2"], { includePlaceholder: false }))
      .toEqual(["task 1", "task 2"]);
  });

  it("returns empty string array when all empty and includePlaceholder is false", () => {
    expect(getNormalizedTodoDrafts(["", ""], { includePlaceholder: false })).toEqual([""]);
  });

  it("preserves single non-empty entry with placeholder", () => {
    expect(getNormalizedTodoDrafts(["only task"])).toEqual(["only task", ""]);
  });
});

describe("hasTodoDraftPlaceholder", () => {
  it("returns true when array contains empty string", () => {
    expect(hasTodoDraftPlaceholder(["task", ""])).toBe(true);
  });

  it("returns true when array contains whitespace-only string", () => {
    expect(hasTodoDraftPlaceholder(["task", "  "])).toBe(true);
  });

  it("returns false when all entries have content", () => {
    expect(hasTodoDraftPlaceholder(["task 1", "task 2"])).toBe(false);
  });

  it("returns false for empty array", () => {
    expect(hasTodoDraftPlaceholder([])).toBe(false);
  });
});

describe("getPersistedTodoEntries", () => {
  it("filters out empty entries", () => {
    expect(getPersistedTodoEntries(["task 1", "", "task 2"])).toEqual(["task 1", "task 2"]);
  });

  it("filters out whitespace-only entries", () => {
    expect(getPersistedTodoEntries(["task", "  ", "\t"])).toEqual(["task"]);
  });

  it("returns empty array when all entries are empty", () => {
    expect(getPersistedTodoEntries(["", "  "])).toEqual([]);
  });

  it("returns all entries when none are empty", () => {
    expect(getPersistedTodoEntries(["a", "b", "c"])).toEqual(["a", "b", "c"]);
  });
});
