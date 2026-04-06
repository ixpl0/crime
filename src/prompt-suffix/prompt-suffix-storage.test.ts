import { describe, it, expect } from "vitest";
import { parsePromptSuffixConfig } from "./prompt-suffix-storage";

describe("parsePromptSuffixConfig", () => {
  const makeItem = (
    overrides: Record<string, unknown> = {}
  ) => ({
    label: "Test",
    value: "test value",
    mode: "off",
    ...overrides
  });

  describe("valid configs", () => {
    it("parses config with valid items", () => {
      const result = parsePromptSuffixConfig({
        items: [makeItem({ mode: "always" })]
      });
      expect(result).not.toBeNull();
      expect(result?.items).toHaveLength(1);
      expect(result?.items[0].label).toBe("Test");
      expect(result?.items[0].value).toBe("test value");
      expect(result?.items[0].mode).toBe("always");
    });

    it("parses config with version 1", () => {
      const result = parsePromptSuffixConfig({
        version: 1,
        items: [makeItem()]
      });
      expect(result).not.toBeNull();
    });

    it("parses all valid modes", () => {
      const items = [
        makeItem({ mode: "off" }),
        makeItem({ label: "B", mode: "once" }),
        makeItem({ label: "C", mode: "always" })
      ];
      const result = parsePromptSuffixConfig({ items });
      expect(result?.items[0].mode).toBe("off");
      expect(result?.items[1].mode).toBe("once");
      expect(result?.items[2].mode).toBe("always");
    });

    it("parses empty items array", () => {
      const result = parsePromptSuffixConfig({ items: [] });
      expect(result).not.toBeNull();
      expect(result?.items).toHaveLength(0);
    });
  });

  describe("enabled → mode migration", () => {
    it("converts enabled: true to mode: always", () => {
      const result = parsePromptSuffixConfig({
        items: [{ label: "Test", value: "val", enabled: true }]
      });
      expect(result?.items[0].mode).toBe("always");
    });

    it("converts enabled: false to mode: off", () => {
      const result = parsePromptSuffixConfig({
        items: [{ label: "Test", value: "val", enabled: false }]
      });
      expect(result?.items[0].mode).toBe("off");
    });

    it("prefers mode over enabled when both present", () => {
      const result = parsePromptSuffixConfig({
        items: [{ label: "Test", value: "val", mode: "once", enabled: false }]
      });
      expect(result?.items[0].mode).toBe("once");
    });
  });

  describe("invalid inputs", () => {
    it("returns null for non-object input", () => {
      expect(parsePromptSuffixConfig(null)).toBeNull();
      expect(parsePromptSuffixConfig("string")).toBeNull();
      expect(parsePromptSuffixConfig(42)).toBeNull();
      expect(parsePromptSuffixConfig(undefined)).toBeNull();
    });

    it("returns null for wrong version", () => {
      expect(parsePromptSuffixConfig({ version: 2, items: [] })).toBeNull();
      expect(parsePromptSuffixConfig({ version: 0, items: [] })).toBeNull();
    });

    it("returns null when items is not an array", () => {
      expect(parsePromptSuffixConfig({ items: "not-array" })).toBeNull();
      expect(parsePromptSuffixConfig({ items: null })).toBeNull();
      expect(parsePromptSuffixConfig({})).toBeNull();
    });

    it("returns null when item has invalid mode", () => {
      expect(parsePromptSuffixConfig({
        items: [{ label: "X", value: "v", mode: "invalid" }]
      })).toBeNull();
    });

    it("returns null when item has no mode and no enabled", () => {
      expect(parsePromptSuffixConfig({
        items: [{ label: "X", value: "v" }]
      })).toBeNull();
    });

    it("returns null when item label is missing", () => {
      expect(parsePromptSuffixConfig({
        items: [{ value: "v", mode: "off" }]
      })).toBeNull();
    });

    it("returns null when item value is missing", () => {
      expect(parsePromptSuffixConfig({
        items: [{ label: "X", mode: "off" }]
      })).toBeNull();
    });

    it("returns null when any item is invalid", () => {
      expect(parsePromptSuffixConfig({
        items: [makeItem(), { broken: true }]
      })).toBeNull();
    });

    it("returns null when item is not an object", () => {
      expect(parsePromptSuffixConfig({ items: ["string"] })).toBeNull();
      expect(parsePromptSuffixConfig({ items: [null] })).toBeNull();
    });
  });
});
