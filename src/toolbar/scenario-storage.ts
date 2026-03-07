import type { ScenarioStep, ScenarioStepType } from "../types/toolbar";
import { isRecord } from "../settings/settings-storage-helpers";

const SCENARIO_STEP_TYPES = new Set<string>([
  "command", "prompt", "raw-input", "wait", "delay"
]);

const isScenarioStepType = (value: unknown): value is ScenarioStepType =>
  typeof value === "string" && SCENARIO_STEP_TYPES.has(value);

const parseScenarioStep = (value: unknown): ScenarioStep | null => {
  if (!isRecord(value) || !isScenarioStepType(value.type)) {
    return null;
  }

  if (value.value !== undefined && typeof value.value !== "string") {
    return null;
  }

  return {
    type: value.type,
    ...(typeof value.value === "string" && { value: value.value }),
    ...(value.resetTerminal === true && { resetTerminal: true }),
    ...(typeof value.quietMs === "number" && value.quietMs > 0 && { quietMs: value.quietMs }),
    ...(typeof value.timeoutMs === "number" && value.timeoutMs > 0 && { timeoutMs: value.timeoutMs }),
    ...(typeof value.delayMs === "number" && value.delayMs > 0 && { delayMs: value.delayMs })
  };
};

export const parseScenarioSteps = (value: unknown): readonly ScenarioStep[] | null => {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const steps: ScenarioStep[] = [];
  for (const item of value) {
    const step = parseScenarioStep(item);
    if (!step) {
      return null;
    }
    steps.push(step);
  }

  return steps;
};
