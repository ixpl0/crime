import type { PromptSuffixConfig } from "../types/prompt-suffix";
import type {
  SubmitTerminalTextAttemptOptions,
  SubmitTerminalTextMessages,
  SubmitTerminalTextResult,
  UseTerminalSubmitOptions
} from "./terminal-submit-types";

interface TerminalSubmitState {
  readonly options: UseTerminalSubmitOptions;
  terminalDataVersion: number;
  terminalInputQueue: Promise<void>;
}

function createTerminalSubmitState(options: UseTerminalSubmitOptions): TerminalSubmitState {
  return {
    options,
    terminalDataVersion: 0,
    terminalInputQueue: Promise.resolve()
  };
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getSlashCommandText(text: string) {
  const withoutTrailingLineBreaks = text.replace(/[\r\n]+$/, "");
  const trimmedStart = withoutTrailingLineBreaks.trimStart();
  if (!trimmedStart.startsWith("/") || /[\r\n]/.test(trimmedStart)) {
    return null;
  }

  return trimmedStart;
}

function getActivePromptSuffixValues(config: PromptSuffixConfig) {
  return config.items
    .filter((item) => item.mode !== "off")
    .map((item) => item.value.trim())
    .filter((value) => value.length > 0);
}

function getPromptSuffixResetConfig(config: PromptSuffixConfig) {
  const hasOnceItems = config.items.some((item) => item.mode === "once");
  if (!hasOnceItems) {
    return null;
  }

  return {
    items: config.items.map((item) =>
      item.mode === "once" ? { ...item, mode: "off" as const } : item
    )
  };
}

function appendPromptSuffixes(state: TerminalSubmitState, rawText: string) {
  if (getSlashCommandText(rawText)) {
    return rawText;
  }

  const currentConfig = state.options.promptSuffixConfig.value;
  const activeSuffixValues = getActivePromptSuffixValues(currentConfig);
  const resetConfig = getPromptSuffixResetConfig(currentConfig);
  if (resetConfig) {
    state.options.applyPromptSuffixConfig(resetConfig);
  }

  if (activeSuffixValues.length === 0) {
    return rawText;
  }

  const cleanedText = rawText.replace(/[\r\n]+$/, "");
  const suffixLines = activeSuffixValues.map((value) => `- ${value}`).join("\n");
  return `${cleanedText}\n\n\u0414\u043e\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c\u043d\u044b\u0435 \u0442\u0440\u0435\u0431\u043e\u0432\u0430\u043d\u0438\u044f:\n${suffixLines}`;
}

function enqueueTerminalOperation<T>(
  state: TerminalSubmitState,
  operation: () => Promise<T>
) {
  const queuedOperation = state.terminalInputQueue.then(operation, operation);
  state.terminalInputQueue = queuedOperation.then(
    () => undefined,
    () => undefined
  );
  return queuedOperation;
}

function resolveTerminalInputErrorMessage(fallbackErrorMessage: string, error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackErrorMessage;
}

async function sendTerminalInput(
  state: TerminalSubmitState,
  data: string,
  fallbackErrorMessage: string
) {
  return enqueueTerminalOperation(state, async () => {
    try {
      const response = await state.options.sendTerminalInputRequest(data);
      if (response.ok) {
        return true;
      }

      state.options.errorMessage.value = response.error ?? fallbackErrorMessage;
      return false;
    } catch (error) {
      state.options.errorMessage.value = resolveTerminalInputErrorMessage(
        fallbackErrorMessage,
        error
      );
      return false;
    }
  });
}

async function waitForTerminalDataAfter(
  state: TerminalSubmitState,
  version: number,
  timeoutMs: number
) {
  const startedAt = Date.now();
  const pollIntervalMs = Math.max(state.options.projectSettings.value.slashCommand.dataPollIntervalMs, 1);
  while (Date.now() - startedAt < timeoutMs) {
    if (state.terminalDataVersion > version) {
      return true;
    }

    await delay(pollIntervalMs);
  }

  return state.terminalDataVersion > version;
}

async function waitForTerminalQuiet(
  state: TerminalSubmitState,
  idleMs: number,
  timeoutMs: number
) {
  const startedAt = Date.now();
  let observedVersion = state.terminalDataVersion;
  while (Date.now() - startedAt < timeoutMs) {
    await delay(idleMs);
    if (state.terminalDataVersion === observedVersion) {
      return;
    }
    observedVersion = state.terminalDataVersion;
  }
}

async function waitForTextareaSubmitReadiness(
  state: TerminalSubmitState,
  versionBeforeTextSend: number
) {
  const timings = state.options.projectSettings.value.slashCommand;
  const activityTimeoutMs = Math.min(
    timings.activityTimeoutMs,
    state.options.textareaSubmitActivityTimeoutCapMs
  );
  const quietTimeoutMs = Math.min(
    timings.quietTimeoutMs,
    state.options.textareaSubmitQuietTimeoutCapMs
  );

  const sawActivity = await waitForTerminalDataAfter(
    state,
    versionBeforeTextSend,
    activityTimeoutMs
  );
  if (!sawActivity) {
    await delay(timings.enterDelayMs);
    return;
  }

  await waitForTerminalQuiet(state, timings.enterDelayMs, quietTimeoutMs);
}

async function waitForSlashCommandReadiness(
  state: TerminalSubmitState,
  versionBeforeSlashSend: number
) {
  const timings = state.options.projectSettings.value.slashCommand;
  const readinessStartedAt = Date.now();
  const sawActivity = await waitForTerminalDataAfter(
    state,
    versionBeforeSlashSend,
    timings.activityTimeoutMs
  );

  const elapsedMs = Date.now() - readinessStartedAt;
  const remainingAfterSlashDelayMs = timings.afterSlashDelayMs - elapsedMs;
  if (remainingAfterSlashDelayMs > 0) {
    await delay(remainingAfterSlashDelayMs);
  }

  if (sawActivity) {
    await waitForTerminalQuiet(state, timings.enterDelayMs, timings.quietTimeoutMs);
  }
}

async function sendTextareaTextInput(state: TerminalSubmitState, text: string) {
  const BRACKET_PASTE_START = "\x1b[200~";
  const BRACKET_PASTE_END = "\x1b[201~";

  const startOk = await sendTerminalInput(
    state,
    BRACKET_PASTE_START,
    "Failed to send bracket paste start."
  );
  if (!startOk) {
    return false;
  }

  for (let index = 0; index < text.length; index += state.options.terminalInputChunkSize) {
    const chunk = text.slice(index, index + state.options.terminalInputChunkSize);
    const ok = await sendTerminalInput(state, chunk, "Failed to send input to terminal.");
    if (!ok) {
      return false;
    }
  }

  return sendTerminalInput(state, BRACKET_PASTE_END, "Failed to send bracket paste end.");
}

async function sendSlashCommand(state: TerminalSubmitState, slashCommandText: string) {
  const timings = state.options.projectSettings.value.slashCommand;
  for (let index = 0; index < slashCommandText.length; index += 1) {
    const char = slashCommandText[index];
    const versionBeforeSend = state.terminalDataVersion;
    const ok = await sendTerminalInput(
      state,
      char,
      "Failed to send slash command character to terminal."
    );
    if (!ok) {
      return false;
    }

    if (char === "/") {
      await waitForSlashCommandReadiness(state, versionBeforeSend);
    } else {
      await delay(timings.charDelayMs);
    }
  }

  await waitForTerminalQuiet(state, timings.enterDelayMs, timings.quietTimeoutMs);
  return sendTerminalInput(state, "\r", "Failed to send Enter to terminal.");
}

async function submitTerminalText(
  state: TerminalSubmitState,
  rawText: string,
  messages: SubmitTerminalTextMessages
): Promise<SubmitTerminalTextResult> {
  const slashCommandText = getSlashCommandText(rawText);
  if (slashCommandText) {
    const slashOk = await sendSlashCommand(state, slashCommandText);
    if (slashOk) {
      return "submitted";
    }

    state.options.errorMessage.value ||= messages.sendSlash;
    return "failed";
  }

  const cleanedText = rawText.replace(/[\r\n]+$/, "");
  if (!cleanedText.trim()) {
    return "empty";
  }

  const versionBeforeTextSend = state.terminalDataVersion;
  const inputOk = await sendTextareaTextInput(state, cleanedText);
  if (!inputOk) {
    state.options.errorMessage.value ||= messages.sendText;
    return "failed";
  }

  await waitForTextareaSubmitReadiness(state, versionBeforeTextSend);
  const enterOk = await sendTerminalInput(state, "\r", messages.submit);
  return enterOk ? "submitted" : "failed";
}

async function attemptSubmitTerminalText(
  state: TerminalSubmitState,
  rawText: string,
  options: SubmitTerminalTextAttemptOptions
): Promise<SubmitTerminalTextResult> {
  if (!state.options.isTerminalReady.value) {
    state.options.errorMessage.value = options.notReady;
    return "failed";
  }

  if (!rawText.trim()) {
    return "empty";
  }

  const textToSubmit =
    options.inputType === "prompt" ? appendPromptSuffixes(state, rawText) : rawText;
  state.options.errorMessage.value = "";
  return submitTerminalText(state, textToSubmit, options.messages);
}

async function sendAltVShortcut(state: TerminalSubmitState) {
  if (!state.options.isTerminalReady.value) {
    state.options.errorMessage.value = "Terminal is not ready.";
    return false;
  }

  state.options.errorMessage.value = "";
  return sendTerminalInput(state, "\u001bv", "Failed to send Alt+V to terminal.");
}

function markTerminalDataReceived(state: TerminalSubmitState) {
  state.terminalDataVersion += 1;
}

function resetTerminalSessionState(state: TerminalSubmitState) {
  state.terminalDataVersion = 0;
  state.terminalInputQueue = Promise.resolve();
}

export function useTerminalSubmit(options: UseTerminalSubmitOptions) {
  const state = createTerminalSubmitState(options);
  return {
    sendTerminalInput: sendTerminalInput.bind(null, state),
    attemptSubmitTerminalText: attemptSubmitTerminalText.bind(null, state),
    sendAltVShortcut: sendAltVShortcut.bind(null, state),
    markTerminalDataReceived: markTerminalDataReceived.bind(null, state),
    resetTerminalSessionState: resetTerminalSessionState.bind(null, state),
    waitForTerminalQuiet: (quietMs: number, timeoutMs: number) =>
      waitForTerminalQuiet(state, quietMs, timeoutMs)
  };
}
