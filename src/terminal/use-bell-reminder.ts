import { onUnmounted, type Ref } from "vue";
import { type BellReminderSettings } from "../types/project-settings";
import { playTerminalBell } from "./play-terminal-bell";

export interface UseBellReminderOptions {
  bellReminderSettings: Ref<BellReminderSettings>;
  flashFrame: () => void;
  pushToast: (message: string, options?: { tone?: "info" | "warning"; durationMs?: number; dedupeKey?: string }) => number | null;
}

interface BellReminderState {
  timerId: ReturnType<typeof setTimeout> | null;
  repeatCount: number;
}

const TOAST_DURATION_MS = 6000;
const TOAST_ESCALATED_DURATION_MS = 15_000;
const ESCALATION_THRESHOLD = 2;

function clearTimer(state: BellReminderState) {
  if (state.timerId !== null) {
    clearTimeout(state.timerId);
    state.timerId = null;
  }
}

function scheduleReminder(state: BellReminderState, options: UseBellReminderOptions) {
  clearTimer(state);

  const settings = options.bellReminderSettings.value;
  if (!settings.enabled) {
    return;
  }

  const intervalMs = settings.intervalMinutes * 60_000;

  state.timerId = setTimeout(() => {
    state.repeatCount += 1;
    fireReminder(state, options);
  }, intervalMs);
}

function fireReminder(state: BellReminderState, options: UseBellReminderOptions) {
  playTerminalBell();
  options.flashFrame();

  const isEscalated = state.repeatCount > ESCALATION_THRESHOLD;
  options.pushToast("Терминал ждёт реакции", {
    tone: isEscalated ? "warning" : "info",
    durationMs: isEscalated ? TOAST_ESCALATED_DURATION_MS : TOAST_DURATION_MS,
    dedupeKey: "bell-reminder"
  });

  scheduleReminder(state, options);
}

export function useBellReminder(options: UseBellReminderOptions) {
  const state: BellReminderState = {
    timerId: null,
    repeatCount: 0
  };

  const handleBell = () => {
    state.repeatCount = 0;
    scheduleReminder(state, options);
  };

  const acknowledge = () => {
    clearTimer(state);
    state.repeatCount = 0;
  };

  onUnmounted(() => { clearTimer(state); });

  return { handleBell, acknowledgeBellReminder: acknowledge };
}
