import { computed, nextTick, ref, watch, type Ref } from "vue";
import { areStringArraysEqual } from "../utils/array-utils";
import {
  createTerminalInputHistoryHandlers,
  type TerminalInputHistoryHandlers
} from "./terminal-input-history-handlers";
import type { SubmitTerminalTextResult } from "./terminal-submit-types";

export type TerminalInputHistoryLoadSource = "project-open" | "settings-watch";

export interface UseTerminalInputHistoryOptions {
  projectPath: Ref<string | null>;
  historyLimit: number;
  reportUiError: (context: string, error: unknown, fallbackMessage: string) => unknown;
  loadTerminalInputHistory: (projectPath: string, limit: number) => Promise<string[]>;
  saveTerminalInputHistory: (projectPath: string, entries: string[], limit: number) => Promise<void>;
  sendTerminalInput: (data: string, fallbackErrorMessage: string) => Promise<boolean>;
  submitTextFromTextarea: (text: string) => Promise<SubmitTerminalTextResult>;
  sendAltVShortcut: () => Promise<boolean>;
  copyTerminalSelectionIfAny: () => Promise<boolean>;
}

interface TerminalInputHistoryState {
  readonly options: UseTerminalInputHistoryOptions;
  readonly terminalInputText: Ref<string>;
  readonly terminalInputTextarea: Ref<HTMLTextAreaElement | null>;
  readonly terminalInputHistory: Ref<string[]>;
  readonly terminalInputHistoryIndex: Ref<number | null>;
  readonly terminalInputDraft: Ref<string>;
  readonly lastPrompt: Ref<string | undefined>;
  terminalInputHistoryLoadToken: number;
  terminalInputHistoryEditVersion: number;
  terminalInputHistoryPersistedVersion: number;
  terminalInputHistoryPersistQueue: Promise<void>;
  terminalInputHistoryReloadPending: boolean;
}

function createTerminalInputHistoryState(
  options: UseTerminalInputHistoryOptions
): TerminalInputHistoryState {
  const terminalInputText = ref("");
  const terminalInputTextarea = ref<HTMLTextAreaElement | null>(null);
  const terminalInputHistory = ref<string[]>([]);
  const terminalInputHistoryIndex = ref<number | null>(null);
  const terminalInputDraft = ref("");
  const lastPrompt = computed(() => {
    const entries = terminalInputHistory.value;
    return entries.length > 0 ? entries[entries.length - 1] : undefined;
  });

  return {
    options,
    terminalInputText,
    terminalInputTextarea,
    terminalInputHistory,
    terminalInputHistoryIndex,
    terminalInputDraft,
    lastPrompt,
    terminalInputHistoryLoadToken: 0,
    terminalInputHistoryEditVersion: 0,
    terminalInputHistoryPersistedVersion: 0,
    terminalInputHistoryPersistQueue: Promise.resolve(),
    terminalInputHistoryReloadPending: false
  };
}

function resizeTerminalInputTextareaElement(state: TerminalInputHistoryState) {
  const textarea = state.terminalInputTextarea.value;
  if (!textarea) {
    return;
  }

  textarea.style.removeProperty("height");
}

function moveTextareaCursorToEnd(state: TerminalInputHistoryState) {
  void nextTick(() => {
    const textarea = state.terminalInputTextarea.value;
    if (!textarea) {
      return;
    }

    const cursorPosition = textarea.value.length;
    textarea.focus();
    textarea.setSelectionRange(cursorPosition, cursorPosition);
  });
}

function setTerminalInputText(state: TerminalInputHistoryState, text: string) {
  state.terminalInputText.value = text;
  moveTextareaCursorToEnd(state);
}

function resetTerminalInputHistoryNavigation(state: TerminalInputHistoryState) {
  state.terminalInputHistoryIndex.value = null;
  state.terminalInputDraft.value = "";
}

function clearTerminalInput(state: TerminalInputHistoryState) {
  state.terminalInputText.value = "";
  resetTerminalInputHistoryNavigation(state);
}

function focusTerminalInput(state: TerminalInputHistoryState) {
  void nextTick(() => {
    state.terminalInputTextarea.value?.focus();
  });
}

function createPersistTerminalHistoryOperation(
  state: TerminalInputHistoryState,
  path: string,
  entries: string[],
  version: number
) {
  return async () => {
    try {
      await state.options.saveTerminalInputHistory(path, entries, state.options.historyLimit);
    } catch (error) {
      state.options.reportUiError(
        "Terminal history",
        error,
        "Не удалось сохранить историю ввода терминала."
      );
      return;
    }

    if (
      state.options.projectPath.value === path &&
      version > state.terminalInputHistoryPersistedVersion
    ) {
      state.terminalInputHistoryPersistedVersion = version;
    }

    if (state.options.projectPath.value === path) {
      await flushPendingTerminalInputHistoryReload(state);
    }
  };
}

function persistTerminalInputHistory(
  state: TerminalInputHistoryState,
  entries: string[],
  version: number
) {
  if (!state.options.projectPath.value) {
    return;
  }

  const path = state.options.projectPath.value;
  const operation = createPersistTerminalHistoryOperation(state, path, entries, version);
  state.terminalInputHistoryPersistQueue =
    state.terminalInputHistoryPersistQueue.then(operation, operation);
}

function appendTerminalInputHistory(state: TerminalInputHistoryState, text: string) {
  const history = state.terminalInputHistory.value;
  const lastEntry = history[history.length - 1];
  if (lastEntry === text) {
    resetTerminalInputHistoryNavigation(state);
    return;
  }

  const nextHistory = [...history, text].slice(-state.options.historyLimit);
  state.terminalInputHistoryEditVersion += 1;
  state.terminalInputHistory.value = nextHistory;
  persistTerminalInputHistory(state, nextHistory, state.terminalInputHistoryEditVersion);
  resetTerminalInputHistoryNavigation(state);
}

function isStaleTerminalHistoryLoad(state: TerminalInputHistoryState, path: string, loadToken: number) {
  return state.options.projectPath.value !== path || state.terminalInputHistoryLoadToken !== loadToken;
}

function shouldDelaySettingsWatchReload(
  state: TerminalInputHistoryState,
  source: TerminalInputHistoryLoadSource
) {
  if (source !== "settings-watch") {
    return false;
  }

  const hasPendingEdits =
    state.terminalInputHistoryEditVersion > state.terminalInputHistoryPersistedVersion;
  const hasHistoryNavigation = state.terminalInputHistoryIndex.value !== null;
  return hasPendingEdits || hasHistoryNavigation;
}

async function loadTerminalInputHistoryForProject(
  state: TerminalInputHistoryState,
  path: string,
  source: TerminalInputHistoryLoadSource
) {
  const loadToken = state.terminalInputHistoryLoadToken + 1;
  state.terminalInputHistoryLoadToken = loadToken;
  const history = await state.options.loadTerminalInputHistory(path, state.options.historyLimit);
  if (isStaleTerminalHistoryLoad(state, path, loadToken)) {
    return;
  }

  if (shouldDelaySettingsWatchReload(state, source)) {
    state.terminalInputHistoryReloadPending = true;
    return;
  }

  state.terminalInputHistoryReloadPending = false;
  if (areStringArraysEqual(state.terminalInputHistory.value, history)) {
    if (source === "project-open") {
      resetTerminalInputHistoryNavigation(state);
    }
    return;
  }

  state.terminalInputHistory.value = history;
  if (source === "project-open") {
    resetTerminalInputHistoryNavigation(state);
  }
}

async function flushPendingTerminalInputHistoryReload(state: TerminalInputHistoryState) {
  if (!state.terminalInputHistoryReloadPending || !state.options.projectPath.value) {
    return;
  }

  const hasPendingEdits =
    state.terminalInputHistoryEditVersion > state.terminalInputHistoryPersistedVersion;
  if (state.terminalInputHistoryIndex.value !== null || hasPendingEdits) {
    return;
  }

  state.terminalInputHistoryReloadPending = false;
  await loadTerminalInputHistoryForProject(state, state.options.projectPath.value, "settings-watch");
}

function navigateTerminalInputHistory(state: TerminalInputHistoryState, direction: -1 | 1) {
  const history = state.terminalInputHistory.value;
  if (history.length === 0) {
    return;
  }

  if (state.terminalInputHistoryIndex.value === null) {
    if (direction === 1) {
      return;
    }

    state.terminalInputDraft.value = state.terminalInputText.value;
    state.terminalInputHistoryIndex.value = history.length - 1;
    setTerminalInputText(state, history[state.terminalInputHistoryIndex.value]);
    return;
  }

  const nextIndex = state.terminalInputHistoryIndex.value + direction;
  if (nextIndex < 0) {
    state.terminalInputHistoryIndex.value = 0;
    setTerminalInputText(state, history[0]);
    return;
  }

  if (nextIndex >= history.length) {
    state.terminalInputHistoryIndex.value = null;
    setTerminalInputText(state, state.terminalInputDraft.value);
    return;
  }

  state.terminalInputHistoryIndex.value = nextIndex;
  setTerminalInputText(state, history[nextIndex]);
}

function resetTerminalInputRuntimeState(state: TerminalInputHistoryState) {
  state.terminalInputText.value = "";
  state.terminalInputHistory.value = [];
  state.terminalInputHistoryIndex.value = null;
  state.terminalInputDraft.value = "";
  state.terminalInputHistoryLoadToken = 0;
  state.terminalInputHistoryEditVersion = 0;
  state.terminalInputHistoryPersistedVersion = 0;
  state.terminalInputHistoryPersistQueue = Promise.resolve();
  state.terminalInputHistoryReloadPending = false;
}

function setupTerminalInputHistoryWatchers(state: TerminalInputHistoryState) {
  watch(state.terminalInputText, () => {
    void nextTick(() => {
      resizeTerminalInputTextareaElement(state);
    });
  });

  watch(state.terminalInputHistoryIndex, (index) => {
    if (index === null) {
      void flushPendingTerminalInputHistoryReload(state);
    }
  });
}

function createHandlers(state: TerminalInputHistoryState): TerminalInputHistoryHandlers {
  return createTerminalInputHistoryHandlers({
    terminalInputText: state.terminalInputText,
    terminalInputHistoryIndex: state.terminalInputHistoryIndex,
    terminalInputDraft: state.terminalInputDraft,
    sendTerminalInput: state.options.sendTerminalInput,
    submitTextFromTextarea: state.options.submitTextFromTextarea,
    appendTerminalInputHistory: appendTerminalInputHistory.bind(null, state),
    navigateTerminalInputHistory: navigateTerminalInputHistory.bind(null, state),
    sendAltVShortcut: state.options.sendAltVShortcut,
    focusTerminalInput: focusTerminalInput.bind(null, state),
    copyTerminalSelectionIfAny: state.options.copyTerminalSelectionIfAny
  });
}

export function useTerminalInputHistory(options: UseTerminalInputHistoryOptions) {
  const state = createTerminalInputHistoryState(options);
  const handlers = createHandlers(state);
  setupTerminalInputHistoryWatchers(state);

  return {
    terminalInputText: state.terminalInputText,
    terminalInputTextarea: state.terminalInputTextarea,
    lastPrompt: state.lastPrompt,
    resizeTerminalInputTextareaElement: resizeTerminalInputTextareaElement.bind(null, state),
    clearTerminalInput: clearTerminalInput.bind(null, state),
    appendTerminalInputHistory: appendTerminalInputHistory.bind(null, state),
    loadTerminalInputHistoryForProject: loadTerminalInputHistoryForProject.bind(null, state),
    handleTextareaKeydown: handlers.handleTextareaKeydown,
    handleTextareaInput: handlers.handleTextareaInput,
    handleTextareaPaste: handlers.handleTextareaPaste,
    sendTextareaToTerminal: handlers.sendTextareaToTerminal,
    resetTerminalInputRuntimeState: resetTerminalInputRuntimeState.bind(null, state)
  };
}
