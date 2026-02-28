import type { Ref } from "vue";
import type { PromptSuffixConfig } from "../types/prompt-suffix";
import type { ProjectSettings } from "../types/project-settings";

export type SubmitTerminalTextResult = "submitted" | "empty" | "failed";

export interface SubmitTerminalTextMessages {
  sendSlash: string;
  sendText: string;
  submit: string;
}

export interface SubmitTerminalTextAttemptOptions {
  notReady: string;
  messages: SubmitTerminalTextMessages;
  inputType: "prompt" | "command";
}

export interface TerminalInputResponse {
  ok: boolean;
  error?: string | null;
}

export interface UseTerminalSubmitOptions {
  isTerminalReady: Ref<boolean>;
  errorMessage: Ref<string>;
  projectSettings: Ref<ProjectSettings>;
  promptSuffixConfig: Ref<PromptSuffixConfig>;
  applyPromptSuffixConfig: (config: PromptSuffixConfig) => void;
  terminalInputChunkSize: number;
  textareaSubmitActivityTimeoutCapMs: number;
  textareaSubmitQuietTimeoutCapMs: number;
  sendTerminalInputRequest: (data: string) => Promise<TerminalInputResponse>;
}
