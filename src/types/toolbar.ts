export type ToolbarActionType = "prompt" | "command" | "raw-input" | "scenario";

export type ScenarioStepType = "command" | "prompt" | "raw-input" | "wait" | "wait-for" | "delay";

export interface ScenarioStep {
  readonly type: ScenarioStepType;
  readonly value?: string;
  readonly resetTerminal?: boolean;
  readonly pattern?: string;
  readonly quietMs?: number;
  readonly timeoutMs?: number;
  readonly delayMs?: number;
}

export type ToolbarPresetColor =
  | "primary"
  | "secondary"
  | "accent"
  | "info"
  | "success"
  | "warning"
  | "error"
  | "neutral"
  | "ghost";

export type ToolbarButtonColor = ToolbarPresetColor | `#${string}` | `oklch(${string})`;

export interface ToolbarAction {
  readonly label: string;
  readonly value: string;
  readonly type: ToolbarActionType;
  readonly shortcut?: string;
  readonly color?: ToolbarButtonColor;
  readonly resetTerminal?: boolean;
  readonly lastUsed?: string | null;
  readonly done?: boolean;
  readonly steps?: readonly ScenarioStep[];
}

export interface ToolbarDropdown {
  readonly label: string;
  readonly items: readonly ToolbarAction[];
  readonly color?: ToolbarButtonColor;
}

export type ToolbarElement = ToolbarDropdown | ToolbarAction;

export interface ToolbarConfig {
  readonly elements: readonly ToolbarElement[];
}
