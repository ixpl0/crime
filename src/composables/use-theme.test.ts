// @vitest-environment happy-dom
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("vue", async () => {
  const actual = await vi.importActual<typeof import("vue")>("vue");
  return {
    ...actual,
    onMounted: vi.fn((fn: () => void) => { fn(); })
  };
});

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("useTheme", () => {
  const importUseTheme = async () => {
    vi.resetModules();
    vi.doMock("vue", async () => {
      const actual = await vi.importActual<typeof import("vue")>("vue");
      return {
        ...actual,
        onMounted: vi.fn((fn: () => void) => { fn(); })
      };
    });
    const mod = await import("./use-theme");
    return mod.useTheme;
  };

  it("setTheme sets the theme ref and DOM attribute", async () => {
    const useTheme = await importUseTheme();
    const { currentTheme, setTheme } = useTheme();
    setTheme("dark");
    expect(currentTheme.value).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("setTheme persists to localStorage", async () => {
    const useTheme = await importUseTheme();
    const { setTheme } = useTheme();
    setTheme("cyberpunk");
    expect(localStorage.getItem("crime-theme")).toBe("cyberpunk");
  });

  it("toggleTheme switches between light and dark", async () => {
    const useTheme = await importUseTheme();
    const { currentTheme, setTheme, toggleTheme } = useTheme();
    setTheme("light");
    toggleTheme();
    expect(currentTheme.value).toBe("dark");
    toggleTheme();
    expect(currentTheme.value).toBe("light");
  });

  it("toggleTheme from dark switches to light", async () => {
    const useTheme = await importUseTheme();
    const { currentTheme, setTheme, toggleTheme } = useTheme();
    setTheme("dark");
    toggleTheme();
    expect(currentTheme.value).toBe("light");
  });

  it("loads saved theme from localStorage", async () => {
    localStorage.setItem("crime-theme", "nord");
    const useTheme = await importUseTheme();
    const { currentTheme } = useTheme();
    expect(currentTheme.value).toBe("nord");
  });

  it("falls back to system theme for invalid localStorage value", async () => {
    localStorage.setItem("crime-theme", "nonexistent-theme");
    const useTheme = await importUseTheme();
    const { currentTheme } = useTheme();
    expect(["light", "dark"]).toContain(currentTheme.value);
  });
});
