import { type ToolbarConfig, type ToolbarElement, type ToolbarAction, type ToolbarButton } from "../types/toolbar";
import { defaultToolbarConfig } from "./default-toolbar-config";
import {
  isRecord,
  saveJsonProjectSetting
} from "../settings/settings-storage-helpers";

export const TOOLBAR_CONFIG_FILENAME = "agent-toolbar.json";

const parseToolbarActionRecord = (value: Record<string, unknown>): ToolbarAction | null => {
  const command = typeof value.command === "string" ? value.command : null;
  const rawInput = typeof value.rawInput === "string" ? value.rawInput : null;
  if ((command === null) === (rawInput === null)) {
    return null;
  }

  if (command !== null) {
    return { command };
  }

  if (rawInput === null) {
    return null;
  }

  return { rawInput };
};

const parseToolbarButton = (value: unknown): ToolbarButton | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (typeof value.label !== "string") {
    return null;
  }

  const action = parseToolbarActionRecord(value);
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
    const action = parseToolbarActionRecord(value);
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
    const response = await window.projectApi.settings.read(projectPath, TOOLBAR_CONFIG_FILENAME);
    if (!response.ok) {
      return defaultToolbarConfig;
    }

    if (response.content != null) {
      const config = parseToolbarConfigContent(response.content);
      if (config) {
        return config;
      }

      return defaultToolbarConfig;
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
