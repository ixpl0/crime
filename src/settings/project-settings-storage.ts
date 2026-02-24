import { type ProjectSettings, type SlashCommandSettings } from "../types/project-settings";
import {
  isRecord,
  loadJsonProjectSetting,
  saveJsonProjectSetting
} from "./settings-storage-helpers";

export const PROJECT_SETTINGS_FILENAME = "settings.json";

export const defaultProjectSettings: ProjectSettings = {
  slashCommand: {
    charDelayMs: 20,
    afterSlashDelayMs: 300,
    enterDelayMs: 120,
    activityTimeoutMs: 1200,
    quietTimeoutMs: 2200,
    dataPollIntervalMs: 15
  }
};

const isNonNegativeFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const isPositiveFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const parseSlashCommandSettings = (value: unknown): SlashCommandSettings | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (
    !isNonNegativeFiniteNumber(value.charDelayMs) ||
    !isNonNegativeFiniteNumber(value.afterSlashDelayMs) ||
    !isNonNegativeFiniteNumber(value.enterDelayMs) ||
    !isPositiveFiniteNumber(value.activityTimeoutMs) ||
    !isPositiveFiniteNumber(value.quietTimeoutMs) ||
    !isPositiveFiniteNumber(value.dataPollIntervalMs)
  ) {
    return null;
  }

  return {
    charDelayMs: value.charDelayMs,
    afterSlashDelayMs: value.afterSlashDelayMs,
    enterDelayMs: value.enterDelayMs,
    activityTimeoutMs: value.activityTimeoutMs,
    quietTimeoutMs: value.quietTimeoutMs,
    dataPollIntervalMs: value.dataPollIntervalMs
  };
};

export const parseProjectSettings = (value: unknown): ProjectSettings | null => {
  if (!isRecord(value)) {
    return null;
  }

  if ("version" in value && value.version !== 1) {
    return null;
  }

  const slashCommand = parseSlashCommandSettings(value.slashCommand);
  if (!slashCommand) {
    return null;
  }

  return {
    slashCommand
  };
};

export const loadProjectSettings = async (projectPath: string): Promise<ProjectSettings> => {
  return loadJsonProjectSetting(
    projectPath,
    PROJECT_SETTINGS_FILENAME,
    parseProjectSettings,
    defaultProjectSettings,
    {
      settingLabel: "project settings"
    }
  );
};

export const saveProjectSettings = async (
  projectPath: string,
  settings: ProjectSettings
): Promise<void> => {
  await saveJsonProjectSetting(projectPath, PROJECT_SETTINGS_FILENAME, settings, "project settings");
};
