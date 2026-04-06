import { describe, it, expect, vi, afterEach } from "vitest";
import {
  formatShortHash,
  formatRelativeDate,
  formatFullDate,
  isBranchRef,
  formatRef,
  authorColor,
  refClasses
} from "./git-graph-format";

describe("formatShortHash", () => {
  it("returns first 7 characters", () => {
    expect(formatShortHash("abc123def456")).toBe("abc123d");
  });

  it("returns full hash if shorter than 7", () => {
    expect(formatShortHash("abc")).toBe("abc");
  });

  it("returns exactly 7 characters for 7-char input", () => {
    expect(formatShortHash("abcdefg")).toBe("abcdefg");
  });
});

describe("formatRelativeDate", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns only time for today's date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T18:00:00"));

    const result = formatRelativeDate("2026-04-06T09:05:00");
    expect(result).toBe("09:05");
  });

  it("returns day+month+time for same year", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T18:00:00"));

    const result = formatRelativeDate("2026-03-15T14:30:00");
    expect(result).toBe("15 мар 14:30");
  });

  it("returns full date with year for different year", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T18:00:00"));

    const result = formatRelativeDate("2025-12-01T08:00:00");
    expect(result).toBe("1 дек 2025 08:00");
  });

  it("pads hours and minutes with zeros", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T18:00:00"));

    const result = formatRelativeDate("2026-04-06T03:07:00");
    expect(result).toBe("03:07");
  });

  it("uses correct Russian month names", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00"));

    expect(formatRelativeDate("2026-01-05T10:00:00")).toContain("янв");
    expect(formatRelativeDate("2026-02-05T10:00:00")).toContain("фев");
    expect(formatRelativeDate("2026-04-05T10:00:00")).toContain("апр");
    expect(formatRelativeDate("2026-05-05T10:00:00")).toContain("мая");
  });
});

describe("formatFullDate", () => {
  it("returns localized Russian date string", () => {
    const result = formatFullDate("2026-04-06T14:30:15Z");
    // Should contain year, time components
    expect(result).toContain("2026");
  });
});

describe("isBranchRef", () => {
  it("returns true for regular branch name", () => {
    expect(isBranchRef("main")).toBe(true);
  });

  it("returns true for remote branch", () => {
    expect(isBranchRef("origin/main")).toBe(true);
  });

  it("returns true for HEAD -> branch", () => {
    expect(isBranchRef("HEAD -> main")).toBe(true);
  });

  it("returns false for HEAD", () => {
    expect(isBranchRef("HEAD")).toBe(false);
  });

  it("returns false for tag ref", () => {
    expect(isBranchRef("tag: v1.0")).toBe(false);
  });
});

describe("formatRef", () => {
  it("strips HEAD -> prefix", () => {
    expect(formatRef("HEAD -> main")).toBe("main");
  });

  it("strips tag: prefix", () => {
    expect(formatRef("tag: v1.0")).toBe("v1.0");
  });

  it("returns other refs unchanged", () => {
    expect(formatRef("origin/main")).toBe("origin/main");
  });

  it("returns simple branch name unchanged", () => {
    expect(formatRef("feature/test")).toBe("feature/test");
  });
});

describe("authorColor", () => {
  it("returns same color for same name", () => {
    expect(authorColor("Alice")).toBe(authorColor("Alice"));
  });

  it("returns a valid hsl string", () => {
    expect(authorColor("Bob")).toMatch(/^hsl\(/);
  });

  it("usually returns different colors for different names", () => {
    const colors = new Set([
      authorColor("Alice"),
      authorColor("Bob"),
      authorColor("Charlie"),
      authorColor("Diana")
    ]);
    // With 12 palette colors, 4 different names should produce at least 2 unique colors
    expect(colors.size).toBeGreaterThanOrEqual(2);
  });
});

describe("refClasses", () => {
  it("returns primary classes for HEAD -> branch", () => {
    expect(refClasses("HEAD -> main")).toContain("text-primary");
  });

  it("returns warning classes for tag", () => {
    expect(refClasses("tag: v1.0")).toContain("text-warning");
  });

  it("returns info classes for remote branch", () => {
    expect(refClasses("origin/main")).toContain("text-info");
  });

  it("returns base-content classes for other refs", () => {
    expect(refClasses("feature/test")).toContain("text-base-content/70");
  });
});
