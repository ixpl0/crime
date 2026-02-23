export interface SlashCommandSettings {
  charDelayMs: number;
  afterSlashDelayMs: number;
  enterDelayMs: number;
  activityTimeoutMs: number;
  quietTimeoutMs: number;
  dataPollIntervalMs: number;
}

export interface ProjectSettings {
  version: 1;
  slashCommand: SlashCommandSettings;
}
