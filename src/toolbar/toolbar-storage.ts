import { type ToolbarConfig, type ToolbarElement, type ToolbarAction, type ToolbarButton } from "../types/toolbar";
import { defaultToolbarConfig } from "./default-toolbar-config";

const STORAGE_KEY = "dream-ide:toolbar-config:v1";

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

export const loadToolbarConfig = (): ToolbarConfig => {
  if (typeof window === "undefined") {
    return defaultToolbarConfig;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return defaultToolbarConfig;
    }

    const parsed: unknown = JSON.parse(stored);
    const config = parseToolbarConfig(parsed);

    return config ?? defaultToolbarConfig;
  } catch {
    return defaultToolbarConfig;
  }
};

export const saveToolbarConfig = (config: ToolbarConfig): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error("Failed to save toolbar config.", error);
  }
};

export const resetToolbarConfig = (): ToolbarConfig => {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("Failed to reset toolbar config.", error);
    }
  }

  return defaultToolbarConfig;
};
