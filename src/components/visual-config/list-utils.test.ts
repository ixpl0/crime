import { describe, it, expect } from "vitest";
import { moveItemUp, moveItemDown, removeItem } from "./list-utils";

describe("moveItemUp", () => {
  it("swaps item with the one above", () => {
    expect(moveItemUp(["a", "b", "c"], 1)).toEqual(["b", "a", "c"]);
  });

  it("moves last item up one position", () => {
    expect(moveItemUp(["a", "b", "c"], 2)).toEqual(["a", "c", "b"]);
  });

  it("returns same array reference when index is 0", () => {
    const items = ["a", "b", "c"];
    expect(moveItemUp(items, 0)).toBe(items);
  });

  it("returns same array reference when index is negative", () => {
    const items = ["a", "b"];
    expect(moveItemUp(items, -1)).toBe(items);
  });

  it("works with single-element array at index 0", () => {
    const items = ["only"];
    expect(moveItemUp(items, 0)).toBe(items);
  });

  it("does not mutate the original array", () => {
    const items = ["a", "b", "c"];
    moveItemUp(items, 1);
    expect(items).toEqual(["a", "b", "c"]);
  });
});

describe("moveItemDown", () => {
  it("swaps item with the one below", () => {
    expect(moveItemDown(["a", "b", "c"], 0)).toEqual(["b", "a", "c"]);
  });

  it("swaps middle item down", () => {
    expect(moveItemDown(["a", "b", "c"], 1)).toEqual(["a", "c", "b"]);
  });

  it("returns same array reference when index is last", () => {
    const items = ["a", "b", "c"];
    expect(moveItemDown(items, 2)).toBe(items);
  });

  it("returns same array reference when index exceeds length", () => {
    const items = ["a", "b"];
    expect(moveItemDown(items, 5)).toBe(items);
  });

  it("does not mutate the original array", () => {
    const items = ["a", "b", "c"];
    moveItemDown(items, 0);
    expect(items).toEqual(["a", "b", "c"]);
  });
});

describe("removeItem", () => {
  it("removes item at given index", () => {
    expect(removeItem(["a", "b", "c"], 1)).toEqual(["a", "c"]);
  });

  it("removes first item", () => {
    expect(removeItem(["a", "b", "c"], 0)).toEqual(["b", "c"]);
  });

  it("removes last item", () => {
    expect(removeItem(["a", "b", "c"], 2)).toEqual(["a", "b"]);
  });

  it("returns array with all items when index is out of range", () => {
    expect(removeItem(["a", "b"], 5)).toEqual(["a", "b"]);
  });

  it("returns empty array when removing only item", () => {
    expect(removeItem(["only"], 0)).toEqual([]);
  });

  it("does not mutate the original array", () => {
    const items = ["a", "b", "c"];
    removeItem(items, 1);
    expect(items).toEqual(["a", "b", "c"]);
  });
});
