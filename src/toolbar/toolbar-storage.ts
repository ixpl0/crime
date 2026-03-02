import {
  type ToolbarAction,
  type ToolbarActionType,
  type ToolbarButtonColor,
  type ToolbarPresetColor,
  type ToolbarConfig,
  type ToolbarElement
} from "../types/toolbar";
import defaultAgentToolbarJson from "../defaults/agent-toolbar.json";
import {
  isRecord,
  loadJsonProjectSetting,
  saveJsonProjectSetting
} from "../settings/settings-storage-helpers";

export const TOOLBAR_CONFIG_FILENAME = "agent-toolbar.json";

export const defaultToolbarConfig = defaultAgentToolbarJson as unknown as ToolbarConfig;

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

export const isToolbarPresetColor = (value: string): value is ToolbarPresetColor =>
  TOOLBAR_PRESET_COLORS.has(value);

const isToolbarActionType = (value: unknown): value is ToolbarActionType =>
  value === "prompt" || value === "command" || value === "raw-input";

function parseToolbarActionResetFlag(value: Record<string, unknown>) {
  const resetTerminal = value.resetTerminal;
  if (resetTerminal !== undefined && resetTerminal !== true) {
    return null;
  }

  return resetTerminal === true ? true : undefined;
}

function resolveToolbarActionDefinition(
  value: Record<string, unknown>,
  resetTerminal: true | undefined
) {
  if ("value" in value && typeof value.value !== "string") {
    return null;
  }
  if ("type" in value && !isToolbarActionType(value.type)) {
    return null;
  }

  const explicitValue = typeof value.value === "string" ? value.value : null;
  const explicitType = isToolbarActionType(value.type) ? value.type : null;
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
    type: explicitType ?? "command"
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

  const shortcut = typeof value.shortcut === "string" ? value.shortcut : undefined;
  const color = isToolbarButtonColor(value.color) ? value.color : undefined;

  return {
    label: value.label,
    value: actionDefinition.value,
    type: actionDefinition.type,
    ...(shortcut !== undefined && { shortcut }),
    ...(color !== undefined && { color }),
    ...(resetTerminal !== undefined && { resetTerminal })
  };
};

const parseToolbarElement = (value: unknown): ToolbarElement | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (Array.isArray(value.items)) {
    if (typeof value.label !== "string") {
      return null;
    }

    const items: ToolbarAction[] = [];
    for (const item of value.items) {
      const parsedItem = parseToolbarAction(item);
      if (!parsedItem) {
        return null;
      }

      items.push(parsedItem);
    }

    const color = isToolbarButtonColor(value.color) ? value.color : undefined;
    return { label: value.label, items, color };
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

function serializeToolbarAction(action: ToolbarAction) {
  const serializedAction: Record<string, unknown> = {
    label: action.label
  };

  if (!(action.resetTerminal && action.type === "command" && action.value.length === 0)) {
    serializedAction.value = action.value;
    serializedAction.type = action.type;
  }

  if (action.shortcut) {
    serializedAction.shortcut = action.shortcut;
  }
  if (action.color) {
    serializedAction.color = action.color;
  }
  if (action.resetTerminal) {
    serializedAction.resetTerminal = true;
  }

  return serializedAction;
}

function serializeToolbarElement(element: ToolbarElement) {
  if (!("items" in element)) {
    return serializeToolbarAction(element);
  }

  const serializedElement: Record<string, unknown> = {
    label: element.label,
    items: element.items.map(serializeToolbarAction)
  };
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
