/* eslint-disable max-lines-per-function */
import { type Ref } from "vue";
import { type ToolbarAction } from "../types/toolbar";
import {
  type SubmitTerminalTextAttemptOptions,
  type SubmitTerminalTextResult
} from "./terminal-submit-types";
import { runScenario } from "./run-scenario";

interface TerminalActionsDeps {
  readonly isTerminalReady: Ref<boolean>;
  readonly resetTerminal: () => Promise<boolean>;
  readonly attemptSubmitTerminalText: (
    text: string,
    options: SubmitTerminalTextAttemptOptions
  ) => Promise<SubmitTerminalTextResult>;
  readonly sendTerminalInput: (
    data: string,
    fallbackErrorMessage: string
  ) => Promise<boolean>;
  readonly waitForTerminalQuiet: (quietMs: number, timeoutMs: number) => Promise<void>;
  readonly waitForTerminalPattern: (pattern: string, timeoutMs: number) => Promise<boolean>;
  readonly focusTerminal: () => void;
  readonly getTodoEntry: (index: number) => string | null;
  readonly removeTodoEntry: (index: number) => void;
  readonly appendTerminalInputHistory: (text: string) => void;
}

export function useTerminalActions({
  isTerminalReady,
  resetTerminal,
  attemptSubmitTerminalText,
  sendTerminalInput,
  waitForTerminalQuiet,
  waitForTerminalPattern,
  focusTerminal,
  getTodoEntry,
  removeTodoEntry,
  appendTerminalInputHistory
}: TerminalActionsDeps) {
  return {
    executeToolbarAction,
    sendQuickKey,
    sendTodoEntryToTerminal
  };

  function executeToolbarAction(action: ToolbarAction) {
    void performToolbarAction(action);
  }

  async function performToolbarAction(action: ToolbarAction) {
    if (action.type === "scenario") {
      if (action.steps) {
        await runScenario(
          {
            isTerminalReady: () => isTerminalReady.value,
            resetTerminal,
            attemptSubmitTerminalText,
            sendTerminalInput,
            waitForTerminalQuiet,
            waitForTerminalPattern,
            focusTerminal
          },
          action.steps
        );
      }
      return;
    }

    if (action.resetTerminal) {
      const didReset = await resetTerminal();
      if (!didReset) {
        return;
      }
    } else if (!isTerminalReady.value) {
      return;
    }

    if (action.value.length === 0) {
      return;
    }

    if (action.type === "prompt") {
      await runToolbarPrompt(action.value);
      return;
    }

    if (action.type === "raw-input") {
      await sendTerminalInput(
        action.value,
        "Failed to send raw input to terminal."
      );
      return;
    }

    await runTerminalCommand(action.value);
  }

  async function runTerminalCommand(command: string) {
    const result = await attemptSubmitTerminalText(command, {
      notReady: "Terminal is not ready to run commands.",
      messages: {
        sendSlash: "Failed to send slash command to terminal.",
        sendText: "Failed to send command text to terminal.",
        submit: "Failed to submit command in terminal."
      },
      inputType: "command"
    });
    if (result !== "submitted") {
      return;
    }

    focusTerminal();
  }

  async function runToolbarPrompt(promptText: string) {
    const result = await attemptSubmitTerminalText(promptText, {
      notReady: "Terminal is not ready to send prompt.",
      messages: {
        sendSlash: "Failed to send slash command from prompt.",
        sendText: "Failed to send prompt text to terminal.",
        submit: "Failed to submit prompt in terminal."
      },
      inputType: "prompt"
    });
    if (result !== "submitted") {
      return;
    }

    focusTerminal();
  }

  function sendQuickKey(data: string) {
    if (!isTerminalReady.value) {
      return;
    }

    void sendTerminalInput(data, "Failed to send quick key to terminal.");
  }

  async function sendTodoEntryToTerminal(index: number) {
    const text = getTodoEntry(index);
    if (text === null) {
      return;
    }

    const result = await attemptSubmitTerminalText(text, {
      notReady: "Terminal is not ready to send input.",
      messages: {
        sendSlash: "Failed to send slash command from todo to terminal.",
        sendText: "Failed to send todo prompt to terminal.",
        submit: "Failed to send Enter to terminal."
      },
      inputType: "prompt"
    });
    if (result !== "submitted") {
      return;
    }

    appendTerminalInputHistory(text);
    removeTodoEntry(index);
  }
}
