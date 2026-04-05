import { computed, onUnmounted, ref, watch, type ComputedRef, type Ref } from "vue";
import { playTerminalBell } from "../terminal/play-terminal-bell";

const NUDGE_ENABLED_STORAGE_KEY = "crime:nudge-enabled";
const NUDGE_INTERVAL_STORAGE_KEY = "crime:nudge-interval-minutes";
const DEFAULT_NUDGE_INTERVAL_MINUTES = 15;
const MIN_NUDGE_INTERVAL_MINUTES = 1;
const ESCALATION_LEVEL_2_DELAY_MS = 5 * 60_000;
const ESCALATION_LEVEL_3_DELAY_MS = 3 * 60_000;
const TOAST_DURATION_LEVEL_1_MS = 4500;
const TOAST_DURATION_LEVEL_2_MS = 8000;
const TOAST_DURATION_LEVEL_3_MS = 30_000;
const DOUBLE_BELL_DELAY_MS = 200;
const MAX_DISPLAY_TEXT_LENGTH = 120;

interface NudgePushToastOptions {
  tone?: "info" | "success" | "warning" | "error";
  durationMs?: number;
  dedupeKey?: string;
}

export interface UseTodoNudgeOptions {
  todoDraftViewItems: Ref<ReadonlyArray<{ value: string }>>;
  pushToast: (message: string, options?: NudgePushToastOptions) => number | null;
  flashFrame: () => void;
}

interface NudgeState {
  escalationLevel: number;
  nudgeTimerId: ReturnType<typeof setTimeout> | null;
  escalationTimerId: ReturnType<typeof setTimeout> | null;
}

interface NudgeContext {
  readonly state: NudgeState;
  readonly options: UseTodoNudgeOptions;
  readonly isNudgeEnabled: Ref<boolean>;
  readonly nudgeIntervalMinutes: Ref<number>;
  readonly nudgeIntervalMs: ComputedRef<number>;
  readonly hasNonEmptyTodos: ComputedRef<boolean>;
}

const loadNudgeEnabled = (): boolean =>
  localStorage.getItem(NUDGE_ENABLED_STORAGE_KEY) === "1";

const loadNudgeIntervalMinutes = (): number => {
  const stored = localStorage.getItem(NUDGE_INTERVAL_STORAGE_KEY);
  if (stored === null) {
    return DEFAULT_NUDGE_INTERVAL_MINUTES;
  }
  const parsed = Number(stored);
  return Number.isFinite(parsed) && parsed >= MIN_NUDGE_INTERVAL_MINUTES
    ? parsed
    : DEFAULT_NUDGE_INTERVAL_MINUTES;
};

const pickRandomTodoText = (entries: ReadonlyArray<{ value: string }>): string | null => {
  const nonEmpty = entries.filter((entry) => entry.value.trim().length > 0);
  if (nonEmpty.length === 0) {
    return null;
  }
  const randomIndex = Math.floor(Math.random() * nonEmpty.length);
  return nonEmpty[randomIndex]?.value.trim() ?? null;
};

const truncateText = (text: string, maxLength: number): string =>
  text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;

function clearNudgeTimer(state: NudgeState) {
  if (state.nudgeTimerId !== null) {
    clearTimeout(state.nudgeTimerId);
    state.nudgeTimerId = null;
  }
}

function clearEscalationTimer(state: NudgeState) {
  if (state.escalationTimerId !== null) {
    clearTimeout(state.escalationTimerId);
    state.escalationTimerId = null;
  }
}

function clearAllTimers(state: NudgeState) {
  clearNudgeTimer(state);
  clearEscalationTimer(state);
}

function playDoubleBell() {
  playTerminalBell();
  setTimeout(() => { playTerminalBell(); }, DOUBLE_BELL_DELAY_MS);
}

function showNudgeNotification(ctx: NudgeContext, displayText: string) {
  const level = ctx.state.escalationLevel;

  if (level >= 2) {
    playDoubleBell();
    ctx.options.pushToast(displayText, {
      tone: "warning", durationMs: TOAST_DURATION_LEVEL_3_MS, dedupeKey: "nudge"
    });
  } else if (level >= 1) {
    playTerminalBell();
    ctx.options.pushToast(displayText, {
      tone: "info", durationMs: TOAST_DURATION_LEVEL_2_MS, dedupeKey: "nudge"
    });
  } else {
    playTerminalBell();
    ctx.options.pushToast(displayText, {
      tone: "info", durationMs: TOAST_DURATION_LEVEL_1_MS, dedupeKey: "nudge"
    });
  }

  ctx.options.flashFrame();
}

function scheduleNextNudge(ctx: NudgeContext) {
  clearAllTimers(ctx.state);
  ctx.state.escalationLevel = 0;

  if (!ctx.isNudgeEnabled.value) {
    return;
  }

  ctx.state.nudgeTimerId = setTimeout(() => {
    fireNudge(ctx);
  }, ctx.nudgeIntervalMs.value);
}

function scheduleEscalation(ctx: NudgeContext) {
  clearEscalationTimer(ctx.state);

  const nextLevel = ctx.state.escalationLevel + 1;
  if (nextLevel > 2) {
    scheduleNextNudge(ctx);
    return;
  }

  const delayMs = nextLevel === 1
    ? ESCALATION_LEVEL_2_DELAY_MS
    : ESCALATION_LEVEL_3_DELAY_MS;

  ctx.state.escalationTimerId = setTimeout(() => {
    ctx.state.escalationLevel = nextLevel;
    fireNudge(ctx);
  }, delayMs);
}

function fireNudge(ctx: NudgeContext) {
  if (!ctx.hasNonEmptyTodos.value) {
    scheduleNextNudge(ctx);
    return;
  }

  const todoText = pickRandomTodoText(ctx.options.todoDraftViewItems.value);
  if (todoText === null) {
    scheduleNextNudge(ctx);
    return;
  }

  showNudgeNotification(ctx, truncateText(todoText, MAX_DISPLAY_TEXT_LENGTH));
  scheduleEscalation(ctx);
}

function acknowledgeNudge(ctx: NudgeContext) {
  const hadEscalation = ctx.state.escalationLevel > 0 || ctx.state.escalationTimerId !== null;
  ctx.state.escalationLevel = 0;
  clearEscalationTimer(ctx.state);

  if (hadEscalation || ctx.state.nudgeTimerId === null) {
    scheduleNextNudge(ctx);
  }
}

function createNudgeContext(options: UseTodoNudgeOptions): NudgeContext {
  const isNudgeEnabled = ref(loadNudgeEnabled());
  const nudgeIntervalMinutes = ref(loadNudgeIntervalMinutes());
  return {
    state: { escalationLevel: 0, nudgeTimerId: null, escalationTimerId: null },
    options,
    isNudgeEnabled,
    nudgeIntervalMinutes,
    nudgeIntervalMs: computed(() => nudgeIntervalMinutes.value * 60_000),
    hasNonEmptyTodos: computed(() =>
      options.todoDraftViewItems.value.some((entry) => entry.value.trim().length > 0)
    )
  };
}

function toggleNudgeEnabled(ctx: NudgeContext) {
  ctx.isNudgeEnabled.value = !ctx.isNudgeEnabled.value;
  localStorage.setItem(NUDGE_ENABLED_STORAGE_KEY, ctx.isNudgeEnabled.value ? "1" : "0");
}

function setNudgeIntervalMinutes(ctx: NudgeContext, minutes: number) {
  const clamped = Math.max(MIN_NUDGE_INTERVAL_MINUTES, Math.round(minutes));
  ctx.nudgeIntervalMinutes.value = clamped;
  localStorage.setItem(NUDGE_INTERVAL_STORAGE_KEY, String(clamped));
  if (ctx.isNudgeEnabled.value) {
    scheduleNextNudge(ctx);
  }
}

function setupNudgeLifecycle(ctx: NudgeContext) {
  watch(ctx.isNudgeEnabled, (enabled) => {
    if (enabled) {
      scheduleNextNudge(ctx);
    } else {
      clearAllTimers(ctx.state);
    }
  });

  if (ctx.isNudgeEnabled.value) {
    scheduleNextNudge(ctx);
  }

  onUnmounted(() => { clearAllTimers(ctx.state); });
}

export function useTodoNudge(options: UseTodoNudgeOptions) {
  const ctx = createNudgeContext(options);
  setupNudgeLifecycle(ctx);

  return {
    isNudgeEnabled: ctx.isNudgeEnabled,
    nudgeIntervalMinutes: ctx.nudgeIntervalMinutes,
    toggleNudgeEnabled: () => { toggleNudgeEnabled(ctx); },
    setNudgeIntervalMinutes: (minutes: number) => { setNudgeIntervalMinutes(ctx, minutes); },
    acknowledgeNudge: () => { acknowledgeNudge(ctx); }
  };
}
