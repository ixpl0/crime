/* eslint-disable @typescript-eslint/consistent-type-imports */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { provideAppToastStore, type AppToastStore } from "./toast-store";

let store: AppToastStore;

vi.mock("vue", async () => {
  const actual = await vi.importActual<typeof import("vue")>("vue");
  return {
    ...actual,
    provide: vi.fn(),
    inject: vi.fn()
  };
});

beforeEach(() => {
  vi.useFakeTimers();
  store = provideAppToastStore();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("pushToast", () => {
  it("adds a toast with default info tone", () => {
    store.pushToast("Hello");
    expect(store.toasts.value).toHaveLength(1);
    expect(store.toasts.value[0].message).toBe("Hello");
    expect(store.toasts.value[0].tone).toBe("info");
  });

  it("trims whitespace from message", () => {
    store.pushToast("  spaced  ");
    expect(store.toasts.value[0].message).toBe("spaced");
  });

  it("returns null for empty or whitespace-only message", () => {
    expect(store.pushToast("")).toBeNull();
    expect(store.pushToast("   ")).toBeNull();
    expect(store.toasts.value).toHaveLength(0);
  });

  it("returns toast id on success", () => {
    const id = store.pushToast("test");
    expect(typeof id).toBe("number");
    expect(id).toBeGreaterThan(0);
  });

  it("assigns unique ids to different toasts", () => {
    const id1 = store.pushToast("first");
    vi.advanceTimersByTime(2000);
    const id2 = store.pushToast("second");
    expect(id1).not.toBe(id2);
  });

  it("uses specified tone", () => {
    store.pushToast("warn!", { tone: "warning" });
    expect(store.toasts.value[0].tone).toBe("warning");
  });

  it("auto-dismisses toast after default duration", () => {
    store.pushToast("temporary");
    expect(store.toasts.value).toHaveLength(1);
    vi.advanceTimersByTime(5000);
    expect(store.toasts.value).toHaveLength(0);
  });

  it("auto-dismisses after custom duration", () => {
    store.pushToast("short", { durationMs: 2000 });
    vi.advanceTimersByTime(1500);
    expect(store.toasts.value).toHaveLength(1);
    vi.advanceTimersByTime(600);
    expect(store.toasts.value).toHaveLength(0);
  });

  it("enforces minimum duration of 1000ms", () => {
    store.pushToast("too short", { durationMs: 100 });
    vi.advanceTimersByTime(500);
    expect(store.toasts.value).toHaveLength(1);
    vi.advanceTimersByTime(600);
    expect(store.toasts.value).toHaveLength(0);
  });

  it("deduplicates identical toasts within dedupe window", () => {
    const id1 = store.pushToast("same message");
    const id2 = store.pushToast("same message");
    expect(id1).toBe(id2);
    expect(store.toasts.value).toHaveLength(1);
  });

  it("allows same message after dedupe window expires", () => {
    store.pushToast("same message");
    vi.advanceTimersByTime(2000);
    store.pushToast("same message");
    expect(store.toasts.value).toHaveLength(2);
  });

  it("removes oldest toast when max count exceeded", () => {
    for (let i = 0; i < 7; i++) {
      vi.advanceTimersByTime(2000);
      store.pushToast(`toast ${String(i)}`);
    }
    expect(store.toasts.value.length).toBeLessThanOrEqual(6);
    const lastIndex = store.toasts.value.length - 1;
    expect(store.toasts.value[lastIndex].message).toBe("toast 6");
  });

  it("uses custom dedupeKey for deduplication", () => {
    store.pushToast("message A", { dedupeKey: "shared-key" });
    const id2 = store.pushToast("message B", { dedupeKey: "shared-key" });
    expect(store.toasts.value).toHaveLength(1);
    expect(store.toasts.value[0].message).toBe("message A");
    expect(id2).toBe(store.toasts.value[0].id);
  });
});

describe("pushError", () => {
  it("pushes toast with error tone", () => {
    store.pushError("Something failed");
    expect(store.toasts.value[0].tone).toBe("error");
    expect(store.toasts.value[0].message).toBe("Something failed");
  });
});

describe("dismissToast", () => {
  it("removes toast by id", () => {
    const id = store.pushToast("to dismiss") ?? -1;
    expect(store.toasts.value).toHaveLength(1);
    store.dismissToast(id);
    expect(store.toasts.value).toHaveLength(0);
  });

  it("clears auto-dismiss timeout", () => {
    const id = store.pushToast("toast") ?? -1;
    store.dismissToast(id);
    vi.advanceTimersByTime(10000);
    expect(store.toasts.value).toHaveLength(0);
  });

  it("does nothing for non-existent id", () => {
    store.pushToast("existing");
    store.dismissToast(9999);
    expect(store.toasts.value).toHaveLength(1);
  });

  it("clears dedup entry so same message can be pushed again", () => {
    const id = store.pushToast("msg") ?? -1;
    store.dismissToast(id);
    const id2 = store.pushToast("msg");
    expect(id2).not.toBe(id);
    expect(store.toasts.value).toHaveLength(1);
  });
});

describe("clearToasts", () => {
  it("removes all toasts", () => {
    vi.advanceTimersByTime(2000);
    store.pushToast("one");
    vi.advanceTimersByTime(2000);
    store.pushToast("two");
    expect(store.toasts.value).toHaveLength(2);
    store.clearToasts();
    expect(store.toasts.value).toHaveLength(0);
  });

  it("clears all pending timeouts", () => {
    store.pushToast("temp");
    store.clearToasts();
    vi.advanceTimersByTime(10000);
    expect(store.toasts.value).toHaveLength(0);
  });

  it("allows pushing again after clearing", () => {
    store.pushToast("old");
    store.clearToasts();
    store.pushToast("new");
    expect(store.toasts.value).toHaveLength(1);
    expect(store.toasts.value[0].message).toBe("new");
  });
});
