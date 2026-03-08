import type { ScenarioStep } from "../types/toolbar";
import type {
  SubmitTerminalTextAttemptOptions,
  SubmitTerminalTextResult
} from "./terminal-submit-types";

const DEFAULT_QUIET_MS = 500;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_DELAY_MS = 1000;

interface ScenarioRunnerDeps {
  readonly isTerminalReady: () => boolean;
  readonly resetTerminal: () => Promise<boolean>;
  readonly attemptSubmitTerminalText: (
    text: string,
    options: SubmitTerminalTextAttemptOptions
  ) => Promise<SubmitTerminalTextResult>;
  readonly sendTerminalInput: (
    data: string,
    fallbackErrorMessage: string
  ) => Promise<boolean>;
  readonly waitForTerminalQuiet: (quietMs: number, timeoutMs: number) => Promise<void>;
  readonly waitForTerminalPattern: (pattern: string, timeoutMs: number) => Promise<boolean>;
  readonly focusTerminal: () => void;
}

const delay = (ms: number) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const executeCommandStep = async (
  deps: ScenarioRunnerDeps,
  value: string
): Promise<boolean> => {
  const result = await deps.attemptSubmitTerminalText(value, {
    notReady: "Terminal is not ready to run scenario command.",
    messages: {
      sendSlash: "Failed to send slash command in scenario.",
      sendText: "Failed to send command text in scenario.",
      submit: "Failed to submit command in scenario."
    },
    inputType: "command"
  });
  return result === "submitted";
};

const executePromptStep = async (
  deps: ScenarioRunnerDeps,
  value: string
): Promise<boolean> => {
  const result = await deps.attemptSubmitTerminalText(value, {
    notReady: "Terminal is not ready to send scenario prompt.",
    messages: {
      sendSlash: "Failed to send slash command from scenario prompt.",
      sendText: "Failed to send scenario prompt text.",
      submit: "Failed to submit scenario prompt."
    },
    inputType: "prompt"
  });
  return result === "submitted";
};

const executeScenarioStep = async (
  deps: ScenarioRunnerDeps,
  step: ScenarioStep
): Promise<boolean> => {
  switch (step.type) {
    case "command":
      return executeCommandStep(deps, step.value ?? "");

    case "prompt":
      return executePromptStep(deps, step.value ?? "");

    case "raw-input":
      return deps.sendTerminalInput(
        step.value ?? "",
        "Failed to send raw input in scenario."
      );

    case "wait":
      await deps.waitForTerminalQuiet(
        step.quietMs ?? DEFAULT_QUIET_MS,
        step.timeoutMs ?? DEFAULT_TIMEOUT_MS
      );
      return true;

    case "wait-for":
      return step.pattern
        ? deps.waitForTerminalPattern(step.pattern, step.timeoutMs ?? DEFAULT_TIMEOUT_MS)
        : false;

    case "delay":
      await delay(step.delayMs ?? DEFAULT_DELAY_MS);
      return true;
  }
};

const handleStepReset = async (
  deps: ScenarioRunnerDeps,
  step: ScenarioStep
): Promise<boolean> => {
  if (!step.resetTerminal) {
    return true;
  }
  return deps.resetTerminal();
};

export const runScenario = async (
  deps: ScenarioRunnerDeps,
  steps: readonly ScenarioStep[]
): Promise<boolean> => {
  for (const step of steps) {
    if (!deps.isTerminalReady() && step.type !== "delay" && !step.resetTerminal) {
      return false;
    }

    const resetOk = await handleStepReset(deps, step);
    if (!resetOk) {
      return false;
    }

    const stepOk = await executeScenarioStep(deps, step);
    if (!stepOk) {
      return false;
    }
  }

  deps.focusTerminal();
  return true;
};
