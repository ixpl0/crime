import { describe, it, expect } from "vitest";
import {
  getToolbarButtonColorClass,
  getToolbarButtonCustomStyle
} from "./toolbar-button-styles";

describe("getToolbarButtonColorClass", () => {
  it.each([
    ["primary", "btn-primary"],
    ["secondary", "btn-secondary"],
    ["accent", "btn-accent"],
    ["info", "btn-info"],
    ["success", "btn-success"],
    ["warning", "btn-warning"],
    ["error", "btn-error"],
    ["neutral", "btn-neutral"],
    ["ghost", "btn-ghost"]
  ] as const)("returns '%s' class for preset color '%s'", (color, expected) => {
    expect(getToolbarButtonColorClass(color)).toBe(expected);
  });

  it("returns empty string for hex color", () => {
    expect(getToolbarButtonColorClass("#ff0000")).toBe("");
  });

  it("returns empty string for oklch color", () => {
    expect(getToolbarButtonColorClass("oklch(0.8 0.15 200)")).toBe("");
  });

  it("returns empty string when color is undefined", () => {
    expect(getToolbarButtonColorClass(undefined)).toBe("");
  });
});

describe("getToolbarButtonCustomStyle", () => {
  it("returns undefined for preset color", () => {
    expect(getToolbarButtonCustomStyle("primary")).toBeUndefined();
  });

  it("returns undefined when color is undefined", () => {
    expect(getToolbarButtonCustomStyle(undefined)).toBeUndefined();
  });

  it("returns custom style with contrasting text for dark hex color", () => {
    const style = getToolbarButtonCustomStyle("#000000");
    expect(style).toEqual({
      "--btn-color": "#000000",
      "--btn-fg": "#ffffff"
    });
  });

  it("returns custom style with contrasting text for light hex color", () => {
    const style = getToolbarButtonCustomStyle("#ffffff");
    expect(style).toEqual({
      "--btn-color": "#ffffff",
      "--btn-fg": "#000000"
    });
  });

  it("handles shorthand hex colors", () => {
    const style = getToolbarButtonCustomStyle("#fff");
    expect(style).toEqual({
      "--btn-color": "#fff",
      "--btn-fg": "#000000"
    });
  });

  it("returns white text for dark oklch color", () => {
    const style = getToolbarButtonCustomStyle("oklch(0.3 0.15 200)");
    expect(style).toEqual({
      "--btn-color": "oklch(0.3 0.15 200)",
      "--btn-fg": "#ffffff"
    });
  });

  it("returns black text for light oklch color", () => {
    const style = getToolbarButtonCustomStyle("oklch(0.8 0.15 200)");
    expect(style).toEqual({
      "--btn-color": "oklch(0.8 0.15 200)",
      "--btn-fg": "#000000"
    });
  });

  it("returns white text for medium-dark hex color", () => {
    // #333333 is dark — should get white text
    const style = getToolbarButtonCustomStyle("#333333");
    expect(style?.["--btn-fg"]).toBe("#ffffff");
  });

  it("returns black text for medium-light hex color", () => {
    // #cccccc is light — should get black text
    const style = getToolbarButtonCustomStyle("#cccccc");
    expect(style?.["--btn-fg"]).toBe("#000000");
  });
});
