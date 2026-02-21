export type ToolbarAction =
  | { readonly type: "run-command"; readonly command: string }
  | { readonly type: "send-input"; readonly input: string };

export interface ToolbarButton {
  readonly id: string;
  readonly label: string;
  readonly shortcut?: string;
  readonly action: ToolbarAction;
}

export interface ToolbarDropdown {
  readonly type: "dropdown";
  readonly id: string;
  readonly label: string;
  readonly items: readonly ToolbarButton[];
}

export interface ToolbarStandaloneButton {
  readonly type: "button";
  readonly id: string;
  readonly label: string;
  readonly shortcut?: string;
  readonly action: ToolbarAction;
}

export type ToolbarElement = ToolbarDropdown | ToolbarStandaloneButton;

export interface ToolbarConfig {
  readonly version: 1;
  readonly elements: readonly ToolbarElement[];
}
