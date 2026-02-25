import {
  type ProjectSettings,
  type SlashCommandSettings,
  type TerminalSettings,
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
export const TERMINAL_PANEL_MIN_HEIGHT = 160;
export const DEFAULT_TERMINAL_PANEL_HEIGHT = 384;

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
  terminal: {
    panelHeight: DEFAULT_TERMINAL_PANEL_HEIGHT
  }
};

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

const parseTerminalSettings = (value: unknown): TerminalSettings | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (!isNumberInRange(value.panelHeight, TERMINAL_PANEL_MIN_HEIGHT, 10000)) {
    return null;
  }

  return {
    panelHeight: value.panelHeight
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

  const parsedZoom =
    "zoom" in value ? parseZoomSettings(value.zoom) : defaultProjectSettings.zoom;
  if (!parsedZoom) {
    return null;
  }

  const parsedTerminal =
    "terminal" in value ? parseTerminalSettings(value.terminal) : defaultProjectSettings.terminal;
  if (!parsedTerminal) {
    return null;
  }

  return {
    slashCommand,
    zoom: {
      ideZoomFactor: parsedZoom.ideZoomFactor,
      terminalFontSize: parsedZoom.terminalFontSize
    },
    terminal: {
      panelHeight: parsedTerminal.panelHeight
    }
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
