export type ToolbarAction =
  | { readonly command: string; readonly rawInput?: never }
  | { readonly rawInput: string; readonly command?: never };

export type ToolbarButton = {
  readonly label: string;
  readonly shortcut?: string;
} & ToolbarAction;

export interface ToolbarDropdown {
  readonly type: "dropdown";
  readonly label: string;
  readonly items: readonly ToolbarButton[];
}

export type ToolbarStandaloneButton = {
  readonly type: "button";
  readonly label: string;
  readonly shortcut?: string;
} & ToolbarAction;

export type ToolbarElement = ToolbarDropdown | ToolbarStandaloneButton;

export interface ToolbarConfig {
  readonly elements: readonly ToolbarElement[];
}
