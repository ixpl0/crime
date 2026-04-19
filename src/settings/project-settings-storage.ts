import {
  type AppearanceSettings,
  type BellReminderSettings,
  type ProjectSettings,
  type SlashCommandSettings,
  type ZoomSettings
} from "../types/project-settings";
import {
  isRecord,
  loadJsonProjectSetting,
  saveJsonProjectSetting
} from "./settings-storage-helpers";

export const PROJECT_SETTINGS_FILENAME = "settings.json";
export const IDE_ZOOM_FACTOR_MIN = 0.25;
export const IDE_ZOOM_FACTOR_MAX = 5;
export const DEFAULT_IDE_ZOOM_FACTOR = 1;
export const IDE_ZOOM_FACTOR_STEP = 0.1;
export const TERMINAL_FONT_SIZE_MIN = 8;
export const TERMINAL_FONT_SIZE_MAX = 32;
export const DEFAULT_TERMINAL_FONT_SIZE = 14;
export const TERMINAL_FONT_SIZE_STEP = 1;
export const BELL_REMINDER_INTERVAL_SECONDS_MIN = 5;
export const BELL_REMINDER_INTERVAL_SECONDS_MAX = 3600;
export const DEFAULT_BELL_REMINDER_INTERVAL_SECONDS = 10;
export const BELL_REMINDER_INTERVAL_DELTA_MIN = 0;
export const BELL_REMINDER_INTERVAL_DELTA_MAX = 60;
export const DEFAULT_BELL_REMINDER_INTERVAL_DELTA_SECONDS = 5;

export const defaultProjectSettings: ProjectSettings = {
  slashCommand: {
    charDelayMs: 20,
    afterSlashDelayMs: 300,
    enterDelayMs: 120,
    activityTimeoutMs: 1200,
    quietTimeoutMs: 2200,
    dataPollIntervalMs: 15
  },
  zoom: {
    ideZoomFactor: DEFAULT_IDE_ZOOM_FACTOR,
    terminalFontSize: DEFAULT_TERMINAL_FONT_SIZE
  },
  bellReminder: {
    enabled: true,
    intervalSeconds: DEFAULT_BELL_REMINDER_INTERVAL_SECONDS,
    intervalDeltaSeconds: DEFAULT_BELL_REMINDER_INTERVAL_DELTA_SECONDS
  },
  appearance: {}
};

const APPEARANCE_PRESET_COLORS = new Set<string>([
  "primary", "secondary", "accent", "info", "success", "warning", "error", "neutral", "ghost"
]);
const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const OKLCH_COLOR_PATTERN = /^oklch\(\s*[\d.]+\s+[\d.]+\s+[\d.]+\s*\)$/;

const isValidAppearanceColor = (value: unknown): value is string =>
  typeof value === "string" && (
    APPEARANCE_PRESET_COLORS.has(value) ||
    HEX_COLOR_PATTERN.test(value) ||
    OKLCH_COLOR_PATTERN.test(value)
  );

const isNonNegativeFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const isPositiveFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const isNumberInRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;

const isIntegerInRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

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

const parseZoomSettings = (value: unknown): ZoomSettings | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (
    !isNumberInRange(value.ideZoomFactor, IDE_ZOOM_FACTOR_MIN, IDE_ZOOM_FACTOR_MAX) ||
    !isIntegerInRange(value.terminalFontSize, TERMINAL_FONT_SIZE_MIN, TERMINAL_FONT_SIZE_MAX)
  ) {
    return null;
  }

  return {
    ideZoomFactor: value.ideZoomFactor,
    terminalFontSize: value.terminalFontSize
  };
};

function parseOptionalZoomSettings(value: Record<string, unknown>): ZoomSettings | null {
  if (!("zoom" in value)) {
    return defaultProjectSettings.zoom;
  }

  return parseZoomSettings(value.zoom);
}

const parseBellReminderSettings = (value: unknown): BellReminderSettings | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (typeof value.enabled !== "boolean") {
    return null;
  }

  if (!isNumberInRange(value.intervalSeconds, BELL_REMINDER_INTERVAL_SECONDS_MIN, BELL_REMINDER_INTERVAL_SECONDS_MAX)) {
    return null;
  }

  if (!isIntegerInRange(value.intervalDeltaSeconds, BELL_REMINDER_INTERVAL_DELTA_MIN, BELL_REMINDER_INTERVAL_DELTA_MAX)) {
    return null;
  }

  return {
    enabled: value.enabled,
    intervalSeconds: value.intervalSeconds,
    intervalDeltaSeconds: value.intervalDeltaSeconds
  };
};

function parseOptionalBellReminderSettings(value: Record<string, unknown>): BellReminderSettings | null {
  if (!("bellReminder" in value)) {
    return defaultProjectSettings.bellReminder;
  }

  return parseBellReminderSettings(value.bellReminder);
}

const parseAppearanceSettings = (value: unknown): AppearanceSettings | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (!("color" in value) || value.color === undefined || value.color === "") {
    return {};
  }

  if (!isValidAppearanceColor(value.color)) {
    return null;
  }

  return { color: value.color };
};

function parseOptionalAppearanceSettings(value: Record<string, unknown>): AppearanceSettings | null {
  if (!("appearance" in value)) {
    return defaultProjectSettings.appearance;
  }

  return parseAppearanceSettings(value.appearance);
}

function toProjectSettings(
  slashCommand: SlashCommandSettings,
  zoom: ZoomSettings,
  bellReminder: BellReminderSettings,
  appearance: AppearanceSettings
): ProjectSettings {
  return {
    slashCommand,
    zoom: {
      ideZoomFactor: zoom.ideZoomFactor,
      terminalFontSize: zoom.terminalFontSize
    },
    bellReminder: {
      enabled: bellReminder.enabled,
      intervalSeconds: bellReminder.intervalSeconds,
      intervalDeltaSeconds: bellReminder.intervalDeltaSeconds
    },
    appearance: appearance.color === undefined ? {} : { color: appearance.color }
  };
}

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

  const parsedZoom = parseOptionalZoomSettings(value);
  if (parsedZoom === null) {
    return null;
  }

  const parsedBellReminder = parseOptionalBellReminderSettings(value);
  if (parsedBellReminder === null) {
    return null;
  }

  const parsedAppearance = parseOptionalAppearanceSettings(value);
  if (parsedAppearance === null) {
    return null;
  }

  return toProjectSettings(slashCommand, parsedZoom, parsedBellReminder, parsedAppearance);
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
