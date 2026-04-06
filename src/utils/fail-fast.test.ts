import { describe, it, expect } from "vitest";
import { toErrorMessage, toContextualErrorMessage } from "./fail-fast";

describe("toErrorMessage", () => {
  it("returns Error.message for Error with non-empty message", () => {
    expect(toErrorMessage(new Error("boom"), "fallback")).toBe("boom");
  });

  it("returns fallback for Error with whitespace-only message", () => {
    expect(toErrorMessage(new Error("   "), "fallback")).toBe("fallback");
  });

  it("returns fallback for Error with empty message", () => {
    expect(toErrorMessage(new Error(""), "fallback")).toBe("fallback");
  });

  it("returns string directly when non-empty", () => {
    expect(toErrorMessage("direct error", "fallback")).toBe("direct error");
  });

  it("returns fallback for whitespace-only string", () => {
    expect(toErrorMessage("  \t\n  ", "fallback")).toBe("fallback");
  });

  it("returns fallback for empty string", () => {
    expect(toErrorMessage("", "fallback")).toBe("fallback");
  });

  it("returns fallback for null", () => {
    expect(toErrorMessage(null, "fallback")).toBe("fallback");
  });

  it("returns fallback for undefined", () => {
    expect(toErrorMessage(undefined, "fallback")).toBe("fallback");
  });

  it("returns fallback for number", () => {
    expect(toErrorMessage(42, "fallback")).toBe("fallback");
  });

  it("returns fallback for plain object", () => {
    expect(toErrorMessage({ message: "not-an-error" }, "fallback")).toBe("fallback");
  });
});

describe("toContextualErrorMessage", () => {
  it("prepends context to error message", () => {
    const result = toContextualErrorMessage("Loading config", new Error("file not found"), "unknown");
    expect(result).toBe("Loading config: file not found");
  });

  it("prepends context to fallback when error is not extractable", () => {
    const result = toContextualErrorMessage("Saving", null, "failed");
    expect(result).toBe("Saving: failed");
  });

  it("uses string error directly", () => {
    const result = toContextualErrorMessage("Parse", "syntax error", "unknown");
    expect(result).toBe("Parse: syntax error");
  });
});
