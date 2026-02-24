import { type ToolbarConfig, type ToolbarElement, type ToolbarAction, type ToolbarButton } from "../types/toolbar";
import { defaultToolbarConfig } from "./default-toolbar-config";
import {
  isRecord,
  saveJsonProjectSetting
} from "../settings/settings-storage-helpers";

export const LEGACY_TOOLBAR_CONFIG_FILENAME = "toolbar.json";
export const TOOLBAR_CONFIG_FILENAME = "agent-toolbar.json";

const parseToolbarAction = (value: unknown): ToolbarAction | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (value.type === "run-command" && typeof value.command === "string") {
    return { type: "run-command", command: value.command };
  }

  if (value.type === "send-input" && typeof value.input === "string") {
    return { type: "send-input", input: value.input };
  }

  return null;
};

const parseToolbarButton = (value: unknown): ToolbarButton | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (typeof value.id !== "string" || typeof value.label !== "string") {
    return null;
  }

  const action = parseToolbarAction(value.action);
  if (!action) {
    return null;
  }

  const shortcut = typeof value.shortcut === "string" ? value.shortcut : undefined;

  return { id: value.id, label: value.label, shortcut, action };
};

const parseToolbarElement = (value: unknown): ToolbarElement | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (typeof value.id !== "string" || typeof value.label !== "string") {
    return null;
  }

  if (value.type === "dropdown") {
    if (!Array.isArray(value.items)) {
      return null;
    }

    const items = value.items
      .map((item: unknown) => parseToolbarButton(item))
      .filter((item: ToolbarButton | null): item is ToolbarButton => item !== null);

    return { type: "dropdown", id: value.id, label: value.label, items };
  }

  if (value.type === "button") {
    const action = parseToolbarAction(value.action);
    if (!action) {
      return null;
    }

    const shortcut = typeof value.shortcut === "string" ? value.shortcut : undefined;

    return { type: "button", id: value.id, label: value.label, shortcut, action };
  }

  return null;
};

export const parseToolbarConfig = (value: unknown): ToolbarConfig | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (value.version !== 1 || !Array.isArray(value.elements)) {
    return null;
  }

  const elements = value.elements
    .map((element: unknown) => parseToolbarElement(element))
    .filter((element: ToolbarElement | null): element is ToolbarElement => element !== null);

  return { version: 1, elements };
};

const readToolbarConfigFromFile = async (
  projectPath: string,
  filename: string
): Promise<ToolbarConfig | null> => {
  const response = await window.projectApi.settings.read(projectPath, filename);
  if (!response.ok || response.content == null) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(response.content);
    return parseToolbarConfig(parsed) ?? defaultToolbarConfig;
  } catch {
    return defaultToolbarConfig;
  }
};

export const loadToolbarConfig = async (projectPath: string): Promise<ToolbarConfig> => {
  try {
    const currentConfig = await readToolbarConfigFromFile(projectPath, TOOLBAR_CONFIG_FILENAME);
    if (currentConfig) {
      return currentConfig;
    }

    const legacyConfig = await readToolbarConfigFromFile(projectPath, LEGACY_TOOLBAR_CONFIG_FILENAME);
    if (legacyConfig) {
      return legacyConfig;
    }
  } catch {
    return defaultToolbarConfig;
  }

  return defaultToolbarConfig;
};

export const saveToolbarConfig = async (projectPath: string, config: ToolbarConfig): Promise<void> => {
  await saveJsonProjectSetting(projectPath, TOOLBAR_CONFIG_FILENAME, config, "agent toolbar config");
};
