import { inject, provide, ref, type InjectionKey, type Ref } from "vue";

export type ToastTone = "info" | "success" | "warning" | "error";

export interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

export interface PushToastOptions {
  tone?: ToastTone;
  durationMs?: number;
  dedupeWindowMs?: number;
  dedupeKey?: string;
}

export interface AppToastStore {
  toasts: Readonly<Ref<ToastItem[]>>;
  pushToast: (message: string, options?: PushToastOptions) => number | null;
  pushError: (message: string, options?: Omit<PushToastOptions, "tone">) => number | null;
  dismissToast: (id: number) => void;
  clearToasts: () => void;
}

const APP_TOAST_STORE_KEY: InjectionKey<AppToastStore> = Symbol(
  "crime-app-toast-store"
);

const DEFAULT_DURATION_MS = 4500;
const DEFAULT_DEDUPE_WINDOW_MS = 1500;
const MAX_TOASTS = 6;
const RECENT_TOAST_RETENTION_MS = 30000;
const RECENT_TOAST_SWEEP_THRESHOLD = 32;

interface RecentToastEntry {
  id: number;
  shownAt: number;
}

interface ToastState {
  toasts: Ref<ToastItem[]>;
  activeTimeouts: Map<number, ReturnType<typeof setTimeout>>;
  recentToasts: Map<string, RecentToastEntry>;
  nextToastId: number;
}

function dismissToast(state: ToastState, id: number) {
  const activeTimeout = state.activeTimeouts.get(id);
  if (activeTimeout !== undefined) {
    clearTimeout(activeTimeout);
    state.activeTimeouts.delete(id);
  }

  state.toasts.value = state.toasts.value.filter((toast) => toast.id !== id);

  for (const [key, entry] of state.recentToasts.entries()) {
    if (entry.id === id) {
      state.recentToasts.delete(key);
    }
  }
}

function clearToasts(state: ToastState) {
  for (const timeoutId of state.activeTimeouts.values()) {
    clearTimeout(timeoutId);
  }

  state.activeTimeouts.clear();
  state.recentToasts.clear();
  state.toasts.value = [];
}

function findRecentDuplicate(
  state: ToastState,
  dedupeKey: string,
  dedupeWindowMs: number
): number | null {
  const recentEntry = state.recentToasts.get(dedupeKey);
  if (recentEntry && Date.now() - recentEntry.shownAt < dedupeWindowMs) {
    return recentEntry.id;
  }

  return null;
}

function sweepStaleRecentToasts(state: ToastState) {
  if (state.recentToasts.size < RECENT_TOAST_SWEEP_THRESHOLD) {
    return;
  }

  const now = Date.now();
  for (const [key, entry] of state.recentToasts.entries()) {
    if (now - entry.shownAt >= RECENT_TOAST_RETENTION_MS) {
      state.recentToasts.delete(key);
    }
  }
}

function pushToast(state: ToastState, message: string, options: PushToastOptions = {}) {
  const trimmedMessage = message.trim();
  if (trimmedMessage.length === 0) {
    return null;
  }

  const tone = options.tone ?? "info";
  const dedupeWindowMs = options.dedupeWindowMs ?? DEFAULT_DEDUPE_WINDOW_MS;
  const dedupeKey = options.dedupeKey ?? `${tone}:${trimmedMessage}`;
  sweepStaleRecentToasts(state);
  const duplicateId = findRecentDuplicate(state, dedupeKey, dedupeWindowMs);
  if (duplicateId !== null) {
    return duplicateId;
  }

  const id = state.nextToastId++;
  const toast: ToastItem = { id, message: trimmedMessage, tone };

  if (state.toasts.value.length >= MAX_TOASTS) {
    dismissToast(state, state.toasts.value[0]?.id ?? id);
  }

  state.toasts.value = [...state.toasts.value, toast];
  state.recentToasts.set(dedupeKey, { id, shownAt: Date.now() });

  const durationMs = Math.max(options.durationMs ?? DEFAULT_DURATION_MS, 1000);
  const timeoutId = setTimeout(() => { dismissToast(state, id); }, durationMs);
  state.activeTimeouts.set(id, timeoutId);

  return id;
}

export function provideAppToastStore(): AppToastStore {
  const state: ToastState = {
    toasts: ref<ToastItem[]>([]),
    activeTimeouts: new Map(),
    recentToasts: new Map(),
    nextToastId: 1
  };

  const store: AppToastStore = {
    toasts: state.toasts,
    pushToast: (message, options) => pushToast(state, message, options),
    pushError: (message, options = {}) => pushToast(state, message, { ...options, tone: "error" }),
    dismissToast: (id) => { dismissToast(state, id); },
    clearToasts: () => { clearToasts(state); }
  };

  provide(APP_TOAST_STORE_KEY, store);
  return store;
}

export function useAppToastStore(): AppToastStore {
  const store = inject(APP_TOAST_STORE_KEY);
  if (store === undefined) {
    throw new Error("App toast store is not available.");
  }

  return store;
}
