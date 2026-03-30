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
            waitForTerminalPattern
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
        "Не удалось отправить ввод в терминал."
      );
      return;
    }

    await runTerminalCommand(action.value);
  }

  async function runTerminalCommand(command: string) {
    const result = await attemptSubmitTerminalText(command, {
      notReady: "Терминал не готов к выполнению команд.",
      messages: {
        sendSlash: "Не удалось отправить слеш-команду в терминал.",
        sendText: "Не удалось отправить текст команды в терминал.",
        submit: "Не удалось выполнить команду в терминале."
      },
      inputType: "command"
    });
    if (result !== "submitted") {
      return;
    }
  }

  async function runToolbarPrompt(promptText: string) {
    const result = await attemptSubmitTerminalText(promptText, {
      notReady: "Терминал не готов к отправке промпта.",
      messages: {
        sendSlash: "Не удалось отправить слеш-команду из промпта.",
        sendText: "Не удалось отправить текст промпта в терминал.",
        submit: "Не удалось отправить промпт в терминал."
      },
      inputType: "prompt"
    });
    if (result !== "submitted") {
      return;
    }
  }

  function sendQuickKey(quickKey: QuickKeyBinding) {
    if (!isTerminalReady.value) {
      return;
    }

    if (quickKey.mode === "text") {
      void submitQuickKeyText(quickKey.input);
      return;
    }

    void sendTerminalInput(quickKey.input, "Не удалось отправить quick key в терминал.");
  }

  async function submitQuickKeyText(text: string) {
    const textOk = await sendTerminalInput(text, "Не удалось отправить текст в терминал.");
    if (!textOk) {
      return;
    }

    await sendTerminalInput("\r", "Не удалось отправить Enter в терминал.");
  }

  async function sendTodoEntryToTerminal(index: number) {
    const text = getTodoEntry(index);
    if (text === null) {
      return;
    }

    const result = await attemptSubmitTerminalText(text, {
      notReady: "Терминал не готов к отправке ввода.",
      messages: {
        sendSlash: "Не удалось отправить слеш-команду задачи в терминал.",
        sendText: "Не удалось отправить промпт задачи в терминал.",
        submit: "Не удалось отправить Enter в терминал."
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
