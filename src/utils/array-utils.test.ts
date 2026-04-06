import { describe, it, expect } from "vitest";
import { areStringArraysEqual } from "./array-utils";

describe("areStringArraysEqual", () => {
  it("returns true for two empty arrays", () => {
    expect(areStringArraysEqual([], [])).toBe(true);
  });

  it("returns true for identical single-element arrays", () => {
    expect(areStringArraysEqual(["a"], ["a"])).toBe(true);
  });

  it("returns true for identical multi-element arrays", () => {
    expect(areStringArraysEqual(["a", "b", "c"], ["a", "b", "c"])).toBe(true);
  });

  it("returns false when lengths differ", () => {
    expect(areStringArraysEqual(["a"], ["a", "b"])).toBe(false);
  });

  it("returns false when first is longer", () => {
    expect(areStringArraysEqual(["a", "b"], ["a"])).toBe(false);
  });

  it("returns false when elements differ", () => {
    expect(areStringArraysEqual(["a", "b"], ["a", "c"])).toBe(false);
  });

  it("returns false for same elements in different order", () => {
    expect(areStringArraysEqual(["a", "b"], ["b", "a"])).toBe(false);
  });

  it("returns false when comparing empty array to non-empty", () => {
    expect(areStringArraysEqual([], ["a"])).toBe(false);
  });

  it("treats empty strings as valid elements", () => {
    expect(areStringArraysEqual(["", "a"], ["", "a"])).toBe(true);
    expect(areStringArraysEqual(["", "a"], ["a", ""])).toBe(false);
  });
});
