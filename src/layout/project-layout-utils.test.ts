import { describe, it, expect } from "vitest";
import {
  normalizeIdeZoomFactor,
  normalizeTerminalFontSize,
  normalizeProjectZoomSettings,
  isTerminalZoomResetShortcut
} from "./project-layout-utils";
import {
  IDE_ZOOM_FACTOR_MIN,
  IDE_ZOOM_FACTOR_MAX,
  TERMINAL_FONT_SIZE_MIN,
  TERMINAL_FONT_SIZE_MAX
} from "../settings/project-settings-storage";

describe("normalizeIdeZoomFactor", () => {
  it("returns value within range unchanged", () => {
    expect(normalizeIdeZoomFactor(1)).toBe(1);
    expect(normalizeIdeZoomFactor(1.5)).toBe(1.5);
    expect(normalizeIdeZoomFactor(2)).toBe(2);
  });

  it("clamps values below minimum to minimum", () => {
    expect(normalizeIdeZoomFactor(0)).toBe(IDE_ZOOM_FACTOR_MIN);
    expect(normalizeIdeZoomFactor(-1)).toBe(IDE_ZOOM_FACTOR_MIN);
    expect(normalizeIdeZoomFactor(IDE_ZOOM_FACTOR_MIN - 0.01)).toBe(IDE_ZOOM_FACTOR_MIN);
  });

  it("clamps values above maximum to maximum", () => {
    expect(normalizeIdeZoomFactor(100)).toBe(IDE_ZOOM_FACTOR_MAX);
    expect(normalizeIdeZoomFactor(IDE_ZOOM_FACTOR_MAX + 1)).toBe(IDE_ZOOM_FACTOR_MAX);
  });

  it("rounds to 2 decimal places", () => {
    expect(normalizeIdeZoomFactor(1.555)).toBe(1.56);
    expect(normalizeIdeZoomFactor(1.234)).toBe(1.23);
    expect(normalizeIdeZoomFactor(1.999)).toBe(2);
  });

  it("handles boundary values exactly", () => {
    expect(normalizeIdeZoomFactor(IDE_ZOOM_FACTOR_MIN)).toBe(IDE_ZOOM_FACTOR_MIN);
    expect(normalizeIdeZoomFactor(IDE_ZOOM_FACTOR_MAX)).toBe(IDE_ZOOM_FACTOR_MAX);
  });
});

describe("normalizeTerminalFontSize", () => {
  it("returns integer value within range unchanged", () => {
    expect(normalizeTerminalFontSize(14)).toBe(14);
    expect(normalizeTerminalFontSize(20)).toBe(20);
  });

  it("clamps values below minimum to minimum", () => {
    expect(normalizeTerminalFontSize(1)).toBe(TERMINAL_FONT_SIZE_MIN);
    expect(normalizeTerminalFontSize(0)).toBe(TERMINAL_FONT_SIZE_MIN);
    expect(normalizeTerminalFontSize(-5)).toBe(TERMINAL_FONT_SIZE_MIN);
  });

  it("clamps values above maximum to maximum", () => {
    expect(normalizeTerminalFontSize(100)).toBe(TERMINAL_FONT_SIZE_MAX);
    expect(normalizeTerminalFontSize(TERMINAL_FONT_SIZE_MAX + 1)).toBe(TERMINAL_FONT_SIZE_MAX);
  });

  it("rounds to nearest integer", () => {
    expect(normalizeTerminalFontSize(14.3)).toBe(14);
    expect(normalizeTerminalFontSize(14.7)).toBe(15);
    expect(normalizeTerminalFontSize(14.5)).toBe(15);
  });

  it("handles boundary values exactly", () => {
    expect(normalizeTerminalFontSize(TERMINAL_FONT_SIZE_MIN)).toBe(TERMINAL_FONT_SIZE_MIN);
    expect(normalizeTerminalFontSize(TERMINAL_FONT_SIZE_MAX)).toBe(TERMINAL_FONT_SIZE_MAX);
  });
});

describe("normalizeProjectZoomSettings", () => {
  it("normalizes both zoom factor and font size", () => {
    const result = normalizeProjectZoomSettings({
      ideZoomFactor: 1.555,
      terminalFontSize: 14.7
    });
    expect(result.ideZoomFactor).toBe(1.56);
    expect(result.terminalFontSize).toBe(15);
  });

  it("clamps out-of-range values", () => {
    const result = normalizeProjectZoomSettings({
      ideZoomFactor: -1,
      terminalFontSize: 999
    });
    expect(result.ideZoomFactor).toBe(IDE_ZOOM_FACTOR_MIN);
    expect(result.terminalFontSize).toBe(TERMINAL_FONT_SIZE_MAX);
  });

  it("passes through valid values", () => {
    const result = normalizeProjectZoomSettings({
      ideZoomFactor: 1.5,
      terminalFontSize: 16
    });
    expect(result.ideZoomFactor).toBe(1.5);
    expect(result.terminalFontSize).toBe(16);
  });
});

const createKeyboardEvent = (overrides: Partial<KeyboardEvent> = {}): KeyboardEvent =>
  ({
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    code: "",
    ...overrides
  }) as unknown as KeyboardEvent;

describe("isTerminalZoomResetShortcut", () => {
  it("returns true for Ctrl+0 (Digit0)", () => {
    expect(isTerminalZoomResetShortcut(createKeyboardEvent({ ctrlKey: true, code: "Digit0" }))).toBe(true);
  });

  it("returns true for Ctrl+Numpad0", () => {
    expect(isTerminalZoomResetShortcut(createKeyboardEvent({ ctrlKey: true, code: "Numpad0" }))).toBe(true);
  });

  it("returns false without Ctrl", () => {
    expect(isTerminalZoomResetShortcut(createKeyboardEvent({ code: "Digit0" }))).toBe(false);
  });

  it("returns false for Ctrl+other keys", () => {
    expect(isTerminalZoomResetShortcut(createKeyboardEvent({ ctrlKey: true, code: "Digit1" }))).toBe(false);
    expect(isTerminalZoomResetShortcut(createKeyboardEvent({ ctrlKey: true, code: "KeyA" }))).toBe(false);
  });

  it("returns false when Meta is also pressed", () => {
    expect(isTerminalZoomResetShortcut(createKeyboardEvent({ ctrlKey: true, metaKey: true, code: "Digit0" }))).toBe(false);
  });

  it("returns false when Alt is also pressed", () => {
    expect(isTerminalZoomResetShortcut(createKeyboardEvent({ ctrlKey: true, altKey: true, code: "Digit0" }))).toBe(false);
  });

  it("returns false when Shift is also pressed", () => {
    expect(isTerminalZoomResetShortcut(createKeyboardEvent({ ctrlKey: true, shiftKey: true, code: "Digit0" }))).toBe(false);
  });
});
