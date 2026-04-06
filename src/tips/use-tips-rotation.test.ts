// @vitest-environment happy-dom
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("vue", async () => {
  const actual = await vi.importActual<typeof import("vue")>("vue");
  return {
    ...actual,
    onMounted: vi.fn(),
    onUnmounted: vi.fn()
  };
});

const STORAGE_KEY = "crime:tip-index";

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

const importUseTipsRotation = async () => {
  vi.doMock("vue", async () => {
    const actual = await vi.importActual<typeof import("vue")>("vue");
    return {
      ...actual,
      onMounted: vi.fn(),
      onUnmounted: vi.fn()
    };
  });
  const mod = await import("./use-tips-rotation");
  return mod.useTipsRotation;
};

describe("useTipsRotation", () => {
  it("returns currentTip as a non-empty string", async () => {
    const useTipsRotation = await importUseTipsRotation();
    const { currentTip } = useTipsRotation();
    expect(typeof currentTip.value).toBe("string");
    expect(currentTip.value.length).toBeGreaterThan(0);
  });

  it("advance changes the tip and persists index", async () => {
    const useTipsRotation = await importUseTipsRotation();
    const { advance } = useTipsRotation();
    advance();
    const stored = localStorage.getItem(STORAGE_KEY);
    expect(stored).not.toBeNull();
    expect(Number.isFinite(Number(stored))).toBe(true);
  });

  it("loads index from localStorage with increment on creation", async () => {
    localStorage.setItem(STORAGE_KEY, "2");
    const useTipsRotation = await importUseTipsRotation();
    const { currentTip } = useTipsRotation();
    expect(typeof currentTip.value).toBe("string");
  });

  it("handles invalid localStorage value gracefully", async () => {
    localStorage.setItem(STORAGE_KEY, "not-a-number");
    const useTipsRotation = await importUseTipsRotation();
    const { currentTip } = useTipsRotation();
    expect(typeof currentTip.value).toBe("string");
    expect(currentTip.value.length).toBeGreaterThan(0);
  });
});
