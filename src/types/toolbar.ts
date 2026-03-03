export type ToolbarActionType = "prompt" | "command" | "raw-input";

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
