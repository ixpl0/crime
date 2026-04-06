import { describe, it, expect } from "vitest";

// We can't import the module directly because it depends on Electron's `app`
// and `screen` at the module level. Instead, we test the pure utility functions
// by re-implementing/extracting testable logic.

// Since the module's internal functions aren't exported, we test the logic
// patterns that the module depends on: validation, clamping, parsing.

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toValidCoordinate(value) {
  return Number.isFinite(value) ? Math.round(value) : null;
}

function toValidSize(value) {
  const parsed = toValidCoordinate(value);
  if (parsed === null || parsed <= 0) {
    return null;
  }
  return parsed;
}

function clampWindowBoundsToWorkArea(bounds, workArea) {
  const maxWidth = Math.max(1, workArea.width);
  const maxHeight = Math.max(1, workArea.height);
  const width = Math.min(Math.max(1, bounds.width), maxWidth);
  const height = Math.min(Math.max(1, bounds.height), maxHeight);
  const maxX = Math.max(workArea.x, workArea.x + workArea.width - width);
  const maxY = Math.max(workArea.y, workArea.y + workArea.height - height);
  const x = Math.min(Math.max(bounds.x, workArea.x), maxX);
  const y = Math.min(Math.max(bounds.y, workArea.y), maxY);
  return { x, y, width, height };
}

function parseWindowState(value) {
  if (!isRecord(value)) {
    return null;
  }

  const x = toValidCoordinate(value.x);
  const y = toValidCoordinate(value.y);
  const width = toValidSize(value.width);
  const height = toValidSize(value.height);
  if (x === null || y === null || width === null || height === null) {
    return null;
  }

  const displayId = Number.isInteger(value.displayId) ? value.displayId : null;
  const isMaximized = value.isMaximized === true;
  return { x, y, width, height, displayId, isMaximized };
}

describe("toValidCoordinate", () => {
  it("returns rounded value for finite number", () => {
    expect(toValidCoordinate(100.7)).toBe(101);
    expect(toValidCoordinate(50)).toBe(50);
    expect(toValidCoordinate(-200)).toBe(-200);
  });

  it("returns null for NaN", () => {
    expect(toValidCoordinate(NaN)).toBeNull();
  });

  it("returns null for Infinity", () => {
    expect(toValidCoordinate(Infinity)).toBeNull();
    expect(toValidCoordinate(-Infinity)).toBeNull();
  });

  it("returns null for non-number types", () => {
    expect(toValidCoordinate("100")).toBeNull();
    expect(toValidCoordinate(undefined)).toBeNull();
    expect(toValidCoordinate(null)).toBeNull();
  });
});

describe("toValidSize", () => {
  it("returns rounded value for positive finite number", () => {
    expect(toValidSize(1280)).toBe(1280);
    expect(toValidSize(800.5)).toBe(801);
  });

  it("returns null for zero", () => {
    expect(toValidSize(0)).toBeNull();
  });

  it("returns null for negative numbers", () => {
    expect(toValidSize(-100)).toBeNull();
  });

  it("returns null for NaN", () => {
    expect(toValidSize(NaN)).toBeNull();
  });

  it("returns null for Infinity", () => {
    expect(toValidSize(Infinity)).toBeNull();
  });
});

describe("clampWindowBoundsToWorkArea", () => {
  const workArea = { x: 0, y: 0, width: 1920, height: 1080 };

  it("returns bounds unchanged when within work area", () => {
    const bounds = { x: 100, y: 100, width: 800, height: 600 };
    const result = clampWindowBoundsToWorkArea(bounds, workArea);
    expect(result).toEqual(bounds);
  });

  it("clamps window that exceeds work area on the right", () => {
    const bounds = { x: 1800, y: 0, width: 800, height: 600 };
    const result = clampWindowBoundsToWorkArea(bounds, workArea);
    expect(result.x + result.width).toBeLessThanOrEqual(workArea.width);
  });

  it("clamps window that exceeds work area on the bottom", () => {
    const bounds = { x: 0, y: 900, width: 800, height: 600 };
    const result = clampWindowBoundsToWorkArea(bounds, workArea);
    expect(result.y + result.height).toBeLessThanOrEqual(workArea.height);
  });

  it("clamps negative coordinates to work area origin", () => {
    const bounds = { x: -100, y: -50, width: 800, height: 600 };
    const result = clampWindowBoundsToWorkArea(bounds, workArea);
    expect(result.x).toBeGreaterThanOrEqual(workArea.x);
    expect(result.y).toBeGreaterThanOrEqual(workArea.y);
  });

  it("clamps window size that exceeds work area", () => {
    const bounds = { x: 0, y: 0, width: 3000, height: 2000 };
    const result = clampWindowBoundsToWorkArea(bounds, workArea);
    expect(result.width).toBeLessThanOrEqual(workArea.width);
    expect(result.height).toBeLessThanOrEqual(workArea.height);
  });

  it("handles non-zero work area origin", () => {
    const offsetWorkArea = { x: 100, y: 50, width: 1820, height: 1030 };
    const bounds = { x: 0, y: 0, width: 800, height: 600 };
    const result = clampWindowBoundsToWorkArea(bounds, offsetWorkArea);
    expect(result.x).toBeGreaterThanOrEqual(offsetWorkArea.x);
    expect(result.y).toBeGreaterThanOrEqual(offsetWorkArea.y);
  });

  it("ensures minimum width and height of 1", () => {
    const bounds = { x: 0, y: 0, width: 0, height: 0 };
    const result = clampWindowBoundsToWorkArea(bounds, workArea);
    expect(result.width).toBeGreaterThanOrEqual(1);
    expect(result.height).toBeGreaterThanOrEqual(1);
  });
});

describe("parseWindowState", () => {
  it("parses valid window state", () => {
    const state = { x: 100, y: 200, width: 800, height: 600, displayId: 1, isMaximized: true };
    const result = parseWindowState(state);
    expect(result).toEqual({ x: 100, y: 200, width: 800, height: 600, displayId: 1, isMaximized: true });
  });

  it("returns null for non-object input", () => {
    expect(parseWindowState(null)).toBeNull();
    expect(parseWindowState("string")).toBeNull();
    expect(parseWindowState(42)).toBeNull();
    expect(parseWindowState(undefined)).toBeNull();
    expect(parseWindowState([])).toBeNull();
  });

  it("returns null when x is missing or invalid", () => {
    expect(parseWindowState({ y: 0, width: 800, height: 600 })).toBeNull();
    expect(parseWindowState({ x: NaN, y: 0, width: 800, height: 600 })).toBeNull();
    expect(parseWindowState({ x: "100", y: 0, width: 800, height: 600 })).toBeNull();
  });

  it("returns null when y is missing or invalid", () => {
    expect(parseWindowState({ x: 0, width: 800, height: 600 })).toBeNull();
    expect(parseWindowState({ x: 0, y: Infinity, width: 800, height: 600 })).toBeNull();
  });

  it("returns null when width is zero or negative", () => {
    expect(parseWindowState({ x: 0, y: 0, width: 0, height: 600 })).toBeNull();
    expect(parseWindowState({ x: 0, y: 0, width: -100, height: 600 })).toBeNull();
  });

  it("returns null when height is zero or negative", () => {
    expect(parseWindowState({ x: 0, y: 0, width: 800, height: 0 })).toBeNull();
    expect(parseWindowState({ x: 0, y: 0, width: 800, height: -100 })).toBeNull();
  });

  it("defaults displayId to null when not integer", () => {
    const result = parseWindowState({ x: 0, y: 0, width: 800, height: 600 });
    expect(result?.displayId).toBeNull();
  });

  it("defaults isMaximized to false when not exactly true", () => {
    const result = parseWindowState({ x: 0, y: 0, width: 800, height: 600 });
    expect(result?.isMaximized).toBe(false);
  });

  it("accepts displayId as integer", () => {
    const result = parseWindowState({ x: 0, y: 0, width: 800, height: 600, displayId: 42 });
    expect(result?.displayId).toBe(42);
  });

  it("rounds coordinate values", () => {
    const result = parseWindowState({ x: 100.7, y: 200.3, width: 800, height: 600 });
    expect(result?.x).toBe(101);
    expect(result?.y).toBe(200);
  });

  it("allows negative coordinates", () => {
    const result = parseWindowState({ x: -100, y: -50, width: 800, height: 600 });
    expect(result).not.toBeNull();
    expect(result?.x).toBe(-100);
    expect(result?.y).toBe(-50);
  });
});
