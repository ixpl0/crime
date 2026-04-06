import { describe, it, expect } from "vitest";
import {
  applyToolbarActionTracking,
  isLastUsedWithinOneDay,
  computeDaysSinceLastUsed
} from "./toolbar-tracking";
import type { ToolbarAction, ToolbarConfig, ToolbarDropdown } from "../types/toolbar";

describe("isLastUsedWithinOneDay", () => {
  it("returns true when used less than 24 hours ago", () => {
    const now = new Date("2026-04-06T12:00:00");
    expect(isLastUsedWithinOneDay("2026-04-06 08:00", now)).toBe(true);
  });

  it("returns false when used exactly 24 hours ago", () => {
    const now = new Date("2026-04-07T12:00:00");
    expect(isLastUsedWithinOneDay("2026-04-06 12:00", now)).toBe(false);
  });

  it("returns false when used more than 24 hours ago", () => {
    const now = new Date("2026-04-08T12:00:00");
    expect(isLastUsedWithinOneDay("2026-04-06 12:00", now)).toBe(false);
  });

  it("returns false when lastUsed is in the future", () => {
    const now = new Date("2026-04-06T08:00:00");
    expect(isLastUsedWithinOneDay("2026-04-06 12:00", now)).toBe(false);
  });

  it("returns true when used just now", () => {
    const now = new Date("2026-04-06T12:00:00");
    expect(isLastUsedWithinOneDay("2026-04-06 12:00", now)).toBe(true);
  });
});

describe("computeDaysSinceLastUsed", () => {
  it("returns 0 for same day usage", () => {
    const now = new Date("2026-04-06T18:00:00");
    expect(computeDaysSinceLastUsed("2026-04-06 08:00", now)).toBe(0);
  });

  it("returns 1 for yesterday usage", () => {
    const now = new Date("2026-04-07T12:00:00");
    expect(computeDaysSinceLastUsed("2026-04-06 08:00", now)).toBe(1);
  });

  it("returns correct count for multi-day gap", () => {
    const now = new Date("2026-04-10T12:00:00");
    expect(computeDaysSinceLastUsed("2026-04-06 12:00", now)).toBe(4);
  });

  it("returns null for invalid date string", () => {
    const now = new Date("2026-04-06T12:00:00");
    expect(computeDaysSinceLastUsed("not-a-date", now)).toBeNull();
  });
});

describe("applyToolbarActionTracking", () => {
  const createAction = (overrides: Partial<ToolbarAction> = {}): ToolbarAction => ({
    label: "Run",
    value: "npm test",
    type: "command",
    ...overrides
  });

  const expectConfig = (result: ToolbarConfig | null): ToolbarConfig => {
    expect(result).not.toBeNull();
    return result as ToolbarConfig;
  };

  it("returns null when action has no trackable fields", () => {
    const action = createAction();
    const config: ToolbarConfig = { elements: [action] };

    const result = applyToolbarActionTracking(config, action);
    expect(result).toBeNull();
  });

  it("updates lastUsed when action has lastUsed field", () => {
    const action = createAction({ lastUsed: "2026-04-05 10:00" });
    const config: ToolbarConfig = { elements: [action] };

    const updated = expectConfig(applyToolbarActionTracking(config, action));
    const updatedAction = updated.elements[0] as ToolbarAction;
    expect(updatedAction.lastUsed).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it("sets done to true when action has done=false", () => {
    const action = createAction({ done: false });
    const config: ToolbarConfig = { elements: [action] };

    const updated = expectConfig(applyToolbarActionTracking(config, action));
    const updatedAction = updated.elements[0] as ToolbarAction;
    expect(updatedAction.done).toBe(true);
  });

  it("does not update done when already true", () => {
    const action = createAction({ done: true });
    const config: ToolbarConfig = { elements: [action] };

    const result = applyToolbarActionTracking(config, action);
    expect(result).toBeNull();
  });

  it("does not update action that is not the executed one", () => {
    const action1 = createAction({ label: "Action 1", lastUsed: "2026-04-05 10:00" });
    const action2 = createAction({ label: "Action 2", lastUsed: "2026-04-05 10:00" });
    const config: ToolbarConfig = { elements: [action1, action2] };

    const updated = expectConfig(applyToolbarActionTracking(config, action1));
    const updated1 = updated.elements[0] as ToolbarAction;
    const unchanged2 = updated.elements[1] as ToolbarAction;
    expect(updated1.lastUsed).not.toBe("2026-04-05 10:00");
    expect(unchanged2.lastUsed).toBe("2026-04-05 10:00");
  });

  it("updates action inside a dropdown", () => {
    const action = createAction({ lastUsed: "2026-04-05 10:00" });
    const dropdown: ToolbarDropdown = { label: "Group", items: [action] };
    const config: ToolbarConfig = { elements: [dropdown] };

    const updated = expectConfig(applyToolbarActionTracking(config, action));
    const updatedDropdown = updated.elements[0] as ToolbarDropdown;
    const updatedAction = updatedDropdown.items[0] as ToolbarAction;
    expect(updatedAction.lastUsed).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it("preserves other action fields when updating", () => {
    const action = createAction({
      lastUsed: "2026-04-05 10:00",
      icon: "play",
      color: "success"
    });
    const config: ToolbarConfig = { elements: [action] };

    const updated = expectConfig(applyToolbarActionTracking(config, action));
    const updatedAction = updated.elements[0] as ToolbarAction;
    expect(updatedAction.label).toBe("Run");
    expect(updatedAction.value).toBe("npm test");
    expect(updatedAction.icon).toBe("play");
    expect(updatedAction.color).toBe("success");
  });

  it("handles lastUsed with null value (no tracking)", () => {
    const action = createAction({ lastUsed: null });
    const config: ToolbarConfig = { elements: [action] };

    // lastUsed is null but still !== undefined, so it should update
    const result = applyToolbarActionTracking(config, action);
    expect(result).not.toBeNull();
  });
});
