import { onUnmounted, type Ref } from "vue";
import { type BellReminderSettings } from "../types/project-settings";
import { playTerminalBell } from "./play-terminal-bell";

export interface UseBellReminderOptions {
  bellReminderSettings: Ref<BellReminderSettings>;
  flashFrame: () => void;
}

const BELL_REPEAT_DELAY_MS = 333;

interface BellReminderState {
  timerId: ReturnType<typeof setTimeout> | null;
  sequenceTimerId: ReturnType<typeof setTimeout> | null;
  repeatCount: number;
}

function clearReminderTimer(state: BellReminderState) {
  if (state.timerId !== null) {
    clearTimeout(state.timerId);
    state.timerId = null;
  }
}

function clearSequenceTimer(state: BellReminderState) {
  if (state.sequenceTimerId !== null) {
    clearTimeout(state.sequenceTimerId);
    state.sequenceTimerId = null;
  }
}

function clearAllTimers(state: BellReminderState) {
  clearReminderTimer(state);
  clearSequenceTimer(state);
}

function computeIntervalMs(state: BellReminderState, options: UseBellReminderOptions): number {
  const settings = options.bellReminderSettings.value;
  const baseMs = settings.intervalSeconds * 1_000;
  const deltaMs = settings.intervalDeltaSeconds * 1_000;
  return baseMs + (state.repeatCount - 1) * deltaMs;
}

function scheduleReminder(state: BellReminderState, options: UseBellReminderOptions) {
  clearReminderTimer(state);

  const settings = options.bellReminderSettings.value;
  if (!settings.enabled) {
    return;
  }

  const intervalMs = computeIntervalMs(state, options);

  state.timerId = setTimeout(() => {
    fireReminder(state, options);
  }, intervalMs);
}

function playBellSequence(state: BellReminderState, count: number, index = 0): void {
  playTerminalBell();
  if (index + 1 < count) {
    state.sequenceTimerId = setTimeout(() => { playBellSequence(state, count, index + 1); }, BELL_REPEAT_DELAY_MS);
  }
}

function fireReminder(state: BellReminderState, options: UseBellReminderOptions) {
  if (document.hasFocus()) {
    clearAllTimers(state);
    state.repeatCount = 0;
    return;
  }

  state.repeatCount += 1;
  playBellSequence(state, state.repeatCount);
  options.flashFrame();
  scheduleReminder(state, options);
}

export function useBellReminder(options: UseBellReminderOptions) {
  const state: BellReminderState = {
    timerId: null,
    sequenceTimerId: null,
    repeatCount: 0
  };

  const handleBell = () => {
    state.repeatCount = 1;
    if (document.hasFocus()) {
      clearAllTimers(state);
      return;
    }
    scheduleReminder(state, options);
  };

  const acknowledge = () => {
    clearAllTimers(state);
    state.repeatCount = 0;
  };

  onUnmounted(() => { clearAllTimers(state); });

  return { handleBell, acknowledgeBellReminder: acknowledge };
}
