import { type ToolbarConfig, type ToolbarElement, type ToolbarAction, type ToolbarButton } from "../types/toolbar";
import { defaultToolbarConfig } from "./default-toolbar-config";

export const TOOLBAR_CONFIG_FILENAME = "toolbar.json";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

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

export const loadToolbarConfig = async (projectPath: string): Promise<ToolbarConfig> => {
  try {
    const response = await window.projectApi.settings.read(projectPath, TOOLBAR_CONFIG_FILENAME);
    if (!response.ok || !response.content) {
      return defaultToolbarConfig;
    }

    const parsed: unknown = JSON.parse(response.content);
    const config = parseToolbarConfig(parsed);

    return config ?? defaultToolbarConfig;
  } catch {
    return defaultToolbarConfig;
  }
};

export const saveToolbarConfig = async (projectPath: string, config: ToolbarConfig): Promise<void> => {
  try {
    const content = JSON.stringify(config, null, 2);
    const response = await window.projectApi.settings.write(projectPath, TOOLBAR_CONFIG_FILENAME, content);
    if (!response.ok) {
      console.error("Failed to save toolbar config:", response.error);
    }
  } catch (error) {
    console.error("Failed to save toolbar config.", error);
  }
};

export const resetToolbarConfig = async (projectPath: string): Promise<ToolbarConfig> => {
  try {
    const content = JSON.stringify(defaultToolbarConfig, null, 2);
    await window.projectApi.settings.write(projectPath, TOOLBAR_CONFIG_FILENAME, content);
  } catch (error) {
    console.error("Failed to reset toolbar config.", error);
  }

  return defaultToolbarConfig;
};
