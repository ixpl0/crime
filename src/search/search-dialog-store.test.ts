/* eslint-disable @typescript-eslint/consistent-type-imports */
import { describe, it, expect, vi } from "vitest";
import { provideSearchDialogStore } from "./search-dialog-store";

vi.mock("vue", async () => {
  const actual = await vi.importActual<typeof import("vue")>("vue");
  return {
    ...actual,
    provide: vi.fn(),
    inject: vi.fn()
  };
});

describe("provideSearchDialogStore", () => {
  it("starts with dialog closed and no pending mode", () => {
    const store = provideSearchDialogStore();
    expect(store.isOpen.value).toBe(false);
    expect(store.pendingMode.value).toBeNull();
  });

  it("openSearchDialog opens dialog with specified mode", () => {
    const store = provideSearchDialogStore();
    store.openSearchDialog("content");
    expect(store.isOpen.value).toBe(true);
    expect(store.pendingMode.value).toBe("content");
  });

  it("openSearchDialog without mode sets pendingMode to null", () => {
    const store = provideSearchDialogStore();
    store.openSearchDialog();
    expect(store.isOpen.value).toBe(true);
    expect(store.pendingMode.value).toBeNull();
  });

  it("closeSearchDialog closes and clears pending mode", () => {
    const store = provideSearchDialogStore();
    store.openSearchDialog("names");
    store.closeSearchDialog();
    expect(store.isOpen.value).toBe(false);
    expect(store.pendingMode.value).toBeNull();
  });

  it("openSearchDialog with names mode", () => {
    const store = provideSearchDialogStore();
    store.openSearchDialog("names");
    expect(store.pendingMode.value).toBe("names");
  });
});
