import { type ToolbarConfig, type ToolbarElement, type ToolbarAction, type ToolbarButton } from "../types/toolbar";
import { defaultToolbarConfig } from "./default-toolbar-config";
import {
  isRecord,
  loadJsonProjectSetting,
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

    const items: ToolbarButton[] = [];
    for (const item of value.items) {
      const parsedItem = parseToolbarButton(item);
      if (!parsedItem) {
        return null;
      }

      items.push(parsedItem);
    }

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
