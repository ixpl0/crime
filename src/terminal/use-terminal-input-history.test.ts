// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { ref } from "vue";
import { useTerminalInputHistory } from "./use-terminal-input-history";
import type { UseTerminalInputHistoryOptions } from "./use-terminal-input-history";

const createInputHistory = (overrides: Partial<UseTerminalInputHistoryOptions> = {}) =>
  useTerminalInputHistory({
    projectPath: ref<string | null>(null),
    historyLimit: 50,
    reportUiError: vi.fn(),
    loadTerminalInputHistory: vi.fn().mockResolvedValue([]),
    saveTerminalInputHistory: vi.fn().mockResolvedValue(undefined),
    sendTerminalInput: vi.fn().mockResolvedValue(true),
    submitTextFromTextarea: vi.fn().mockResolvedValue("submitted" as const),
    sendAltVShortcut: vi.fn().mockResolvedValue(true),
    copyTerminalSelectionIfAny: vi.fn().mockResolvedValue(false),
    ...overrides
  });

const createTextareaAtStart = (value = ""): HTMLTextAreaElement => {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  Object.defineProperty(textarea, "selectionStart", { value: 0, writable: true });
  Object.defineProperty(textarea, "selectionEnd", { value: 0, writable: true });
  return textarea;
};

const createArrowUpEvent = (textarea: HTMLTextAreaElement): KeyboardEvent => {
  const event = new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true });
  Object.defineProperty(event, "currentTarget", { value: textarea });
  return event;
};

describe("clearTerminalInput", () => {
  it("clears the input text", () => {
    const history = createInputHistory();
    history.terminalInputText.value = "some prompt";

    history.clearTerminalInput();

    expect(history.terminalInputText.value).toBe("");
  });

  it("resets history navigation so the next ArrowUp starts from the most recent entry", () => {
    const history = createInputHistory();
    history.appendTerminalInputHistory("alpha");
    history.appendTerminalInputHistory("bravo");

    const textarea = createTextareaAtStart();

    // Enter history navigation: ArrowUp pulls the most recent entry.
    history.handleTextareaKeydown(createArrowUpEvent(textarea));
    expect(history.terminalInputText.value).toBe("bravo");

    history.clearTerminalInput();
    expect(history.terminalInputText.value).toBe("");

    // After clearing, navigation must restart from scratch and surface the most
    // recent entry again — not continue stepping back from the stale index.
    history.handleTextareaKeydown(createArrowUpEvent(textarea));
    expect(history.terminalInputText.value).toBe("bravo");
  });
});
