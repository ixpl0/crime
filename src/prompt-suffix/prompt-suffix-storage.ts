import {
  type PromptSuffixConfig,
  type PromptSuffixItem,
  type PromptSuffixMode
} from "../types/prompt-suffix";
import {
  isRecord,
  saveJsonProjectSetting
} from "../settings/settings-storage-helpers";
import { toErrorMessage } from "../utils/fail-fast";

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
