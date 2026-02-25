export interface PromptSuffixItem {
  readonly label: string;
  readonly value: string;
  readonly enabled: boolean;
}

export interface PromptSuffixConfig {
  readonly items: readonly PromptSuffixItem[];
}
