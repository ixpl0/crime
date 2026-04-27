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
    const cancellers = new Set<() => void>();
    const promise = waitForTerminalPattern(listeners, cancellers, "done", 5000);

    expect(listeners.size).toBe(1);
    expect(cancellers.size).toBe(1);
    const listener = [...listeners][0];
    listener("task done");

    const result = await promise;
    expect(result).toBe(true);
    expect(listeners.size).toBe(0);
    expect(cancellers.size).toBe(0);
  });

  it("resolves false on timeout when pattern is not found", async () => {
    const listeners = new Set<(data: string) => void>();
    const cancellers = new Set<() => void>();
    const promise = waitForTerminalPattern(listeners, cancellers, "done", 3000);

    expect(listeners.size).toBe(1);
    vi.advanceTimersByTime(3000);

    const result = await promise;
    expect(result).toBe(false);
    expect(listeners.size).toBe(0);
    expect(cancellers.size).toBe(0);
  });

  it("strips ANSI escape sequences before matching", async () => {
    const listeners = new Set<(data: string) => void>();
    const cancellers = new Set<() => void>();
    const promise = waitForTerminalPattern(listeners, cancellers, "success", 5000);

    const listener = [...listeners][0];
    listener("\x1b[32msuccess\x1b[0m");

    const result = await promise;
    expect(result).toBe(true);
  });

  it("accumulates data across multiple chunks", async () => {
    const listeners = new Set<(data: string) => void>();
    const cancellers = new Set<() => void>();
    const promise = waitForTerminalPattern(listeners, cancellers, "hello world", 5000);

    const listener = [...listeners][0];
    listener("hel");
    listener("lo wor");
    listener("ld");

    const result = await promise;
    expect(result).toBe(true);
  });

  it("trims buffer to limit when it exceeds 4096 chars", async () => {
    const listeners = new Set<(data: string) => void>();
    const cancellers = new Set<() => void>();
    const promise = waitForTerminalPattern(listeners, cancellers, "needle", 5000);

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
    const cancellers = new Set<() => void>();
    const promise = waitForTerminalPattern(listeners, cancellers, "needle", 5000);

    const listener = [...listeners][0];
    // Fill buffer then add the pattern at the end
    listener("x".repeat(5000));
    listener("needle");

    const result = await promise;
    expect(result).toBe(true);
  });

  it("handles OSC escape sequences", async () => {
    const listeners = new Set<(data: string) => void>();
    const cancellers = new Set<() => void>();
    const promise = waitForTerminalPattern(listeners, cancellers, "ready", 5000);

    const listener = [...listeners][0];
    listener("\x1b]0;title\x07ready");

    const result = await promise;
    expect(result).toBe(true);
  });

  it("cleans up listener after pattern match", async () => {
    const listeners = new Set<(data: string) => void>();
    const cancellers = new Set<() => void>();
    const promise = waitForTerminalPattern(listeners, cancellers, "done", 5000);

    const listener = [...listeners][0];
    listener("done");
    await promise;

    expect(listeners.size).toBe(0);
    expect(cancellers.size).toBe(0);
  });

  it("resolves false and clears listener when canceller is invoked", async () => {
    const listeners = new Set<(data: string) => void>();
    const cancellers = new Set<() => void>();
    const promise = waitForTerminalPattern(listeners, cancellers, "done", 30000);

    expect(cancellers.size).toBe(1);
    const cancel = [...cancellers][0];
    cancel();

    const result = await promise;
    expect(result).toBe(false);
    expect(listeners.size).toBe(0);
    expect(cancellers.size).toBe(0);
  });
});
