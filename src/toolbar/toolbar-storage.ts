import { type ToolbarConfig, type ToolbarElement, type ToolbarAction, type ToolbarButton } from "../types/toolbar";
import { defaultToolbarConfig } from "./default-toolbar-config";
import {
  isRecord,
  saveJsonProjectSetting
} from "../settings/settings-storage-helpers";

const LEGACY_TOOLBAR_CONFIG_FILENAME = "toolbar.json";
export const TOOLBAR_CONFIG_FILENAME = "agent-toolbar.json";

const parseToolbarActionRecord = (value: Record<string, unknown>): ToolbarAction | null => {
  const command = typeof value.command === "string" ? value.command : null;
  const rawInput = typeof value.rawInput === "string" ? value.rawInput : null;
  const legacyInput = typeof value.input === "string" ? value.input : null;

  const hasCommand = command !== null;
  const hasRawInput = rawInput !== null;
  const hasLegacyInput = legacyInput !== null;

  if (hasCommand && !hasRawInput && !hasLegacyInput) {
    return { command };
  }

  if (!hasCommand && hasRawInput && !hasLegacyInput) {
    return { rawInput };
  }

  // Backward compatibility for previously persisted field name.
  if (!hasCommand && !hasRawInput && hasLegacyInput) {
    return { rawInput: legacyInput };
  }

  // Backward compatibility for previously persisted action format.
  if (value.type === "run-command" && hasCommand && !hasRawInput && !hasLegacyInput) {
    return { command };
  }

  if (value.type === "send-input" && !hasCommand) {
    if (hasRawInput && !hasLegacyInput) {
      return { rawInput };
    }

    if (!hasRawInput && hasLegacyInput) {
      return { rawInput: legacyInput };
    }
  }

  return null;
};

const parseToolbarAction = (value: unknown): ToolbarAction | null => {
  if (!isRecord(value)) {
    return null;
  }

  return parseToolbarActionRecord(value);
};

const parseToolbarButton = (value: unknown): ToolbarButton | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (typeof value.label !== "string") {
    return null;
  }

  const action = parseToolbarActionRecord(value) ?? parseToolbarAction(value.action);
  if (!action) {
    return null;
  }

  const shortcut = typeof value.shortcut === "string" ? value.shortcut : undefined;

  return { label: value.label, shortcut, ...action };
};

const parseToolbarElement = (value: unknown): ToolbarElement | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (typeof value.label !== "string") {
    return null;
  }

  if (value.type === "dropdown") {
    if (!Array.isArray(value.items)) {
      return null;
    }

    const items = value.items
      .map((item: unknown) => parseToolbarButton(item))
      .filter((item: ToolbarButton | null): item is ToolbarButton => item !== null);

    return { type: "dropdown", label: value.label, items };
  }

  if (value.type === "button") {
    const action = parseToolbarActionRecord(value) ?? parseToolbarAction(value.action);
    if (!action) {
      return null;
    }

    const shortcut = typeof value.shortcut === "string" ? value.shortcut : undefined;

    return { type: "button", label: value.label, shortcut, ...action };
  }

  return null;
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

  const elements = value.elements
    .map((element: unknown) => parseToolbarElement(element))
    .filter((element: ToolbarElement | null): element is ToolbarElement => element !== null);

  return { elements };
};

const parseToolbarConfigContent = (content: string): ToolbarConfig | null => {
  try {
    const parsed: unknown = JSON.parse(content);
    return parseToolbarConfig(parsed);
  } catch {
    return null;
  }
};

export const loadToolbarConfig = async (projectPath: string): Promise<ToolbarConfig> => {
  try {
    const currentResponse = await window.projectApi.settings.read(projectPath, TOOLBAR_CONFIG_FILENAME);
    if (!currentResponse.ok) {
      return defaultToolbarConfig;
    }

    if (currentResponse.content != null) {
      const currentConfig = parseToolbarConfigContent(currentResponse.content);
      if (currentConfig) {
        return currentConfig;
      }

      return defaultToolbarConfig;
    }

    const legacyResponse = await window.projectApi.settings.read(projectPath, LEGACY_TOOLBAR_CONFIG_FILENAME);
    if (legacyResponse.ok && legacyResponse.content != null) {
      const legacyConfig = parseToolbarConfigContent(legacyResponse.content);
      if (legacyConfig) {
        await saveToolbarConfig(projectPath, legacyConfig);
        return legacyConfig;
      }
    }

    await saveToolbarConfig(projectPath, defaultToolbarConfig);
    return defaultToolbarConfig;
  } catch {
    return defaultToolbarConfig;
  }
};

export const saveToolbarConfig = async (projectPath: string, config: ToolbarConfig): Promise<void> => {
  await saveJsonProjectSetting(projectPath, TOOLBAR_CONFIG_FILENAME, config, "agent toolbar config");
};
