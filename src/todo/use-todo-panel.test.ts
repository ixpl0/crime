// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { ref } from "vue";
import { useTodoPanel } from "./use-todo-panel";
import type { UseTodoPanelOptions } from "./use-todo-panel";

const createTodoPanel = (overrides: Partial<UseTodoPanelOptions> = {}) =>
  useTodoPanel({
    projectPath: ref<string | null>(null),
    collapsedStorageKey: "test-todo-collapsed",
    reportUiError: vi.fn(),
    ...overrides
  });

describe("addTodoEntry", () => {
  it("saves a new entry and keeps a trailing placeholder", () => {
    const panel = createTodoPanel();

    const didAdd = panel.addTodoEntry("Saved prompt");

    expect(didAdd).toBe(true);
    expect(panel.getTodoEntry(0)).toBe("Saved prompt");
    expect(panel.getTodoEntry(1)).toBe("");
    expect(panel.todoDraftViewItems.value).toHaveLength(2);
  });

  it("appends consecutive entries instead of replacing them", () => {
    const panel = createTodoPanel();

    panel.addTodoEntry("First prompt");
    panel.addTodoEntry("Second prompt");

    expect(panel.getTodoEntry(0)).toBe("First prompt");
    expect(panel.getTodoEntry(1)).toBe("Second prompt");
    expect(panel.getTodoEntry(2)).toBe("");
    expect(panel.todoDraftViewItems.value).toHaveLength(3);
  });

  it("ignores empty input and leaves drafts untouched", () => {
    const panel = createTodoPanel();

    const didAdd = panel.addTodoEntry("");

    expect(didAdd).toBe(false);
    expect(panel.getTodoEntry(0)).toBe("");
    expect(panel.todoDraftViewItems.value).toHaveLength(1);
  });

  it("ignores whitespace-only input", () => {
    const panel = createTodoPanel();

    const didAdd = panel.addTodoEntry("   \t\n");

    expect(didAdd).toBe(false);
    expect(panel.todoDraftViewItems.value).toHaveLength(1);
  });

  it("preserves a multiline prompt as a single entry", () => {
    const panel = createTodoPanel();

    panel.addTodoEntry("line one\nline two");

    expect(panel.getTodoEntry(0)).toBe("line one\nline two");
    expect(panel.todoDraftViewItems.value).toHaveLength(2);
  });
});
