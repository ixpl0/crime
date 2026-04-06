import { describe, it, expect } from "vitest";
import { loadLanguageExtension, LARGE_FILE_LINE_THRESHOLD } from "./language-detection";

describe("LARGE_FILE_LINE_THRESHOLD", () => {
  it("is a positive number", () => {
    expect(LARGE_FILE_LINE_THRESHOLD).toBeGreaterThan(0);
  });
});

describe("loadLanguageExtension", () => {
  it("returns non-empty array for .ts file", async () => {
    const result = await loadLanguageExtension("src/app.ts");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns non-empty array for .js file", async () => {
    const result = await loadLanguageExtension("index.js");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns non-empty array for .tsx file", async () => {
    const result = await loadLanguageExtension("component.tsx");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns non-empty array for .jsx file", async () => {
    const result = await loadLanguageExtension("component.jsx");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns non-empty array for .mjs file", async () => {
    const result = await loadLanguageExtension("module.mjs");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns non-empty array for .cjs file", async () => {
    const result = await loadLanguageExtension("module.cjs");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns non-empty array for .mts file", async () => {
    const result = await loadLanguageExtension("module.mts");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns non-empty array for .cts file", async () => {
    const result = await loadLanguageExtension("module.cts");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns non-empty array for .html file", async () => {
    const result = await loadLanguageExtension("index.html");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns non-empty array for .vue file", async () => {
    const result = await loadLanguageExtension("App.vue");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns non-empty array for .css file", async () => {
    const result = await loadLanguageExtension("style.css");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns non-empty array for .json file", async () => {
    const result = await loadLanguageExtension("package.json");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns non-empty array for .md file", async () => {
    const result = await loadLanguageExtension("README.md");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns non-empty array for .py file", async () => {
    const result = await loadLanguageExtension("script.py");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns empty array for unknown extension", async () => {
    const result = await loadLanguageExtension("data.xyz");
    expect(result).toEqual([]);
  });

  it("returns empty array for file without extension", async () => {
    const result = await loadLanguageExtension("Makefile");
    expect(result).toEqual([]);
  });

  it("handles uppercase extension case-insensitively", async () => {
    const result = await loadLanguageExtension("style.CSS");
    expect(result.length).toBeGreaterThan(0);
  });

  it("extracts extension from full path", async () => {
    const result = await loadLanguageExtension("/home/user/project/src/app.ts");
    expect(result.length).toBeGreaterThan(0);
  });

  it("handles .htm as HTML", async () => {
    const result = await loadLanguageExtension("page.htm");
    expect(result.length).toBeGreaterThan(0);
  });

  it("handles .markdown as markdown", async () => {
    const result = await loadLanguageExtension("notes.markdown");
    expect(result.length).toBeGreaterThan(0);
  });
});
