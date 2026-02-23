import { type ProjectSettings, type SlashCommandSettings } from "../types/project-settings";

export const PROJECT_SETTINGS_FILENAME = "settings.json";

export const defaultProjectSettings: ProjectSettings = {
  version: 1,
  slashCommand: {
    charDelayMs: 10,
    afterSlashDelayMs: 200,
    enterDelayMs: 60,
    activityTimeoutMs: 400,
    quietTimeoutMs: 700,
    dataPollIntervalMs: 10
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

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
  if (!isRecord(value) || value.version !== 1) {
    return null;
  }

  const slashCommand = parseSlashCommandSettings(value.slashCommand);
  if (!slashCommand) {
    return null;
  }

  return {
    version: 1,
    slashCommand
  };
};

export const loadProjectSettings = async (projectPath: string): Promise<ProjectSettings> => {
  try {
    const response = await window.projectApi.settings.read(projectPath, PROJECT_SETTINGS_FILENAME);
    if (!response.ok || !response.content) {
      return defaultProjectSettings;
    }

    const parsed: unknown = JSON.parse(response.content);
    const config = parseProjectSettings(parsed);
    return config ?? defaultProjectSettings;
  } catch {
    return defaultProjectSettings;
  }
};

export const saveProjectSettings = async (
  projectPath: string,
  settings: ProjectSettings
): Promise<void> => {
  try {
    const content = JSON.stringify(settings, null, 2);
    const response = await window.projectApi.settings.write(
      projectPath,
      PROJECT_SETTINGS_FILENAME,
      content
    );
    if (!response.ok) {
      console.error("Failed to save project settings:", response.error);
    }
  } catch (error) {
    console.error("Failed to save project settings.", error);
  }
};

