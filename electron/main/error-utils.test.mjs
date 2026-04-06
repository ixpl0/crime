import { describe, it, expect } from "vitest";
import { toErrorMessage, toIpcErrorResponse } from "./error-utils.mjs";

describe("toErrorMessage", () => {
  it("returns Error.message when error is an Error with a message", () => {
    expect(toErrorMessage(new Error("something broke"), "fallback")).toBe("something broke");
  });

  it("returns fallback when Error has empty message", () => {
    expect(toErrorMessage(new Error(""), "fallback")).toBe("fallback");
  });

  it("returns string when error is a non-empty string", () => {
    expect(toErrorMessage("direct message", "fallback")).toBe("direct message");
  });

  it("returns fallback when error is an empty string", () => {
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

  it("returns fallback for object without message", () => {
    expect(toErrorMessage({ code: 500 }, "fallback")).toBe("fallback");
  });
});

describe("toIpcErrorResponse", () => {
  it("returns object with ok: false and error message", () => {
    const result = toIpcErrorResponse(new Error("oops"), "default");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("oops");
  });

  it("uses fallback message when error is not extractable", () => {
    const result = toIpcErrorResponse(null, "something went wrong");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("something went wrong");
  });

  it("extracts string error directly", () => {
    const result = toIpcErrorResponse("network error", "fallback");
    expect(result.error).toBe("network error");
  });
});
