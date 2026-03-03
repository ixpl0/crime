import { describe, it, expect } from "vitest";
import {
  isRecord,
  parseVersionedStringEntries,
  toVersionedStringEntriesPayload
} from "./settings-storage-helpers";

describe("isRecord", () => {
  it("returns true for plain object", () => {
    expect(isRecord({})).toBe(true);
  });

  it("returns true for object with properties", () => {
    expect(isRecord({ a: 1, b: "two" })).toBe(true);
  });

  it("returns false for null", () => {
    expect(isRecord(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isRecord(undefined)).toBe(false);
  });

  it("returns false for array", () => {
    expect(isRecord([1, 2, 3])).toBe(false);
  });

  it("returns false for string", () => {
    expect(isRecord("hello")).toBe(false);
  });

  it("returns false for number", () => {
    expect(isRecord(42)).toBe(false);
  });

  it("returns false for boolean", () => {
    expect(isRecord(true)).toBe(false);
  });
});

describe("parseVersionedStringEntries", () => {
  describe("versioned format (object with version and entries)", () => {
    it("parses valid versioned payload", () => {
      const result = parseVersionedStringEntries({
        version: 1,
        entries: ["a", "b", "c"]
      });
      expect(result).toEqual(["a", "b", "c"]);
    });

    it("returns null for wrong version", () => {
      const result = parseVersionedStringEntries({
        version: 2,
        entries: ["a", "b"]
      });
      expect(result).toBeNull();
    });

    it("returns null for missing entries", () => {
      const result = parseVersionedStringEntries({
        version: 1
      });
      expect(result).toBeNull();
    });

    it("returns null when entries is not an array", () => {
      const result = parseVersionedStringEntries({
        version: 1,
        entries: "not-array"
      });
      expect(result).toBeNull();
    });

    it("filters out non-string entries", () => {
      const result = parseVersionedStringEntries({
        version: 1,
        entries: ["valid", 42, null, "also-valid", undefined, true]
      });
      expect(result).toEqual(["valid", "also-valid"]);
    });

    it("returns empty array for empty entries", () => {
      const result = parseVersionedStringEntries({
        version: 1,
        entries: []
      });
      expect(result).toEqual([]);
    });
  });

  describe("legacy format (plain array)", () => {
    it("parses plain string array", () => {
      const result = parseVersionedStringEntries(["x", "y", "z"]);
      expect(result).toEqual(["x", "y", "z"]);
    });

    it("filters non-string values from plain array", () => {
      const result = parseVersionedStringEntries(["a", 1, null, "b"]);
      expect(result).toEqual(["a", "b"]);
    });

    it("returns empty array for empty array", () => {
      const result = parseVersionedStringEntries([]);
      expect(result).toEqual([]);
    });
  });

  describe("invalid inputs", () => {
    it("returns null for null", () => {
      expect(parseVersionedStringEntries(null)).toBeNull();
    });

    it("returns null for undefined", () => {
      expect(parseVersionedStringEntries(undefined)).toBeNull();
    });

    it("returns null for string", () => {
      expect(parseVersionedStringEntries("hello")).toBeNull();
    });

    it("returns null for number", () => {
      expect(parseVersionedStringEntries(42)).toBeNull();
    });

    it("returns null for object without version or entries", () => {
      expect(parseVersionedStringEntries({ foo: "bar" })).toBeNull();
    });
  });

  describe("limit option", () => {
    it("applies tail limit to versioned entries", () => {
      const result = parseVersionedStringEntries(
        { version: 1, entries: ["a", "b", "c", "d", "e"] },
        { limit: 3 }
      );
      expect(result).toEqual(["c", "d", "e"]);
    });

    it("applies tail limit to plain array", () => {
      const result = parseVersionedStringEntries(
        ["a", "b", "c", "d"],
        { limit: 2 }
      );
      expect(result).toEqual(["c", "d"]);
    });

    it("returns all entries when limit exceeds length", () => {
      const result = parseVersionedStringEntries(
        { version: 1, entries: ["a", "b"] },
        { limit: 10 }
      );
      expect(result).toEqual(["a", "b"]);
    });

    it("returns all entries for limit 0 (slice(-0) === slice(0))", () => {
      const result = parseVersionedStringEntries(
        { version: 1, entries: ["a", "b", "c"] },
        { limit: 0 }
      );
      expect(result).toEqual(["a", "b", "c"]);
    });

    it("ignores negative limit", () => {
      const result = parseVersionedStringEntries(
        { version: 1, entries: ["a", "b"] },
        { limit: -1 }
      );
      expect(result).toEqual(["a", "b"]);
    });

    it("ignores non-integer limit", () => {
      const result = parseVersionedStringEntries(
        { version: 1, entries: ["a", "b", "c"] },
        { limit: 1.5 }
      );
      expect(result).toEqual(["a", "b", "c"]);
    });
  });
});

describe("toVersionedStringEntriesPayload", () => {
  it("creates versioned payload from string array", () => {
    const result = toVersionedStringEntriesPayload(["a", "b", "c"]);
    expect(result).toEqual({
      version: 1,
      entries: ["a", "b", "c"]
    });
  });

  it("creates payload from empty array", () => {
    const result = toVersionedStringEntriesPayload([]);
    expect(result).toEqual({
      version: 1,
      entries: []
    });
  });

  it("applies tail limit", () => {
    const result = toVersionedStringEntriesPayload(
      ["a", "b", "c", "d", "e"],
      { limit: 3 }
    );
    expect(result).toEqual({
      version: 1,
      entries: ["c", "d", "e"]
    });
  });

  it("filters non-string entries from input", () => {
    const input = ["valid", 42, "also-valid"] as unknown as string[];
    const result = toVersionedStringEntriesPayload(input);
    expect(result).toEqual({
      version: 1,
      entries: ["valid", "also-valid"]
    });
  });
});
