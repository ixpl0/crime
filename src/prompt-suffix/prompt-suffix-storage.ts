import {
  type PromptSuffixConfig,
  type PromptSuffixItem
} from "../types/prompt-suffix";
import {
  isRecord,
  saveJsonProjectSetting
} from "../settings/settings-storage-helpers";
import { toErrorMessage } from "../utils/fail-fast";

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
  const response = await window.projectApi.settings.read(projectPath, PROMPT_SUFFIX_CONFIG_FILENAME);
  if (!response.ok) {
    throw new Error(toErrorMessage(response.error, "Failed to read prompt suffix config."));
  }

  if (!response.content) {
    throw new Error("Prompt suffix config file is missing.");
  }

  let parsedContent: unknown;
  try {
    parsedContent = JSON.parse(response.content);
  } catch (error) {
    throw new Error(toErrorMessage(error, "Prompt suffix config has invalid JSON."));
  }

  const parsedConfig = parsePromptSuffixConfig(parsedContent);
  if (!parsedConfig) {
    throw new Error("Prompt suffix config has invalid structure.");
  }

  return parsedConfig;
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
