import { describe, it, expect } from "vitest";
import {
  parseProjectSettings,
  defaultProjectSettings,
  IDE_ZOOM_FACTOR_MIN,
  IDE_ZOOM_FACTOR_MAX,
  TERMINAL_FONT_SIZE_MIN,
  TERMINAL_FONT_SIZE_MAX
} from "./project-settings-storage";

const omit = <T extends Record<string, unknown>, K extends keyof T>(
  object: T,
  ...keys: K[]
): Omit<T, K> => {
  const keySet = new Set<string>(keys as string[]);
  return Object.fromEntries(
    Object.entries(object).filter(([key]) => !keySet.has(key))
  ) as Omit<T, K>;
};

const validSlashCommand = {
  charDelayMs: 20,
  afterSlashDelayMs: 300,
  enterDelayMs: 120,
  activityTimeoutMs: 1200,
  quietTimeoutMs: 2200,
  dataPollIntervalMs: 15
};

const validZoom = {
  ideZoomFactor: 1,
  terminalFontSize: 14
};

const validSettings = {
  version: 1,
  slashCommand: validSlashCommand,
  zoom: validZoom
};

describe("parseProjectSettings", () => {
  describe("valid input", () => {
    it("parses complete valid settings", () => {
      const result = parseProjectSettings(validSettings);
      expect(result).toEqual({
        slashCommand: validSlashCommand,
        zoom: validZoom
      });
    });

    it("parses settings without version field", () => {
      const result = parseProjectSettings(omit(validSettings, "version"));
      expect(result).not.toBeNull();
    });

    it("parses settings with version 1", () => {
      const result = parseProjectSettings({ ...validSettings, version: 1 });
      expect(result).not.toBeNull();
    });

    it("uses default zoom when zoom is absent", () => {
      const result = parseProjectSettings(omit(validSettings, "zoom"));
      expect(result).not.toBeNull();
      expect(result?.zoom).toEqual(defaultProjectSettings.zoom);
    });

  });

  describe("invalid top-level input", () => {
    it("returns null for null", () => {
      expect(parseProjectSettings(null)).toBeNull();
    });

    it("returns null for string", () => {
      expect(parseProjectSettings("settings")).toBeNull();
    });

    it("returns null for array", () => {
      expect(parseProjectSettings([1, 2])).toBeNull();
    });

    it("returns null for wrong version", () => {
      expect(parseProjectSettings({ ...validSettings, version: 2 })).toBeNull();
    });
  });

  describe("slashCommand validation", () => {
    it("returns null when slashCommand is missing", () => {
      expect(parseProjectSettings(omit(validSettings, "slashCommand"))).toBeNull();
    });

    it("returns null when slashCommand is not an object", () => {
      expect(parseProjectSettings({ ...validSettings, slashCommand: "invalid" })).toBeNull();
    });

    it("returns null when charDelayMs is negative", () => {
      expect(parseProjectSettings({
        ...validSettings,
        slashCommand: { ...validSlashCommand, charDelayMs: -1 }
      })).toBeNull();
    });

    it("returns null when activityTimeoutMs is zero", () => {
      expect(parseProjectSettings({
        ...validSettings,
        slashCommand: { ...validSlashCommand, activityTimeoutMs: 0 }
      })).toBeNull();
    });

    it("returns null when quietTimeoutMs is NaN", () => {
      expect(parseProjectSettings({
        ...validSettings,
        slashCommand: { ...validSlashCommand, quietTimeoutMs: NaN }
      })).toBeNull();
    });

    it("returns null when dataPollIntervalMs is Infinity", () => {
      expect(parseProjectSettings({
        ...validSettings,
        slashCommand: { ...validSlashCommand, dataPollIntervalMs: Infinity }
      })).toBeNull();
    });

    it("accepts zero for non-negative delay fields", () => {
      const result = parseProjectSettings({
        ...validSettings,
        slashCommand: { ...validSlashCommand, charDelayMs: 0, afterSlashDelayMs: 0, enterDelayMs: 0 }
      });
      expect(result).not.toBeNull();
      expect(result?.slashCommand.charDelayMs).toBe(0);
    });
  });

  describe("zoom validation", () => {
    it("returns null for zoom factor below minimum", () => {
      expect(parseProjectSettings({
        ...validSettings,
        zoom: { ...validZoom, ideZoomFactor: IDE_ZOOM_FACTOR_MIN - 0.01 }
      })).toBeNull();
    });

    it("returns null for zoom factor above maximum", () => {
      expect(parseProjectSettings({
        ...validSettings,
        zoom: { ...validZoom, ideZoomFactor: IDE_ZOOM_FACTOR_MAX + 0.01 }
      })).toBeNull();
    });

    it("accepts zoom factor at minimum boundary", () => {
      const result = parseProjectSettings({
        ...validSettings,
        zoom: { ...validZoom, ideZoomFactor: IDE_ZOOM_FACTOR_MIN }
      });
      expect(result).not.toBeNull();
      expect(result?.zoom.ideZoomFactor).toBe(IDE_ZOOM_FACTOR_MIN);
    });

    it("accepts zoom factor at maximum boundary", () => {
      const result = parseProjectSettings({
        ...validSettings,
        zoom: { ...validZoom, ideZoomFactor: IDE_ZOOM_FACTOR_MAX }
      });
      expect(result).not.toBeNull();
      expect(result?.zoom.ideZoomFactor).toBe(IDE_ZOOM_FACTOR_MAX);
    });

    it("returns null for non-integer terminal font size", () => {
      expect(parseProjectSettings({
        ...validSettings,
        zoom: { ...validZoom, terminalFontSize: 14.5 }
      })).toBeNull();
    });

    it("returns null for terminal font size below minimum", () => {
      expect(parseProjectSettings({
        ...validSettings,
        zoom: { ...validZoom, terminalFontSize: TERMINAL_FONT_SIZE_MIN - 1 }
      })).toBeNull();
    });

    it("returns null for terminal font size above maximum", () => {
      expect(parseProjectSettings({
        ...validSettings,
        zoom: { ...validZoom, terminalFontSize: TERMINAL_FONT_SIZE_MAX + 1 }
      })).toBeNull();
    });

    it("accepts terminal font size at boundaries", () => {
      const resultMin = parseProjectSettings({
        ...validSettings,
        zoom: { ...validZoom, terminalFontSize: TERMINAL_FONT_SIZE_MIN }
      });
      expect(resultMin?.zoom.terminalFontSize).toBe(TERMINAL_FONT_SIZE_MIN);

      const resultMax = parseProjectSettings({
        ...validSettings,
        zoom: { ...validZoom, terminalFontSize: TERMINAL_FONT_SIZE_MAX }
      });
      expect(resultMax?.zoom.terminalFontSize).toBe(TERMINAL_FONT_SIZE_MAX);
    });

    it("returns null when zoom is present but invalid", () => {
      expect(parseProjectSettings({
        ...validSettings,
        zoom: "invalid"
      })).toBeNull();
    });
  });

});
