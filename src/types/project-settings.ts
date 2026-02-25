export interface SlashCommandSettings {
  charDelayMs: number;
  afterSlashDelayMs: number;
  enterDelayMs: number;
  activityTimeoutMs: number;
  quietTimeoutMs: number;
  dataPollIntervalMs: number;
}

export interface ZoomSettings {
  ideZoomFactor: number;
  terminalFontSize: number;
}

export interface TerminalSettings {
  panelHeight: number;
}

export interface ProjectSettings {
  slashCommand: SlashCommandSettings;
  zoom: ZoomSettings;
  terminal: TerminalSettings;
}
