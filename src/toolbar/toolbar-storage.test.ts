import { describe, it, expect } from "vitest";
import {
  parseToolbarConfig,
  isToolbarPresetColor,
  serializeToolbarConfig
} from "./toolbar-storage";
import type { ToolbarConfig } from "../types/toolbar";

const minimalAction = {
  label: "Run",
  value: "npm start",
  type: "command"
};

const minimalConfig = {
  version: 1,
  elements: [minimalAction]
};

describe("isToolbarPresetColor", () => {
  it.each([
    "primary", "secondary", "accent", "info", "success", "warning", "error", "neutral", "ghost"
  ])("returns true for preset color '%s'", (color) => {
    expect(isToolbarPresetColor(color)).toBe(true);
  });

  it("returns false for hex color", () => {
    expect(isToolbarPresetColor("#ff0000")).toBe(false);
  });

  it("returns false for arbitrary string", () => {
    expect(isToolbarPresetColor("blue")).toBe(false);
  });
});

describe("parseToolbarConfig", () => {
  describe("valid configs", () => {
    it("parses minimal config with one action", () => {
      const result = parseToolbarConfig(minimalConfig);
      expect(result).not.toBeNull();
      expect(result?.elements).toHaveLength(1);
    });

    it("parses config without version field", () => {
      const result = parseToolbarConfig({ elements: [minimalAction] });
      expect(result).not.toBeNull();
    });

    it("parses action with all fields", () => {
      const result = parseToolbarConfig({
        elements: [{
          label: "Build",
          value: "npm run build",
          type: "prompt",
          shortcut: "b",
          color: "success",
          resetTerminal: true,
          lastUsed: "2024-01-15 10:30",
          done: false
        }]
      });
      expect(result).not.toBeNull();
      const action = result?.elements[0];
      expect(action).toMatchObject({
        label: "Build",
        value: "npm run build",
        type: "prompt",
        shortcut: "b",
        color: "success",
        resetTerminal: true,
        lastUsed: "2024-01-15 10:30",
        done: false
      });
    });

    it("parses dropdown element with items", () => {
      const result = parseToolbarConfig({
        elements: [{
          label: "Git",
          items: [
            { label: "Pull", value: "git pull", type: "command" },
            { label: "Push", value: "git push", type: "command" }
          ]
        }]
      });
      expect(result).not.toBeNull();
      const dropdown = result?.elements[0];
      expect(dropdown).toBeDefined();
      expect("items" in (dropdown ?? {})).toBe(true);
      if (dropdown && "items" in dropdown) {
        expect(dropdown.items).toHaveLength(2);
      }
    });

    it("parses nested dropdown (dropdown inside dropdown)", () => {
      const result = parseToolbarConfig({
        elements: [{
          label: "Code",
          items: [
            {
              label: "Setup",
              items: [
                { label: "Tests", value: "setup tests", type: "prompt" },
                { label: "Lint", value: "setup lint", type: "prompt" }
              ]
            },
            { label: "Run", value: "npm start", type: "command" }
          ]
        }]
      });
      expect(result).not.toBeNull();
      const outer = result?.elements[0];
      expect(outer).toBeDefined();
      expect("items" in (outer ?? {})).toBe(true);
      if (outer && "items" in outer) {
        expect(outer.items).toHaveLength(2);
        const nested = outer.items[0];
        expect("items" in nested).toBe(true);
        if ("items" in nested) {
          expect(nested.items).toHaveLength(2);
          expect(nested.items[0]).toMatchObject({ label: "Tests", type: "prompt" });
        }
      }
    });

    it("parses dropdown with color", () => {
      const result = parseToolbarConfig({
        elements: [{
          label: "Actions",
          color: "accent",
          items: [minimalAction]
        }]
      });
      expect(result).not.toBeNull();
    });

    it("parses empty elements array", () => {
      const result = parseToolbarConfig({ elements: [] });
      expect(result).toEqual({ elements: [] });
    });
  });

  describe("action types", () => {
    it.each(["prompt", "command", "raw-input"])("accepts type '%s'", (type) => {
      const result = parseToolbarConfig({
        elements: [{ label: "X", value: "x", type }]
      });
      expect(result).not.toBeNull();
    });

    it("rejects invalid action type", () => {
      const result = parseToolbarConfig({
        elements: [{ label: "X", value: "x", type: "shell" }]
      });
      expect(result).toBeNull();
    });
  });

  describe("color validation", () => {
    it("accepts preset color", () => {
      const result = parseToolbarConfig({
        elements: [{ ...minimalAction, color: "primary" }]
      });
      expect(result?.elements[0]).toHaveProperty("color", "primary");
    });

    it("accepts 3-digit hex color", () => {
      const result = parseToolbarConfig({
        elements: [{ ...minimalAction, color: "#f00" }]
      });
      expect(result?.elements[0]).toHaveProperty("color", "#f00");
    });

    it("accepts 6-digit hex color", () => {
      const result = parseToolbarConfig({
        elements: [{ ...minimalAction, color: "#ff0000" }]
      });
      expect(result?.elements[0]).toHaveProperty("color", "#ff0000");
    });

    it("accepts oklch color", () => {
      const result = parseToolbarConfig({
        elements: [{ ...minimalAction, color: "oklch(0.7 0.15 200)" }]
      });
      expect(result?.elements[0]).toHaveProperty("color", "oklch(0.7 0.15 200)");
    });

    it("ignores invalid color (does not reject)", () => {
      const result = parseToolbarConfig({
        elements: [{ ...minimalAction, color: "rainbow" }]
      });
      expect(result).not.toBeNull();
      expect(result?.elements[0]).not.toHaveProperty("color");
    });
  });

  describe("resetTerminal flag", () => {
    it("accepts resetTerminal: true", () => {
      const result = parseToolbarConfig({
        elements: [{ ...minimalAction, resetTerminal: true }]
      });
      expect(result?.elements[0]).toHaveProperty("resetTerminal", true);
    });

    it("rejects resetTerminal: false", () => {
      const result = parseToolbarConfig({
        elements: [{ ...minimalAction, resetTerminal: false }]
      });
      expect(result).toBeNull();
    });

    it("allows implicit reset action (resetTerminal without value)", () => {
      const result = parseToolbarConfig({
        elements: [{ label: "Reset", resetTerminal: true }]
      });
      expect(result).not.toBeNull();
      expect(result?.elements[0]).toMatchObject({
        label: "Reset",
        value: "",
        type: "command",
        resetTerminal: true
      });
    });
  });

  describe("lastUsed tracking", () => {
    it("accepts valid datetime format", () => {
      const result = parseToolbarConfig({
        elements: [{ ...minimalAction, lastUsed: "2024-06-15 08:45" }]
      });
      expect(result?.elements[0]).toHaveProperty("lastUsed", "2024-06-15 08:45");
    });

    it("accepts null lastUsed", () => {
      const result = parseToolbarConfig({
        elements: [{ ...minimalAction, lastUsed: null }]
      });
      expect(result?.elements[0]).toHaveProperty("lastUsed", null);
    });

    it("rejects invalid lastUsed format", () => {
      const result = parseToolbarConfig({
        elements: [{ ...minimalAction, lastUsed: "yesterday" }]
      });
      expect(result).toBeNull();
    });

    it("rejects non-string lastUsed", () => {
      const result = parseToolbarConfig({
        elements: [{ ...minimalAction, lastUsed: 12345 }]
      });
      expect(result).toBeNull();
    });
  });

  describe("done tracking", () => {
    it("accepts done: true", () => {
      const result = parseToolbarConfig({
        elements: [{ ...minimalAction, done: true }]
      });
      expect(result?.elements[0]).toHaveProperty("done", true);
    });

    it("accepts done: false", () => {
      const result = parseToolbarConfig({
        elements: [{ ...minimalAction, done: false }]
      });
      expect(result?.elements[0]).toHaveProperty("done", false);
    });

    it("rejects non-boolean done", () => {
      const result = parseToolbarConfig({
        elements: [{ ...minimalAction, done: "yes" }]
      });
      expect(result).toBeNull();
    });
  });

  describe("invalid configs", () => {
    it("returns null for null", () => {
      expect(parseToolbarConfig(null)).toBeNull();
    });

    it("returns null for string", () => {
      expect(parseToolbarConfig("toolbar")).toBeNull();
    });

    it("returns null for wrong version", () => {
      expect(parseToolbarConfig({ ...minimalConfig, version: 2 })).toBeNull();
    });

    it("returns null when elements is missing", () => {
      expect(parseToolbarConfig({ version: 1 })).toBeNull();
    });

    it("returns null when elements is not array", () => {
      expect(parseToolbarConfig({ elements: "invalid" })).toBeNull();
    });

    it("returns null when action has no label", () => {
      expect(parseToolbarConfig({
        elements: [{ value: "cmd", type: "command" }]
      })).toBeNull();
    });

    it("returns null when action has non-string value", () => {
      expect(parseToolbarConfig({
        elements: [{ label: "X", value: 42, type: "command" }]
      })).toBeNull();
    });

    it("returns null when dropdown item is invalid", () => {
      expect(parseToolbarConfig({
        elements: [{ label: "Menu", items: [{ invalid: true }] }]
      })).toBeNull();
    });

    it("returns null when dropdown has no label", () => {
      expect(parseToolbarConfig({
        elements: [{ items: [minimalAction] }]
      })).toBeNull();
    });
  });
});

describe("serializeToolbarConfig", () => {
  it("round-trips a simple config", () => {
    const config: ToolbarConfig = {
      elements: [
        { label: "Build", value: "npm run build", type: "command" }
      ]
    };
    const serialized = serializeToolbarConfig(config);
    const parsed = parseToolbarConfig(serialized);
    expect(parsed).toEqual(config);
  });

  it("round-trips config with dropdown", () => {
    const config: ToolbarConfig = {
      elements: [{
        label: "Git",
        items: [
          { label: "Pull", value: "git pull", type: "command" },
          { label: "Push", value: "git push", type: "command" }
        ]
      }]
    };
    const serialized = serializeToolbarConfig(config);
    const parsed = parseToolbarConfig(serialized);
    expect(parsed).toEqual(config);
  });

  it("round-trips config with nested dropdown", () => {
    const config: ToolbarConfig = {
      elements: [{
        label: "Code",
        items: [
          {
            label: "Review",
            items: [
              { label: "Bugs", value: "find bugs", type: "prompt", lastUsed: null },
              { label: "Perf", value: "check perf", type: "prompt" }
            ]
          },
          { label: "Run", value: "npm start", type: "command" }
        ]
      }]
    };
    const serialized = serializeToolbarConfig(config);
    const parsed = parseToolbarConfig(serialized);
    expect(parsed).toEqual(config);
  });

  it("round-trips config with optional fields", () => {
    const config: ToolbarConfig = {
      elements: [
        {
          label: "Deploy",
          value: "deploy.sh",
          type: "command",
          shortcut: "d",
          color: "error",
          resetTerminal: true,
          lastUsed: "2024-03-01 12:00",
          done: true
        }
      ]
    };
    const serialized = serializeToolbarConfig(config);
    const parsed = parseToolbarConfig(serialized);
    expect(parsed).toEqual(config);
  });

  it("omits value and type for implicit reset action", () => {
    const config: ToolbarConfig = {
      elements: [
        { label: "Reset", value: "", type: "command", resetTerminal: true }
      ]
    };
    const serialized = serializeToolbarConfig(config);
    expect(serialized.elements[0]).not.toHaveProperty("value");
    expect(serialized.elements[0]).not.toHaveProperty("type");
    expect(serialized.elements[0]).toHaveProperty("resetTerminal", true);
  });
});
