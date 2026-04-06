import { describe, it, expect } from "vitest";
import { parseScenarioSteps } from "./scenario-storage";

describe("parseScenarioSteps", () => {
  describe("valid steps", () => {
    it("parses a command step", () => {
      const result = parseScenarioSteps([{ type: "command", value: "echo hello" }]);
      expect(result).toEqual([{ type: "command", value: "echo hello" }]);
    });

    it("parses a prompt step", () => {
      const result = parseScenarioSteps([{ type: "prompt", value: "review code" }]);
      expect(result).toEqual([{ type: "prompt", value: "review code" }]);
    });

    it("parses a raw-input step", () => {
      const result = parseScenarioSteps([{ type: "raw-input", value: "y\n" }]);
      expect(result).toEqual([{ type: "raw-input", value: "y\n" }]);
    });

    it("parses a wait step", () => {
      const result = parseScenarioSteps([{ type: "wait" }]);
      expect(result).toEqual([{ type: "wait" }]);
    });

    it("parses a wait-for step with pattern", () => {
      const result = parseScenarioSteps([{ type: "wait-for", pattern: "\\$" }]);
      expect(result).toEqual([{ type: "wait-for", pattern: "\\$" }]);
    });

    it("parses a delay step with delayMs", () => {
      const result = parseScenarioSteps([{ type: "delay", delayMs: 500 }]);
      expect(result).toEqual([{ type: "delay", delayMs: 500 }]);
    });

    it("parses multiple steps in sequence", () => {
      const input = [
        { type: "command", value: "npm test" },
        { type: "wait-for", pattern: "passed" },
        { type: "prompt", value: "done" }
      ];
      const result = parseScenarioSteps(input);
      expect(result).toHaveLength(3);
      expect(result?.[0].type).toBe("command");
      expect(result?.[1].type).toBe("wait-for");
      expect(result?.[2].type).toBe("prompt");
    });
  });

  describe("optional fields", () => {
    it("includes pattern when provided as non-empty string", () => {
      const result = parseScenarioSteps([{ type: "wait-for", pattern: "ready" }]);
      expect(result?.[0]).toHaveProperty("pattern", "ready");
    });

    it("excludes pattern when it is empty string", () => {
      const result = parseScenarioSteps([{ type: "wait-for", pattern: "" }]);
      expect(result?.[0]).not.toHaveProperty("pattern");
    });

    it("includes resetTerminal when true", () => {
      const result = parseScenarioSteps([{ type: "command", value: "ls", resetTerminal: true }]);
      expect(result?.[0]).toHaveProperty("resetTerminal", true);
    });

    it("excludes resetTerminal when false", () => {
      const result = parseScenarioSteps([{ type: "command", value: "ls", resetTerminal: false }]);
      expect(result?.[0]).not.toHaveProperty("resetTerminal");
    });

    it("includes quietMs when positive number", () => {
      const result = parseScenarioSteps([{ type: "wait", quietMs: 1000 }]);
      expect(result?.[0]).toHaveProperty("quietMs", 1000);
    });

    it("excludes quietMs when zero or negative", () => {
      expect(parseScenarioSteps([{ type: "wait", quietMs: 0 }])?.[0]).not.toHaveProperty("quietMs");
      expect(parseScenarioSteps([{ type: "wait", quietMs: -1 }])?.[0]).not.toHaveProperty("quietMs");
    });

    it("includes timeoutMs when positive number", () => {
      const result = parseScenarioSteps([{ type: "wait-for", pattern: "x", timeoutMs: 5000 }]);
      expect(result?.[0]).toHaveProperty("timeoutMs", 5000);
    });

    it("includes delayMs when positive number", () => {
      const result = parseScenarioSteps([{ type: "delay", delayMs: 200 }]);
      expect(result?.[0]).toHaveProperty("delayMs", 200);
    });

    it("step without value does not have value property", () => {
      const result = parseScenarioSteps([{ type: "wait" }]);
      expect(result?.[0]).not.toHaveProperty("value");
    });
  });

  describe("invalid inputs", () => {
    it("returns null for non-array input", () => {
      expect(parseScenarioSteps("not-array")).toBeNull();
      expect(parseScenarioSteps(42)).toBeNull();
      expect(parseScenarioSteps(null)).toBeNull();
      expect(parseScenarioSteps(undefined)).toBeNull();
      expect(parseScenarioSteps({})).toBeNull();
    });

    it("returns null for empty array", () => {
      expect(parseScenarioSteps([])).toBeNull();
    });

    it("returns null when any step has invalid type", () => {
      expect(parseScenarioSteps([{ type: "invalid" }])).toBeNull();
    });

    it("returns null when step type is missing", () => {
      expect(parseScenarioSteps([{ value: "echo hi" }])).toBeNull();
    });

    it("returns null when step is not an object", () => {
      expect(parseScenarioSteps(["string"])).toBeNull();
      expect(parseScenarioSteps([42])).toBeNull();
      expect(parseScenarioSteps([null])).toBeNull();
    });

    it("returns null when value is non-string", () => {
      expect(parseScenarioSteps([{ type: "command", value: 123 }])).toBeNull();
    });

    it("returns null if any step in array is invalid", () => {
      const input = [
        { type: "command", value: "ls" },
        { type: "bogus" }
      ];
      expect(parseScenarioSteps(input)).toBeNull();
    });
  });
});
