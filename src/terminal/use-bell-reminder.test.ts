// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ref } from "vue";
import { type BellReminderSettings } from "../types/project-settings";
import { useBellReminder } from "./use-bell-reminder";

vi.mock("./play-terminal-bell", () => ({
  playTerminalBell: vi.fn()
}));

const { playTerminalBell } = vi.mocked(await import("./play-terminal-bell"));

const BELL_REPEAT_DELAY_MS = 333;

function createOptions(overrides: Partial<BellReminderSettings> = {}) {
  const bellReminderSettings = ref<BellReminderSettings>({
    enabled: true,
    intervalMinutes: 1,
    ...overrides
  });
  const flashFrame = vi.fn();
  return { bellReminderSettings, flashFrame };
}

describe("useBellReminder", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.spyOn(document, "hasFocus").mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not fire when disabled", () => {
    const options = createOptions({ enabled: false });
    const { handleBell } = useBellReminder(options);

    handleBell();
    vi.advanceTimersByTime(120_000);

    expect(playTerminalBell).not.toHaveBeenCalled();
    expect(options.flashFrame).not.toHaveBeenCalled();
  });

  it("fires once after interval with 1 bell on first reminder", () => {
    const options = createOptions({ intervalMinutes: 1 });
    const { handleBell } = useBellReminder(options);

    handleBell();
    vi.advanceTimersByTime(59_999);
    expect(playTerminalBell).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(playTerminalBell).toHaveBeenCalledTimes(1);
    expect(options.flashFrame).toHaveBeenCalledTimes(1);
  });

  it("escalates bell count on each successive reminder", () => {
    const options = createOptions({ intervalMinutes: 1 });
    const { handleBell } = useBellReminder(options);

    handleBell();

    // First reminder: 1 bell
    vi.advanceTimersByTime(60_000);
    expect(playTerminalBell).toHaveBeenCalledTimes(1);

    // Second reminder: 2 bells (1 immediate + 1 after delay)
    vi.advanceTimersByTime(60_000);
    expect(playTerminalBell).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(BELL_REPEAT_DELAY_MS);
    expect(playTerminalBell).toHaveBeenCalledTimes(3);

    // Third reminder: 3 bells
    vi.advanceTimersByTime(60_000 - BELL_REPEAT_DELAY_MS);
    expect(playTerminalBell).toHaveBeenCalledTimes(4);
    vi.advanceTimersByTime(BELL_REPEAT_DELAY_MS);
    expect(playTerminalBell).toHaveBeenCalledTimes(5);
    vi.advanceTimersByTime(BELL_REPEAT_DELAY_MS);
    expect(playTerminalBell).toHaveBeenCalledTimes(6);
  });

  it("resets escalation when handleBell is called again", () => {
    const options = createOptions({ intervalMinutes: 1 });
    const { handleBell } = useBellReminder(options);

    handleBell();
    vi.advanceTimersByTime(60_000); // 1st reminder: 1 bell
    vi.advanceTimersByTime(60_000); // 2nd reminder: 2 bells
    vi.advanceTimersByTime(BELL_REPEAT_DELAY_MS);

    playTerminalBell.mockClear();
    options.flashFrame.mockClear();

    // New bell event resets counter
    handleBell();
    vi.advanceTimersByTime(60_000);
    expect(playTerminalBell).toHaveBeenCalledTimes(1);
    expect(options.flashFrame).toHaveBeenCalledTimes(1);
  });

  it("stops reminders on acknowledge", () => {
    const options = createOptions({ intervalMinutes: 1 });
    const { handleBell, acknowledgeBellReminder } = useBellReminder(options);

    handleBell();
    vi.advanceTimersByTime(60_000); // 1st reminder
    expect(playTerminalBell).toHaveBeenCalledTimes(1);

    playTerminalBell.mockClear();
    acknowledgeBellReminder();

    vi.advanceTimersByTime(300_000);
    expect(playTerminalBell).not.toHaveBeenCalled();
  });

  it("resets escalation after acknowledge and new bell", () => {
    const options = createOptions({ intervalMinutes: 1 });
    const { handleBell, acknowledgeBellReminder } = useBellReminder(options);

    handleBell();
    vi.advanceTimersByTime(60_000); // 1st: 1 bell
    vi.advanceTimersByTime(60_000); // 2nd: 2 bells
    vi.advanceTimersByTime(BELL_REPEAT_DELAY_MS);

    acknowledgeBellReminder();
    playTerminalBell.mockClear();

    // Fresh start — should be 1 bell again
    handleBell();
    vi.advanceTimersByTime(60_000);
    expect(playTerminalBell).toHaveBeenCalledTimes(1);
  });

  it("flashes frame on each reminder", () => {
    const options = createOptions({ intervalMinutes: 1 });
    const { handleBell } = useBellReminder(options);

    handleBell();
    vi.advanceTimersByTime(60_000);
    vi.advanceTimersByTime(60_000);
    vi.advanceTimersByTime(60_000);

    expect(options.flashFrame).toHaveBeenCalledTimes(3);
  });

  it("does not schedule reminder when window is focused on bell", () => {
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    const options = createOptions({ intervalMinutes: 1 });
    const { handleBell } = useBellReminder(options);

    handleBell();
    vi.advanceTimersByTime(120_000);

    expect(playTerminalBell).not.toHaveBeenCalled();
    expect(options.flashFrame).not.toHaveBeenCalled();
  });

  it("auto-acknowledges when window gains focus before reminder fires", () => {
    const hasFocusMock = vi.spyOn(document, "hasFocus").mockReturnValue(false);
    const options = createOptions({ intervalMinutes: 1 });
    const { handleBell } = useBellReminder(options);

    handleBell();

    // Window gains focus before the reminder fires
    hasFocusMock.mockReturnValue(true);
    vi.advanceTimersByTime(60_000);

    expect(playTerminalBell).not.toHaveBeenCalled();
    expect(options.flashFrame).not.toHaveBeenCalled();

    // No further reminders scheduled
    vi.advanceTimersByTime(300_000);
    expect(playTerminalBell).not.toHaveBeenCalled();
  });

  it("acknowledge stops bell sequence mid-play", () => {
    const options = createOptions({ intervalMinutes: 1 });
    const { handleBell, acknowledgeBellReminder } = useBellReminder(options);

    handleBell();

    // Trigger 3rd reminder (3 bells expected)
    vi.advanceTimersByTime(60_000); // 1st reminder
    vi.advanceTimersByTime(60_000); // 2nd reminder
    vi.advanceTimersByTime(BELL_REPEAT_DELAY_MS);
    vi.advanceTimersByTime(60_000 - BELL_REPEAT_DELAY_MS); // 3rd reminder

    playTerminalBell.mockClear();

    // First delayed bell plays
    vi.advanceTimersByTime(BELL_REPEAT_DELAY_MS);
    expect(playTerminalBell).toHaveBeenCalledTimes(1);

    // Acknowledge mid-sequence
    acknowledgeBellReminder();

    // Remaining bells should not play
    vi.advanceTimersByTime(BELL_REPEAT_DELAY_MS * 10);
    expect(playTerminalBell).toHaveBeenCalledTimes(1);
  });

  it("plays bell sequence with correct delays", () => {
    const options = createOptions({ intervalMinutes: 1 });
    const { handleBell } = useBellReminder(options);

    handleBell();

    // Advance past 1st and 2nd reminders (+ drain 2nd bell sequence)
    vi.advanceTimersByTime(60_000);
    vi.advanceTimersByTime(60_000);
    vi.advanceTimersByTime(BELL_REPEAT_DELAY_MS);

    playTerminalBell.mockClear();

    // 3rd reminder fires: repeatCount=3 → 3 bells
    vi.advanceTimersByTime(60_000 - BELL_REPEAT_DELAY_MS);
    expect(playTerminalBell).toHaveBeenCalledTimes(1); // immediate
    vi.advanceTimersByTime(BELL_REPEAT_DELAY_MS);
    expect(playTerminalBell).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(BELL_REPEAT_DELAY_MS);
    expect(playTerminalBell).toHaveBeenCalledTimes(3);
    // No more
    vi.advanceTimersByTime(BELL_REPEAT_DELAY_MS);
    expect(playTerminalBell).toHaveBeenCalledTimes(3);
  });
});
