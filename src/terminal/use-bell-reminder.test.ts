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

  it("fires 2 bells on first reminder (terminal bell counts as 1st)", () => {
    const options = createOptions({ intervalMinutes: 1 });
    const { handleBell } = useBellReminder(options);

    handleBell();
    vi.advanceTimersByTime(59_999);
    expect(playTerminalBell).not.toHaveBeenCalled();

    // First reminder: 2 bells (terminal was #1, reminder starts at #2)
    vi.advanceTimersByTime(1);
    expect(playTerminalBell).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(BELL_REPEAT_DELAY_MS);
    expect(playTerminalBell).toHaveBeenCalledTimes(2);
    expect(options.flashFrame).toHaveBeenCalledTimes(1);
  });

  it("escalates bell count on each successive reminder", () => {
    const options = createOptions({ intervalMinutes: 1 });
    const { handleBell } = useBellReminder(options);

    handleBell();

    // First reminder: 2 bells
    vi.advanceTimersByTime(60_000);
    expect(playTerminalBell).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(BELL_REPEAT_DELAY_MS);
    expect(playTerminalBell).toHaveBeenCalledTimes(2);

    // Second reminder: 3 bells
    vi.advanceTimersByTime(60_000 - BELL_REPEAT_DELAY_MS);
    expect(playTerminalBell).toHaveBeenCalledTimes(3);
    vi.advanceTimersByTime(BELL_REPEAT_DELAY_MS);
    expect(playTerminalBell).toHaveBeenCalledTimes(4);
    vi.advanceTimersByTime(BELL_REPEAT_DELAY_MS);
    expect(playTerminalBell).toHaveBeenCalledTimes(5);

    // Third reminder: 4 bells
    vi.advanceTimersByTime(60_000 - BELL_REPEAT_DELAY_MS * 2);
    expect(playTerminalBell).toHaveBeenCalledTimes(6);
    vi.advanceTimersByTime(BELL_REPEAT_DELAY_MS);
    expect(playTerminalBell).toHaveBeenCalledTimes(7);
    vi.advanceTimersByTime(BELL_REPEAT_DELAY_MS);
    expect(playTerminalBell).toHaveBeenCalledTimes(8);
    vi.advanceTimersByTime(BELL_REPEAT_DELAY_MS);
    expect(playTerminalBell).toHaveBeenCalledTimes(9);
  });

  it("resets escalation when handleBell is called again", () => {
    const options = createOptions({ intervalMinutes: 1 });
    const { handleBell } = useBellReminder(options);

    handleBell();
    vi.advanceTimersByTime(60_000); // 1st reminder: 2 bells
    vi.advanceTimersByTime(BELL_REPEAT_DELAY_MS);
    vi.advanceTimersByTime(60_000 - BELL_REPEAT_DELAY_MS); // 2nd reminder: 3 bells
    vi.advanceTimersByTime(BELL_REPEAT_DELAY_MS * 2);

    playTerminalBell.mockClear();
    options.flashFrame.mockClear();

    // New bell event resets counter — first reminder plays 2 bells again
    handleBell();
    vi.advanceTimersByTime(60_000);
    expect(playTerminalBell).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(BELL_REPEAT_DELAY_MS);
    expect(playTerminalBell).toHaveBeenCalledTimes(2);
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
    vi.advanceTimersByTime(60_000); // 1st: 2 bells
    vi.advanceTimersByTime(BELL_REPEAT_DELAY_MS);
    vi.advanceTimersByTime(60_000 - BELL_REPEAT_DELAY_MS); // 2nd: 3 bells
    vi.advanceTimersByTime(BELL_REPEAT_DELAY_MS * 2);

    acknowledgeBellReminder();
    playTerminalBell.mockClear();

    // Fresh start — should be 2 bells again
    handleBell();
    vi.advanceTimersByTime(60_000);
    expect(playTerminalBell).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(BELL_REPEAT_DELAY_MS);
    expect(playTerminalBell).toHaveBeenCalledTimes(2);
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

    // Drain 1st reminder (2 bells), trigger 2nd reminder (3 bells)
    vi.advanceTimersByTime(60_000);
    vi.advanceTimersByTime(BELL_REPEAT_DELAY_MS);
    vi.advanceTimersByTime(60_000 - BELL_REPEAT_DELAY_MS);

    playTerminalBell.mockClear();

    // First delayed bell of 2nd reminder plays
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

    // Drain 1st reminder (2 bells) and 2nd reminder (3 bells)
    vi.advanceTimersByTime(60_000);
    vi.advanceTimersByTime(BELL_REPEAT_DELAY_MS);
    vi.advanceTimersByTime(60_000 - BELL_REPEAT_DELAY_MS);
    vi.advanceTimersByTime(BELL_REPEAT_DELAY_MS * 2);

    playTerminalBell.mockClear();

    // 3rd reminder fires: repeatCount=4 → 4 bells
    vi.advanceTimersByTime(60_000 - BELL_REPEAT_DELAY_MS * 2);
    expect(playTerminalBell).toHaveBeenCalledTimes(1); // immediate
    vi.advanceTimersByTime(BELL_REPEAT_DELAY_MS);
    expect(playTerminalBell).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(BELL_REPEAT_DELAY_MS);
    expect(playTerminalBell).toHaveBeenCalledTimes(3);
    vi.advanceTimersByTime(BELL_REPEAT_DELAY_MS);
    expect(playTerminalBell).toHaveBeenCalledTimes(4);
    // No more
    vi.advanceTimersByTime(BELL_REPEAT_DELAY_MS);
    expect(playTerminalBell).toHaveBeenCalledTimes(4);
  });
});
