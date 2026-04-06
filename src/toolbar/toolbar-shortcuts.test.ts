import { describe, it, expect } from "vitest";
import {
  parseShortcut,
  matchesShortcut,
  formatShortcut,
  buildShortcutMap
} from "./toolbar-shortcuts";
import type { ToolbarAction, ToolbarConfig, ToolbarDropdown } from "../types/toolbar";

describe("parseShortcut", () => {
  describe("letter keys", () => {
    it("parses Ctrl+A", () => {
      expect(parseShortcut("Ctrl+A")).toEqual({
        ctrl: true, alt: false, shift: false, meta: false, code: "KeyA"
      });
    });

    it("parses lowercase ctrl+a", () => {
      expect(parseShortcut("ctrl+a")).toEqual({
        ctrl: true, alt: false, shift: false, meta: false, code: "KeyA"
      });
    });

    it("parses Ctrl+Shift+Z", () => {
      expect(parseShortcut("Ctrl+Shift+Z")).toEqual({
        ctrl: true, alt: false, shift: true, meta: false, code: "KeyZ"
      });
    });

    it("parses Alt+Shift+Ctrl+S", () => {
      const result = parseShortcut("Alt+Shift+Ctrl+S");
      expect(result).toEqual({
        ctrl: true, alt: true, shift: true, meta: false, code: "KeyS"
      });
    });
  });

  describe("digit keys", () => {
    it("parses Ctrl+1", () => {
      expect(parseShortcut("Ctrl+1")?.code).toBe("Digit1");
    });

    it("parses Ctrl+0", () => {
      expect(parseShortcut("Ctrl+0")?.code).toBe("Digit0");
    });
  });

  describe("function keys", () => {
    it("parses Ctrl+F1", () => {
      expect(parseShortcut("Ctrl+F1")?.code).toBe("F1");
    });

    it("parses Alt+F5", () => {
      const result = parseShortcut("Alt+F5");
      expect(result).toEqual({
        ctrl: false, alt: true, shift: false, meta: false, code: "F5"
      });
    });

    it("parses Ctrl+F12", () => {
      expect(parseShortcut("Ctrl+F12")?.code).toBe("F12");
    });

    it("parses Ctrl+F24", () => {
      expect(parseShortcut("Ctrl+F24")?.code).toBe("F24");
    });
  });

  describe("special keys", () => {
    it("parses Ctrl+Enter", () => {
      expect(parseShortcut("Ctrl+Enter")?.code).toBe("Enter");
    });

    it("parses Ctrl+Escape", () => {
      expect(parseShortcut("Ctrl+Escape")?.code).toBe("Escape");
    });

    it("parses Ctrl+Esc", () => {
      expect(parseShortcut("Ctrl+Esc")?.code).toBe("Escape");
    });

    it("parses Ctrl+ArrowUp", () => {
      expect(parseShortcut("Ctrl+ArrowUp")?.code).toBe("ArrowUp");
    });

    it("parses Ctrl+Up (alias)", () => {
      expect(parseShortcut("Ctrl+Up")?.code).toBe("ArrowUp");
    });

    it("parses Ctrl+Delete", () => {
      expect(parseShortcut("Ctrl+Delete")?.code).toBe("Delete");
    });

    it("parses Ctrl+Del (alias)", () => {
      expect(parseShortcut("Ctrl+Del")?.code).toBe("Delete");
    });

    it("parses Ctrl+Home", () => {
      expect(parseShortcut("Ctrl+Home")?.code).toBe("Home");
    });

    it("parses Ctrl+PageUp", () => {
      expect(parseShortcut("Ctrl+PageUp")?.code).toBe("PageUp");
    });

    it("parses Ctrl+PgUp (alias)", () => {
      expect(parseShortcut("Ctrl+PgUp")?.code).toBe("PageUp");
    });
  });

  describe("symbol keys", () => {
    it("parses Ctrl+=", () => {
      expect(parseShortcut("Ctrl+=")?.code).toBe("Equal");
    });

    it("parses Ctrl+-", () => {
      expect(parseShortcut("Ctrl+-")?.code).toBe("Minus");
    });

    it("parses Ctrl+[", () => {
      expect(parseShortcut("Ctrl+[")?.code).toBe("BracketLeft");
    });

    it("parses Ctrl+]", () => {
      expect(parseShortcut("Ctrl+]")?.code).toBe("BracketRight");
    });

    it("parses Ctrl+/", () => {
      expect(parseShortcut("Ctrl+/")?.code).toBe("Slash");
    });

    it("parses Ctrl+`", () => {
      expect(parseShortcut("Ctrl+`")?.code).toBe("Backquote");
    });
  });

  describe("meta/cmd modifier", () => {
    it("parses Meta+S", () => {
      expect(parseShortcut("Meta+S")?.meta).toBe(true);
    });

    it("parses Cmd+S", () => {
      expect(parseShortcut("Cmd+S")?.meta).toBe(true);
    });

    it("parses Command+S", () => {
      expect(parseShortcut("Command+S")?.meta).toBe(true);
    });
  });

  describe("explicit key code prefixes", () => {
    it("parses Ctrl+KeyA", () => {
      expect(parseShortcut("Ctrl+KeyA")?.code).toBe("KeyA");
    });

    it("parses Ctrl+Digit5", () => {
      expect(parseShortcut("Ctrl+Digit5")?.code).toBe("Digit5");
    });
  });

  describe("invalid shortcuts", () => {
    it("returns null for single key without modifier", () => {
      expect(parseShortcut("A")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(parseShortcut("")).toBeNull();
    });

    it("returns null for trailing plus", () => {
      expect(parseShortcut("Ctrl+")).toBeNull();
    });

    it("returns null for duplicate modifier", () => {
      expect(parseShortcut("Ctrl+Ctrl+A")).toBeNull();
    });

    it("returns null for unknown key token", () => {
      expect(parseShortcut("Ctrl+NumpadAdd")).toBeNull();
    });

    it("returns null for unknown modifier", () => {
      expect(parseShortcut("Super+A")).toBeNull();
    });
  });
});

describe("matchesShortcut", () => {
  const createEvent = (overrides: Partial<KeyboardEvent> = {}) =>
    ({
      altKey: false,
      ctrlKey: false,
      shiftKey: false,
      metaKey: false,
      code: "",
      ...overrides
    }) as KeyboardEvent;

  const requireParsed = (shortcut: string) => {
    const parsed = parseShortcut(shortcut);
    expect(parsed).not.toBeNull();
    return parsed as NonNullable<typeof parsed>;
  };

  it("matches Ctrl+A event to parsed Ctrl+A", () => {
    const parsed = requireParsed("Ctrl+A");
    const event = createEvent({ ctrlKey: true, code: "KeyA" });
    expect(matchesShortcut(event, parsed)).toBe(true);
  });

  it("does not match when modifier is missing", () => {
    const parsed = requireParsed("Ctrl+A");
    const event = createEvent({ code: "KeyA" });
    expect(matchesShortcut(event, parsed)).toBe(false);
  });

  it("does not match when extra modifier is pressed", () => {
    const parsed = requireParsed("Ctrl+A");
    const event = createEvent({ ctrlKey: true, shiftKey: true, code: "KeyA" });
    expect(matchesShortcut(event, parsed)).toBe(false);
  });

  it("does not match wrong key code", () => {
    const parsed = requireParsed("Ctrl+A");
    const event = createEvent({ ctrlKey: true, code: "KeyB" });
    expect(matchesShortcut(event, parsed)).toBe(false);
  });

  it("matches complex modifier combination", () => {
    const parsed = requireParsed("Ctrl+Alt+Shift+F5");
    const event = createEvent({ ctrlKey: true, altKey: true, shiftKey: true, code: "F5" });
    expect(matchesShortcut(event, parsed)).toBe(true);
  });
});

describe("formatShortcut", () => {
  it("formats lowercase to canonical form", () => {
    expect(formatShortcut("ctrl+a")).toBe("Ctrl+A");
  });

  it("formats with multiple modifiers in canonical order", () => {
    expect(formatShortcut("shift+alt+ctrl+s")).toBe("Ctrl+Alt+Shift+S");
  });

  it("formats arrow key aliases to display names", () => {
    expect(formatShortcut("Ctrl+ArrowUp")).toBe("Ctrl+Up");
  });

  it("formats Escape alias", () => {
    expect(formatShortcut("Ctrl+Escape")).toBe("Ctrl+Esc");
  });

  it("formats function key", () => {
    expect(formatShortcut("Alt+F5")).toBe("Alt+F5");
  });

  it("formats symbol key", () => {
    expect(formatShortcut("Ctrl+BracketLeft")).toBe("Ctrl+[");
  });

  it("returns invalid shortcut as-is", () => {
    expect(formatShortcut("invalid")).toBe("invalid");
  });

  it("returns single key as-is (no modifier)", () => {
    expect(formatShortcut("A")).toBe("A");
  });
});

describe("buildShortcutMap", () => {
  const createAction = (overrides: Partial<ToolbarAction> = {}): ToolbarAction => ({
    label: "Test",
    value: "test",
    type: "command",
    ...overrides
  });

  it("returns empty array for config with no shortcuts", () => {
    const config: ToolbarConfig = {
      elements: [createAction()]
    };
    expect(buildShortcutMap(config)).toEqual([]);
  });

  it("maps action with valid shortcut", () => {
    const action = createAction({ shortcut: "Ctrl+T" });
    const config: ToolbarConfig = { elements: [action] };

    const mappings = buildShortcutMap(config);
    expect(mappings).toHaveLength(1);
    expect(mappings[0].parsed.code).toBe("KeyT");
    expect(mappings[0].parsed.ctrl).toBe(true);
    expect(mappings[0].action).toBe(action);
  });

  it("skips action with invalid shortcut", () => {
    const config: ToolbarConfig = {
      elements: [createAction({ shortcut: "invalid" })]
    };
    expect(buildShortcutMap(config)).toEqual([]);
  });

  it("finds shortcuts inside dropdowns", () => {
    const action = createAction({ shortcut: "Ctrl+D" });
    const dropdown: ToolbarDropdown = { label: "Group", items: [action] };
    const config: ToolbarConfig = { elements: [dropdown] };

    const mappings = buildShortcutMap(config);
    expect(mappings).toHaveLength(1);
    expect(mappings[0].action).toBe(action);
  });

  it("collects multiple shortcuts from mixed elements", () => {
    const action1 = createAction({ label: "A1", shortcut: "Ctrl+1" });
    const action2 = createAction({ label: "A2" });
    const action3 = createAction({ label: "A3", shortcut: "Ctrl+3" });
    const dropdown: ToolbarDropdown = {
      label: "Group",
      items: [createAction({ label: "A4", shortcut: "Ctrl+4" })]
    };
    const config: ToolbarConfig = { elements: [action1, action2, action3, dropdown] };

    const mappings = buildShortcutMap(config);
    expect(mappings).toHaveLength(3);
  });
});
