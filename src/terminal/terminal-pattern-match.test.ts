import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { waitForTerminalPattern } from "./terminal-pattern-match";

describe("waitForTerminalPattern", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves true when pattern is found in data", async () => {
    const listeners = new Set<(data: string) => void>();
    const promise = waitForTerminalPattern(listeners, "done", 5000);

    expect(listeners.size).toBe(1);
    const listener = [...listeners][0];
    listener("task done");

    const result = await promise;
    expect(result).toBe(true);
    expect(listeners.size).toBe(0);
  });

  it("resolves false on timeout when pattern is not found", async () => {
    const listeners = new Set<(data: string) => void>();
    const promise = waitForTerminalPattern(listeners, "done", 3000);

    expect(listeners.size).toBe(1);
    vi.advanceTimersByTime(3000);

    const result = await promise;
    expect(result).toBe(false);
    expect(listeners.size).toBe(0);
  });

  it("strips ANSI escape sequences before matching", async () => {
    const listeners = new Set<(data: string) => void>();
    const promise = waitForTerminalPattern(listeners, "success", 5000);

    const listener = [...listeners][0];
    listener("\x1b[32msuccess\x1b[0m");

    const result = await promise;
    expect(result).toBe(true);
  });

  it("accumulates data across multiple chunks", async () => {
    const listeners = new Set<(data: string) => void>();
    const promise = waitForTerminalPattern(listeners, "hello world", 5000);

    const listener = [...listeners][0];
    listener("hel");
    listener("lo wor");
    listener("ld");

    const result = await promise;
    expect(result).toBe(true);
  });

  it("trims buffer to limit when it exceeds 4096 chars", async () => {
    const listeners = new Set<(data: string) => void>();
    const promise = waitForTerminalPattern(listeners, "needle", 5000);

    const listener = [...listeners][0];
    // Send data that puts "needle" beyond the buffer limit
    listener("needle" + "x".repeat(5000));

    // Pattern was pushed out of the buffer, so it shouldn't match
    vi.advanceTimersByTime(5000);
    const result = await promise;
    expect(result).toBe(false);
  });

  it("finds pattern in retained buffer after trimming", async () => {
    const listeners = new Set<(data: string) => void>();
    const promise = waitForTerminalPattern(listeners, "needle", 5000);

    const listener = [...listeners][0];
    // Fill buffer then add the pattern at the end
    listener("x".repeat(5000));
    listener("needle");

    const result = await promise;
    expect(result).toBe(true);
  });

  it("handles OSC escape sequences", async () => {
    const listeners = new Set<(data: string) => void>();
    const promise = waitForTerminalPattern(listeners, "ready", 5000);

    const listener = [...listeners][0];
    listener("\x1b]0;title\x07ready");

    const result = await promise;
    expect(result).toBe(true);
  });

  it("cleans up listener after pattern match", async () => {
    const listeners = new Set<(data: string) => void>();
    const promise = waitForTerminalPattern(listeners, "done", 5000);

    const listener = [...listeners][0];
    listener("done");
    await promise;

    expect(listeners.size).toBe(0);
  });
});
