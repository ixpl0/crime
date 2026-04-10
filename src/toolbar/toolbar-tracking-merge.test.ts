import { describe, it, expect } from "vitest";
import { mergeToolbarTrackingOnReset } from "./toolbar-tracking-merge";
import type { ToolbarAction, ToolbarConfig, ToolbarDropdown } from "../types/toolbar";

const action = (overrides: Partial<ToolbarAction> = {}): ToolbarAction => ({
  label: "Test",
  value: "test-cmd",
  type: "command",
  ...overrides
});

const config = (elements: ToolbarConfig["elements"]): ToolbarConfig => ({ elements });

describe("mergeToolbarTrackingOnReset", () => {
  it("preserves done from current when value matches", () => {
    const defaultConfig = config([action({ value: "setup", done: false })]);
    const currentConfig = config([action({ value: "setup", done: true })]);

    const result = mergeToolbarTrackingOnReset(defaultConfig, currentConfig);
    const merged = result.elements[0] as ToolbarAction;
    expect(merged.done).toBe(true);
  });

  it("preserves lastUsed from current when value matches", () => {
    const defaultConfig = config([action({ value: "lint", lastUsed: null })]);
    const currentConfig = config([action({ value: "lint", lastUsed: "2026-04-10 12:00" })]);

    const result = mergeToolbarTrackingOnReset(defaultConfig, currentConfig);
    const merged = result.elements[0] as ToolbarAction;
    expect(merged.lastUsed).toBe("2026-04-10 12:00");
  });

  it("does not preserve tracking when value was changed", () => {
    const defaultConfig = config([action({ value: "original", done: false, lastUsed: null })]);
    const currentConfig = config([action({ value: "modified", done: true, lastUsed: "2026-04-10 12:00" })]);

    const result = mergeToolbarTrackingOnReset(defaultConfig, currentConfig);
    const merged = result.elements[0] as ToolbarAction;
    expect(merged.done).toBe(false);
    expect(merged.lastUsed).toBeNull();
  });

  it("does not add tracking fields that default lacks", () => {
    const defaultConfig = config([action({ value: "run" })]);
    const currentConfig = config([action({ value: "run", done: true, lastUsed: "2026-04-10 12:00" })]);

    const result = mergeToolbarTrackingOnReset(defaultConfig, currentConfig);
    const merged = result.elements[0] as ToolbarAction;
    expect(merged.done).toBeUndefined();
    expect(merged.lastUsed).toBeUndefined();
  });

  it("preserves tracking inside nested dropdowns", () => {
    const dropdown: ToolbarDropdown = {
      label: "Group",
      items: [action({ value: "nested", done: false })]
    };
    const defaultConfig = config([dropdown]);
    const currentConfig = config([{
      label: "Group",
      items: [action({ value: "nested", done: true })]
    }]);

    const result = mergeToolbarTrackingOnReset(defaultConfig, currentConfig);
    const mergedDropdown = result.elements[0] as ToolbarDropdown;
    const merged = mergedDropdown.items[0] as ToolbarAction;
    expect(merged.done).toBe(true);
  });

  it("matches scenario actions by label instead of value", () => {
    const scenarioAction = action({ label: "Deploy", value: "", type: "scenario", done: false });
    const currentScenario = action({ label: "Deploy", value: "", type: "scenario", done: true });

    const defaultConfig = config([scenarioAction]);
    const currentConfig = config([currentScenario]);

    const result = mergeToolbarTrackingOnReset(defaultConfig, currentConfig);
    const merged = result.elements[0] as ToolbarAction;
    expect(merged.done).toBe(true);
  });

  it("returns default tracking when current has no matching action", () => {
    const defaultConfig = config([action({ value: "new-cmd", done: false, lastUsed: null })]);
    const currentConfig = config([action({ value: "other-cmd", done: true, lastUsed: "2026-04-10 12:00" })]);

    const result = mergeToolbarTrackingOnReset(defaultConfig, currentConfig);
    const merged = result.elements[0] as ToolbarAction;
    expect(merged.done).toBe(false);
    expect(merged.lastUsed).toBeNull();
  });

  it("preserves both done and lastUsed simultaneously", () => {
    const defaultConfig = config([action({ value: "cmd", done: false, lastUsed: null })]);
    const currentConfig = config([action({ value: "cmd", done: true, lastUsed: "2026-04-09 15:30" })]);

    const result = mergeToolbarTrackingOnReset(defaultConfig, currentConfig);
    const merged = result.elements[0] as ToolbarAction;
    expect(merged.done).toBe(true);
    expect(merged.lastUsed).toBe("2026-04-09 15:30");
  });
});
