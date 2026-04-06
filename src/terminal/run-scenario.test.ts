import { describe, it, expect, vi, beforeEach } from "vitest";
import { runScenario } from "./run-scenario";
import type { ScenarioStep } from "../types/toolbar";
import type { SubmitTerminalTextAttemptOptions, SubmitTerminalTextResult } from "./terminal-submit-types";

const createMockDeps = () => ({
  isTerminalReady: vi.fn<() => boolean>(() => true),
  resetTerminal: vi.fn<() => Promise<boolean>>(() => Promise.resolve(true)),
  attemptSubmitTerminalText: vi.fn<(text: string, options: SubmitTerminalTextAttemptOptions) => Promise<SubmitTerminalTextResult>>(
    () => Promise.resolve("submitted")
  ),
  sendTerminalInput: vi.fn<(data: string, fallback: string) => Promise<boolean>>(
    () => Promise.resolve(true)
  ),
  waitForTerminalQuiet: vi.fn<(quietMs: number, timeoutMs: number) => Promise<void>>(
    () => Promise.resolve()
  ),
  waitForTerminalPattern: vi.fn<(pattern: string, timeoutMs: number) => Promise<boolean>>(
    () => Promise.resolve(true)
  )
});

describe("runScenario", () => {
  let deps: ReturnType<typeof createMockDeps>;

  beforeEach(() => {
    deps = createMockDeps();
  });

  it("returns true for empty steps array", async () => {
    const result = await runScenario(deps, []);
    expect(result).toBe(true);
  });

  it("executes command step via attemptSubmitTerminalText", async () => {
    const steps: ScenarioStep[] = [{ type: "command", value: "npm test" }];
    const result = await runScenario(deps, steps);

    expect(result).toBe(true);
    expect(deps.attemptSubmitTerminalText).toHaveBeenCalledWith(
      "npm test",
      expect.objectContaining({ inputType: "command" })
    );
  });

  it("executes prompt step via attemptSubmitTerminalText", async () => {
    const steps: ScenarioStep[] = [{ type: "prompt", value: "review code" }];
    const result = await runScenario(deps, steps);

    expect(result).toBe(true);
    expect(deps.attemptSubmitTerminalText).toHaveBeenCalledWith(
      "review code",
      expect.objectContaining({ inputType: "prompt" })
    );
  });

  it("executes raw-input step via sendTerminalInput", async () => {
    const steps: ScenarioStep[] = [{ type: "raw-input", value: "y\n" }];
    const result = await runScenario(deps, steps);

    expect(result).toBe(true);
    expect(deps.sendTerminalInput).toHaveBeenCalledWith(
      "y\n",
      "Не удалось отправить ввод в сценарии."
    );
  });

  it("executes wait step via waitForTerminalQuiet", async () => {
    const steps: ScenarioStep[] = [{ type: "wait", quietMs: 1000, timeoutMs: 10000 }];
    const result = await runScenario(deps, steps);

    expect(result).toBe(true);
    expect(deps.waitForTerminalQuiet).toHaveBeenCalledWith(1000, 10000);
  });

  it("uses default values for wait step", async () => {
    const steps: ScenarioStep[] = [{ type: "wait" }];
    await runScenario(deps, steps);

    expect(deps.waitForTerminalQuiet).toHaveBeenCalledWith(500, 30000);
  });

  it("executes wait-for step via waitForTerminalPattern", async () => {
    const steps: ScenarioStep[] = [{ type: "wait-for", pattern: "ready>", timeoutMs: 5000 }];
    const result = await runScenario(deps, steps);

    expect(result).toBe(true);
    expect(deps.waitForTerminalPattern).toHaveBeenCalledWith("ready>", 5000);
  });

  it("returns false for wait-for step without pattern", async () => {
    const steps: ScenarioStep[] = [{ type: "wait-for" }];
    const result = await runScenario(deps, steps);

    expect(result).toBe(false);
  });

  it("executes delay step", async () => {
    vi.useFakeTimers();
    const steps: ScenarioStep[] = [{ type: "delay", delayMs: 100 }];
    const promise = runScenario(deps, steps);

    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result).toBe(true);
    vi.useRealTimers();
  });

  it("uses default delay of 1000ms", async () => {
    vi.useFakeTimers();
    const steps: ScenarioStep[] = [{ type: "delay" }];
    const promise = runScenario(deps, steps);

    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toBe(true);
    vi.useRealTimers();
  });

  it("returns false when terminal is not ready for non-delay step", async () => {
    deps.isTerminalReady.mockReturnValue(false);
    const steps: ScenarioStep[] = [{ type: "command", value: "npm test" }];
    const result = await runScenario(deps, steps);

    expect(result).toBe(false);
    expect(deps.attemptSubmitTerminalText).not.toHaveBeenCalled();
  });

  it("allows delay step when terminal is not ready", async () => {
    vi.useFakeTimers();
    deps.isTerminalReady.mockReturnValue(false);
    const steps: ScenarioStep[] = [{ type: "delay", delayMs: 50 }];
    const promise = runScenario(deps, steps);

    await vi.advanceTimersByTimeAsync(50);
    const result = await promise;

    expect(result).toBe(true);
    vi.useRealTimers();
  });

  it("resets terminal before step when resetTerminal is true", async () => {
    const steps: ScenarioStep[] = [{ type: "command", value: "test", resetTerminal: true }];
    await runScenario(deps, steps);

    expect(deps.resetTerminal).toHaveBeenCalledOnce();
  });

  it("returns false when reset fails", async () => {
    deps.resetTerminal.mockResolvedValue(false);
    const steps: ScenarioStep[] = [{ type: "command", value: "test", resetTerminal: true }];
    const result = await runScenario(deps, steps);

    expect(result).toBe(false);
  });

  it("stops execution when a step fails", async () => {
    deps.attemptSubmitTerminalText
      .mockResolvedValueOnce("submitted" as never)
      .mockResolvedValueOnce("failed" as never);

    const steps: ScenarioStep[] = [
      { type: "command", value: "step1" },
      { type: "command", value: "step2" },
      { type: "command", value: "step3" }
    ];
    const result = await runScenario(deps, steps);

    expect(result).toBe(false);
    expect(deps.attemptSubmitTerminalText).toHaveBeenCalledTimes(2);
  });

  it("executes multiple steps sequentially", async () => {
    const callOrder: string[] = [];
    deps.attemptSubmitTerminalText.mockImplementation((text: string) => {
      callOrder.push(text);
      return Promise.resolve("submitted" as const);
    });
    deps.sendTerminalInput.mockImplementation((data: string) => {
      callOrder.push(data);
      return Promise.resolve(true);
    });

    const steps: ScenarioStep[] = [
      { type: "command", value: "cmd1" },
      { type: "raw-input", value: "input1" },
      { type: "command", value: "cmd2" }
    ];
    const result = await runScenario(deps, steps);

    expect(result).toBe(true);
    expect(callOrder).toEqual(["cmd1", "input1", "cmd2"]);
  });

  it("allows resetTerminal step when terminal is not ready", async () => {
    deps.isTerminalReady.mockReturnValue(false);
    const steps: ScenarioStep[] = [{ type: "command", value: "test", resetTerminal: true }];
    const result = await runScenario(deps, steps);

    expect(deps.resetTerminal).toHaveBeenCalledOnce();
    // After reset, terminal still returns false but step proceeds (reset was called)
    expect(result).toBe(true);
  });

  it("uses empty string for command value when undefined", async () => {
    const steps: ScenarioStep[] = [{ type: "command" }];
    await runScenario(deps, steps);

    expect(deps.attemptSubmitTerminalText).toHaveBeenCalledWith(
      "",
      expect.anything()
    );
  });
});
