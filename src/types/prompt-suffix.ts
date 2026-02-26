export type PromptSuffixMode = "off" | "once" | "always";

export interface PromptSuffixItem {
  readonly label: string;
  readonly value: string;
  readonly mode: PromptSuffixMode;
}

export interface PromptSuffixConfig {
  readonly items: readonly PromptSuffixItem[];
}
