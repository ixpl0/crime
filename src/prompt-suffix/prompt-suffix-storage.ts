import {
  type PromptSuffixConfig,
  type PromptSuffixItem,
  type PromptSuffixMode
} from "../types/prompt-suffix";
import { defaultPromptSuffixConfig } from "./default-prompt-suffix-config";
import {
  isRecord,
  loadJsonProjectSetting,
  saveJsonProjectSetting
} from "../settings/settings-storage-helpers";

export const PROMPT_SUFFIX_CONFIG_FILENAME = "prompt-suffixes.json";

const VALID_MODES: readonly PromptSuffixMode[] = ["off", "once", "always"];

const parsePromptSuffixItem = (value: unknown): PromptSuffixItem | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (typeof value.label !== "string" || typeof value.value !== "string") {
    return null;
  }

  let mode: PromptSuffixMode;
  if (typeof value.mode === "string" && VALID_MODES.includes(value.mode as PromptSuffixMode)) {
    mode = value.mode as PromptSuffixMode;
  } else if (typeof value.enabled === "boolean") {
    mode = value.enabled ? "always" : "off";
  } else {
    return null;
  }

  return {
    label: value.label,
    value: value.value,
    mode
  };
};

export const parsePromptSuffixConfig = (value: unknown): PromptSuffixConfig | null => {
  if (!isRecord(value)) {
    return null;
  }

  if ("version" in value && value.version !== 1) {
    return null;
  }

  if (!Array.isArray(value.items)) {
    return null;
  }

  const items: PromptSuffixItem[] = [];
  for (const rawItem of value.items) {
    const parsedItem = parsePromptSuffixItem(rawItem);
    if (!parsedItem) {
      return null;
    }

    items.push(parsedItem);
  }

  return { items };
};

export const loadPromptSuffixConfig = async (projectPath: string): Promise<PromptSuffixConfig> => {
  return loadJsonProjectSetting(
    projectPath,
    PROMPT_SUFFIX_CONFIG_FILENAME,
    parsePromptSuffixConfig,
    defaultPromptSuffixConfig,
    {
      settingLabel: "prompt suffix config"
    }
  );
};

export const savePromptSuffixConfig = async (
  projectPath: string,
  config: PromptSuffixConfig
): Promise<void> => {
  await saveJsonProjectSetting(
    projectPath,
    PROMPT_SUFFIX_CONFIG_FILENAME,
    config,
    "prompt suffix config"
  );
};
