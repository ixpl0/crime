import {
  type ToolbarAction,
  type ToolbarActionType,
  type ToolbarConfig,
  type ToolbarElement
} from "../types/toolbar";
import { defaultToolbarConfig } from "./default-toolbar-config";
import {
  isRecord,
  loadJsonProjectSetting,
  saveJsonProjectSetting
} from "../settings/settings-storage-helpers";

export const TOOLBAR_CONFIG_FILENAME = "agent-toolbar.json";

const isToolbarActionType = (value: unknown): value is ToolbarActionType =>
  value === "prompt" || value === "command" || value === "raw-input";

const parseToolbarAction = (value: unknown): ToolbarAction | null => {
  if (!isRecord(value) || typeof value.label !== "string") {
    return null;
  }

  const shortcut = typeof value.shortcut === "string" ? value.shortcut : undefined;

  if (typeof value.value !== "string" || !isToolbarActionType(value.type)) {
    return null;
  }

  return {
    label: value.label,
    value: value.value,
    type: value.type,
    shortcut
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

    return { label: value.label, items };
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

export const loadToolbarConfig = async (projectPath: string): Promise<ToolbarConfig> => {
  return loadJsonProjectSetting(
    projectPath,
    TOOLBAR_CONFIG_FILENAME,
    parseToolbarConfig,
    defaultToolbarConfig,
    {
      settingLabel: "agent toolbar config"
    }
  );
};

export const saveToolbarConfig = async (projectPath: string, config: ToolbarConfig): Promise<void> => {
  await saveJsonProjectSetting(projectPath, TOOLBAR_CONFIG_FILENAME, config, "agent toolbar config");
};
