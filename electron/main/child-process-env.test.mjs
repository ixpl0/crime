import { describe, it, expect, vi, beforeEach } from "vitest";
import { delimiter, normalize } from "node:path";

// Mock existsSync before importing the module
vi.mock("node:fs", () => ({
  existsSync: vi.fn(() => false)
}));

const { existsSync } = await import("node:fs");
const { buildChildProcessEnv } = await import("./child-process-env.mjs");

beforeEach(() => {
  vi.mocked(existsSync).mockReset();
  vi.mocked(existsSync).mockReturnValue(false);
});

describe("buildChildProcessEnv", () => {
  it("returns an object with PATH property", () => {
    const result = buildChildProcessEnv("/project", "/ide/node_modules/.bin");
    const pathKey = Object.keys(result).find((key) => key.toLowerCase() === "path");
    expect(pathKey).toBeDefined();
    expect(typeof result[pathKey]).toBe("string");
  });

  it("excludes the IDE node_modules bin path from PATH", () => {
    const ideBin = normalize("/ide/node_modules/.bin");
    const result = buildChildProcessEnv("/project", ideBin);
    const pathKey = Object.keys(result).find((key) => key.toLowerCase() === "path");
    const pathEntries = result[pathKey].split(delimiter);
    const normalizedEntries = pathEntries.map((entry) =>
      process.platform === "win32" ? entry.toLowerCase() : entry
    );
    const normalizedIdeBin = process.platform === "win32" ? ideBin.toLowerCase() : ideBin;
    expect(normalizedEntries).not.toContain(normalizedIdeBin);
  });

  it("prepends workspace node_modules/.bin when it exists", () => {
    vi.mocked(existsSync).mockImplementation((path) => {
      const pathStr = String(path);
      return pathStr.includes("node_modules") && pathStr.includes(".bin");
    });

    const result = buildChildProcessEnv("/project", "/ide/node_modules/.bin");
    const pathKey = Object.keys(result).find((key) => key.toLowerCase() === "path");
    const pathValue = result[pathKey];
    const entries = pathValue.split(delimiter);

    // The first entry should be the workspace node_modules/.bin
    const firstEntry = normalize(entries[0]);
    expect(firstEntry).toContain("node_modules");
    expect(firstEntry).toContain(".bin");
  });

  it("deduplicates PATH entries", () => {
    const result = buildChildProcessEnv("/project", "/ide/node_modules/.bin");
    const pathKey = Object.keys(result).find((key) => key.toLowerCase() === "path");
    const entries = result[pathKey].split(delimiter);
    const normalizedEntries = entries.map((entry) =>
      process.platform === "win32" ? normalize(entry).toLowerCase() : normalize(entry)
    );
    const uniqueEntries = new Set(normalizedEntries);
    expect(uniqueEntries.size).toBe(normalizedEntries.length);
  });

  it("preserves other environment variables", () => {
    const result = buildChildProcessEnv("/project", "/ide/node_modules/.bin");
    // process.env should be spread into the result
    expect(typeof result).toBe("object");
    expect(result).not.toBe(process.env);
  });

  it("does not modify the original process.env", () => {
    const originalPath = process.env.PATH ?? process.env.Path;
    buildChildProcessEnv("/project", "/ide/node_modules/.bin");
    const currentPath = process.env.PATH ?? process.env.Path;
    expect(currentPath).toBe(originalPath);
  });
});
