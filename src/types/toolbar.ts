export type ToolbarActionType = "prompt" | "command" | "raw-input";

export interface ToolbarAction {
  readonly label: string;
  readonly value: string;
  readonly type: ToolbarActionType;
  readonly shortcut?: string;
}

export interface ToolbarDropdown {
  readonly label: string;
  readonly items: readonly ToolbarAction[];
}

export type ToolbarElement = ToolbarDropdown | ToolbarAction;

export interface ToolbarConfig {
  readonly elements: readonly ToolbarElement[];
}
