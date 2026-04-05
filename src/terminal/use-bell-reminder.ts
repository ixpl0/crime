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
  repeatCount: number;
}

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
    fireReminder(state, options);
  }, intervalMs);
}

function playBellSequence(count: number, index = 0): void {
  playTerminalBell();
  if (index + 1 < count) {
    setTimeout(() => { playBellSequence(count, index + 1); }, BELL_REPEAT_DELAY_MS);
  }
}

function fireReminder(state: BellReminderState, options: UseBellReminderOptions) {
  state.repeatCount += 1;
  playBellSequence(state.repeatCount);
  options.flashFrame();
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
