import {
  type PromptSuffixConfig,
  type PromptSuffixItem
} from "../types/prompt-suffix";
import { defaultPromptSuffixConfig } from "./default-prompt-suffix-config";
import {
  isRecord,
  loadJsonProjectSetting,
  saveJsonProjectSetting
} from "../settings/settings-storage-helpers";

export const PROMPT_SUFFIX_CONFIG_FILENAME = "prompt-suffixes.json";

const parsePromptSuffixItem = (value: unknown): PromptSuffixItem | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.label !== "string" ||
    typeof value.value !== "string" ||
    typeof value.enabled !== "boolean"
  ) {
    return null;
  }

  return {
    label: value.label,
    value: value.value,
    enabled: value.enabled
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
