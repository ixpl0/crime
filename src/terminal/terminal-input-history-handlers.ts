import type { Ref } from "vue";
import { playImagePasteSound } from "./play-image-paste-sound";
import {
  getCtrlKeyInput,
  getEmptyTextareaPassthroughInput,
  isCursorOnFirstLine,
  isCursorOnFirstVisualLine,
  isCursorOnLastLine,
  isCursorOnLastVisualLine
} from "./terminal-input-keyboard-utils";
import type { SubmitTerminalTextResult } from "./terminal-submit-types";

export interface TerminalInputHistoryHandlersOptions {
  terminalInputText: Ref<string>;
  terminalInputHistoryIndex: Ref<number | null>;
  terminalInputDraft: Ref<string>;
  sendTerminalInput: (data: string, fallbackErrorMessage: string) => Promise<boolean>;
  submitTextFromTextarea: (text: string) => Promise<SubmitTerminalTextResult>;
  appendTerminalInputHistory: (text: string) => void;
  navigateTerminalInputHistory: (direction: -1 | 1) => void;
  sendAltVShortcut: () => Promise<boolean>;
  focusTerminalInput: () => void;
  copyTerminalSelectionIfAny: () => Promise<boolean>;
}

export interface TerminalInputHistoryHandlers {
  handleTextareaKeydown: (event: KeyboardEvent) => void;
  handleTextareaInput: (event: Event) => void;
  handleTextareaPaste: (event: ClipboardEvent) => Promise<void>;
  sendTextareaToTerminal: () => Promise<void>;
}

function getTextareaFromEvent(event: Event) {
  return event.currentTarget instanceof HTMLTextAreaElement ? event.currentTarget : null;
}

function shouldSubmitTextareaInput(event: KeyboardEvent) {
  return event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey;
}

function canNavigateTextareaHistory(event: KeyboardEvent, textarea: HTMLTextAreaElement) {
  return (
    !event.isComposing &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    textarea.selectionStart === textarea.selectionEnd
  );
}

function isHistoryNavigationOnBoundary(
  index: number | null,
  direction: -1 | 1,
  textarea: HTMLTextAreaElement
) {
  if (direction === -1) {
    return index === null ? isCursorOnFirstVisualLine(textarea) : isCursorOnFirstLine(textarea);
  }

  return index === null ? isCursorOnLastVisualLine(textarea) : isCursorOnLastLine(textarea);
}

function tryHandleEscapePassthrough(
  options: TerminalInputHistoryHandlersOptions,
  event: KeyboardEvent,
  textarea: HTMLTextAreaElement | null
) {
  if (!textarea || event.isComposing || (event.key !== "Escape" && event.key !== "Esc")) {
    return false;
  }

  event.preventDefault();
  void options.sendTerminalInput("\u001b", "Не удалось отправить Esc в терминал.");
  return true;
}

function isCtrlCWithoutTextareaSelection(
  event: KeyboardEvent,
  textarea: HTMLTextAreaElement | null
) {
  return (
    textarea &&
    !event.isComposing &&
    event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    event.code === "KeyC" &&
    textarea.selectionStart === textarea.selectionEnd
  );
}

function tryHandleCtrlCPassthrough(
  options: TerminalInputHistoryHandlersOptions,
  event: KeyboardEvent,
  textarea: HTMLTextAreaElement | null
) {
  if (!isCtrlCWithoutTextareaSelection(event, textarea)) {
    return false;
  }

  event.preventDefault();
  void options.copyTerminalSelectionIfAny().then((copied) => {
    if (!copied) {
      const ctrlCInput = getCtrlKeyInput(event) ?? "\u0003";
      void options.sendTerminalInput(ctrlCInput, "Не удалось отправить Ctrl+C в терминал.");
    }
  });
  return true;
}

function tryHandleEmptyTextareaPassthrough(
  options: TerminalInputHistoryHandlersOptions,
  event: KeyboardEvent,
  textarea: HTMLTextAreaElement | null
) {
  if (!textarea) {
    return false;
  }

  const passthroughInput = getEmptyTextareaPassthroughInput(event, textarea);
  if (passthroughInput === null) {
    return false;
  }

  event.preventDefault();
  void options.sendTerminalInput(passthroughInput, "Не удалось отправить клавиатурный ввод в терминал.");
  return true;
}

function tryHandleHistoryNavigation(
  options: TerminalInputHistoryHandlersOptions,
  event: KeyboardEvent,
  textarea: HTMLTextAreaElement | null
) {
  if (!textarea || !canNavigateTextareaHistory(event, textarea)) {
    return false;
  }

  const historyIndex = options.terminalInputHistoryIndex.value;
  if (event.key === "ArrowUp" && isHistoryNavigationOnBoundary(historyIndex, -1, textarea)) {
    event.preventDefault();
    options.navigateTerminalInputHistory(-1);
    return true;
  }

  if (event.key === "ArrowDown" && isHistoryNavigationOnBoundary(historyIndex, 1, textarea)) {
    event.preventDefault();
    options.navigateTerminalInputHistory(1);
    return true;
  }

  return false;
}

function createHandleTextareaKeydown(options: TerminalInputHistoryHandlersOptions) {
  return (event: KeyboardEvent) => {
    const textarea = getTextareaFromEvent(event);
    if (tryHandleEscapePassthrough(options, event, textarea)) {
      return;
    }
    if (tryHandleCtrlCPassthrough(options, event, textarea)) {
      return;
    }
    if (tryHandleEmptyTextareaPassthrough(options, event, textarea)) {
      return;
    }

    if (shouldSubmitTextareaInput(event)) {
      event.preventDefault();
      void sendTextareaToTerminal(options);
      return;
    }

    void tryHandleHistoryNavigation(options, event, textarea);
  };
}

function createHandleTextareaInput(options: TerminalInputHistoryHandlersOptions) {
  return (event: Event) => {
    const textarea = getTextareaFromEvent(event);
    if (textarea) {
      textarea.style.removeProperty("height");
    }

    if (options.terminalInputHistoryIndex.value === null) {
      return;
    }

    options.terminalInputHistoryIndex.value = null;
    options.terminalInputDraft.value = options.terminalInputText.value;
  };
}

function hasImageClipboardData(clipboardData: DataTransfer) {
  const hasImageItem = Array.from(clipboardData.items).some((item) => item.type.startsWith("image/"));
  const hasImageFile = Array.from(clipboardData.files).some((file) => file.type.startsWith("image/"));
  return hasImageItem || hasImageFile;
}

function createHandleTextareaPaste(options: TerminalInputHistoryHandlersOptions) {
  return async (event: ClipboardEvent) => {
    const textarea = getTextareaFromEvent(event);
    const clipboardData = event.clipboardData;
    if (!clipboardData || !hasImageClipboardData(clipboardData)) {
      return;
    }

    event.preventDefault();
    playImagePasteSound();
    try {
      await options.sendAltVShortcut();
    } finally {
      textarea?.focus();
    }
  };
}

async function sendTextareaToTerminal(options: TerminalInputHistoryHandlersOptions) {
  const text = options.terminalInputText.value;
  const result = await options.submitTextFromTextarea(text);
  if (result !== "submitted") {
    return;
  }

  options.appendTerminalInputHistory(text);
  options.terminalInputText.value = "";
  options.focusTerminalInput();
}

export function createTerminalInputHistoryHandlers(
  options: TerminalInputHistoryHandlersOptions
): TerminalInputHistoryHandlers {
  return {
    handleTextareaKeydown: createHandleTextareaKeydown(options),
    handleTextareaInput: createHandleTextareaInput(options),
    handleTextareaPaste: createHandleTextareaPaste(options),
    sendTextareaToTerminal: sendTextareaToTerminal.bind(null, options)
  };
}
