import {
  type ToolbarAction,
  type ToolbarActionType,
  type ToolbarButtonColor,
  type ToolbarPresetColor,
  type ToolbarConfig,
  type ToolbarElement,
  type ScenarioStep
} from "../types/toolbar";
import { parseScenarioSteps } from "./scenario-storage";
import defaultAgentToolbarJson from "../defaults/agent-toolbar.json";
import {
  isRecord,
  loadJsonProjectSetting,
  saveJsonProjectSetting
} from "../settings/settings-storage-helpers";

export const TOOLBAR_CONFIG_FILENAME = "agent-toolbar.json";


const TOOLBAR_PRESET_COLORS = new Set<string>([
  "primary", "secondary", "accent", "info", "success", "warning", "error", "neutral", "ghost"
]);

const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const OKLCH_COLOR_PATTERN = /^oklch\(\s*[\d.]+\s+[\d.]+\s+[\d.]+\s*\)$/;

const isToolbarButtonColor = (value: unknown): value is ToolbarButtonColor =>
  typeof value === "string" && (
    TOOLBAR_PRESET_COLORS.has(value) ||
    HEX_COLOR_PATTERN.test(value) ||
    OKLCH_COLOR_PATTERN.test(value)
  );

const ICON_NAME_PATTERN = /^[A-Z][a-zA-Z0-9]*$/;
const isIconName = (value: unknown): value is string =>
  typeof value === "string" && ICON_NAME_PATTERN.test(value);

export const isToolbarPresetColor = (value: string): value is ToolbarPresetColor =>
  TOOLBAR_PRESET_COLORS.has(value);

const isToolbarActionType = (value: unknown): value is ToolbarActionType =>
  value === "prompt" || value === "command" || value === "raw-input" || value === "scenario";

interface ParsedLastUsed {
  readonly valid: true;
  readonly value: string | null | undefined;
}

interface ParsedDone {
  readonly valid: true;
  readonly value: boolean | undefined;
}

interface ParsedInvalid {
  readonly valid: false;
}

const TRACKING_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;

function parseToolbarActionLastUsed(
  raw: unknown
): ParsedLastUsed | ParsedInvalid {
  if (raw === undefined) {
    return { valid: true, value: undefined };
  }
  if (raw === null) {
    return { valid: true, value: null };
  }
  if (typeof raw === "string" && TRACKING_DATETIME_PATTERN.test(raw)) {
    return { valid: true, value: raw };
  }
  return { valid: false };
}

function parseToolbarActionDone(
  raw: unknown
): ParsedDone | ParsedInvalid {
  if (raw === undefined) {
    return { valid: true, value: undefined };
  }
  if (typeof raw === "boolean") {
    return { valid: true, value: raw };
  }
  return { valid: false };
}

function parseToolbarActionResetFlag(value: Record<string, unknown>) {
  const resetTerminal = value.resetTerminal;
  if (resetTerminal !== undefined && resetTerminal !== true) {
    return null;
  }

  return resetTerminal === true ? true : undefined;
}

function resolveScenarioDefinition(value: Record<string, unknown>) {
  const steps = parseScenarioSteps(value.steps);
  if (!steps) {
    return null;
  }
  return { value: "", type: "scenario" as const, steps };
}

function resolveToolbarActionDefinition(
  value: Record<string, unknown>,
  resetTerminal: true | undefined
) {
  if ("type" in value && !isToolbarActionType(value.type)) {
    return null;
  }

  const explicitType = isToolbarActionType(value.type) ? value.type : null;
  if (explicitType === "scenario") {
    return resolveScenarioDefinition(value);
  }

  if ("value" in value && typeof value.value !== "string") {
    return null;
  }

  const explicitValue = typeof value.value === "string" ? value.value : null;
  const canUseImplicitResetAction =
    resetTerminal === true &&
    (value.value === undefined || value.value === "") &&
    (value.type === undefined || value.type === "command");
  if (explicitValue === null && !canUseImplicitResetAction) {
    return null;
  }
  if (explicitType === null && !canUseImplicitResetAction) {
    return null;
  }

  return {
    value: explicitValue ?? "",
    type: explicitType ?? ("command" as const)
  };
}

function parseToolbarActionTracking(value: Record<string, unknown>): {
  readonly lastUsed: string | null | undefined;
  readonly done: boolean | undefined;
} | null {
  const parsedLastUsed = parseToolbarActionLastUsed(value.lastUsed);
  if (!parsedLastUsed.valid) {
    return null;
  }

  const parsedDone = parseToolbarActionDone(value.done);
  if (!parsedDone.valid) {
    return null;
  }

  return { lastUsed: parsedLastUsed.value, done: parsedDone.value };
}

interface ActionDefinition {
  readonly value: string;
  readonly type: ToolbarActionType;
  readonly steps?: readonly ScenarioStep[];
}

function buildToolbarAction(
  value: Record<string, unknown>,
  label: string,
  resetTerminal: true | undefined,
  definition: ActionDefinition,
  tracking: { readonly lastUsed: string | null | undefined; readonly done: boolean | undefined }
): ToolbarAction {
  const shortcut = typeof value.shortcut === "string" ? value.shortcut : undefined;
  const icon = isIconName(value.icon) ? value.icon : undefined;
  const color = isToolbarButtonColor(value.color) ? value.color : undefined;

  return {
    label,
    value: definition.value,
    type: definition.type,
    ...(icon !== undefined && { icon }),
    ...(shortcut !== undefined && { shortcut }),
    ...(color !== undefined && { color }),
    ...(resetTerminal !== undefined && { resetTerminal }),
    ...(tracking.lastUsed !== undefined && { lastUsed: tracking.lastUsed }),
    ...(tracking.done !== undefined && { done: tracking.done }),
    ...(definition.steps !== undefined && { steps: definition.steps })
  };
}

const parseToolbarAction = (value: unknown): ToolbarAction | null => {
  if (!isRecord(value) || typeof value.label !== "string") {
    return null;
  }

  const resetTerminal = parseToolbarActionResetFlag(value);
  if (resetTerminal === null) {
    return null;
  }

  const actionDefinition = resolveToolbarActionDefinition(value, resetTerminal);
  if (!actionDefinition) {
    return null;
  }

  const tracking = parseToolbarActionTracking(value);
  if (!tracking) {
    return null;
  }

  return buildToolbarAction(value, value.label, resetTerminal, actionDefinition, tracking);
};

const parseToolbarElement = (value: unknown): ToolbarElement | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (Array.isArray(value.items)) {
    if (typeof value.label !== "string") {
      return null;
    }

    const items: ToolbarElement[] = [];
    for (const item of value.items) {
      const parsedItem = parseToolbarElement(item);
      if (!parsedItem) {
        return null;
      }

      items.push(parsedItem);
    }

    const icon = isIconName(value.icon) ? value.icon : undefined;
    const color = isToolbarButtonColor(value.color) ? value.color : undefined;
    return { label: value.label, items, ...(icon !== undefined && { icon }), color };
  }

  return parseToolbarAction(value);
};

export const parseToolbarConfig = (value: unknown): ToolbarConfig | null => {
  if (!isRecord(value)) {
    return null;
  }

  if ("version" in value && value.version !== 1) {
    return null;
  }

  if (!Array.isArray(value.elements)) {
    return null;
  }

  const elements: ToolbarElement[] = [];
  for (const element of value.elements) {
    const parsedElement = parseToolbarElement(element);
    if (!parsedElement) {
      return null;
    }

    elements.push(parsedElement);
  }

  return { elements };
};

const parsedDefaultToolbarConfig = parseToolbarConfig(defaultAgentToolbarJson);
if (!parsedDefaultToolbarConfig) {
  throw new Error("Default agent toolbar config is invalid");
}
export const defaultToolbarConfig: ToolbarConfig = parsedDefaultToolbarConfig;

function serializeActionOptionalFields(target: Record<string, unknown>, action: ToolbarAction) {
  if (action.icon) { target.icon = action.icon; }
  if (action.shortcut) { target.shortcut = action.shortcut; }
  if (action.color) { target.color = action.color; }
  if (action.resetTerminal) { target.resetTerminal = true; }
  if (action.lastUsed !== undefined) { target.lastUsed = action.lastUsed; }
  if (action.done !== undefined) { target.done = action.done; }
}

function serializeToolbarAction(action: ToolbarAction) {
  const result: Record<string, unknown> = { label: action.label };

  if (action.type === "scenario") {
    result.type = "scenario";
    if (action.steps) { result.steps = action.steps; }
  } else if (!(action.resetTerminal && action.type === "command" && action.value.length === 0)) {
    result.value = action.value;
    result.type = action.type;
  }

  serializeActionOptionalFields(result, action);
  return result;
}

function serializeToolbarElement(element: ToolbarElement) {
  if (!("items" in element)) {
    return serializeToolbarAction(element);
  }

  const serializedElement: Record<string, unknown> = {
    label: element.label,
    items: element.items.map(serializeToolbarElement)
  };
  if (element.icon) {
    serializedElement.icon = element.icon;
  }
  if (element.color) {
    serializedElement.color = element.color;
  }

  return serializedElement;
}

export const serializeToolbarConfig = (config: ToolbarConfig) => ({
  elements: config.elements.map(serializeToolbarElement)
});

export const loadToolbarConfig = async (projectPath: string): Promise<ToolbarConfig> => {
  return loadJsonProjectSetting(
    projectPath,
    TOOLBAR_CONFIG_FILENAME,
    parseToolbarConfig,
    defaultToolbarConfig,
    {
      settingLabel: "agent toolbar config",
      persistFallbackValue: defaultAgentToolbarJson
    }
  );
};

export const saveToolbarConfig = async (projectPath: string, config: ToolbarConfig): Promise<void> => {
  await saveJsonProjectSetting(
    projectPath,
    TOOLBAR_CONFIG_FILENAME,
    serializeToolbarConfig(config),
    "agent toolbar config"
  );
};

