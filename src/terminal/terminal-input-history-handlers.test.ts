// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";
import { createTerminalInputHistoryHandlers } from "./terminal-input-history-handlers";
import type { TerminalInputHistoryHandlersOptions } from "./terminal-input-history-handlers";

const createMockOptions = (
  overrides: Partial<TerminalInputHistoryHandlersOptions> = {}
): TerminalInputHistoryHandlersOptions => ({
  terminalInputText: ref(""),
  terminalInputHistoryIndex: ref<number | null>(null),
  terminalInputDraft: ref(""),
  sendTerminalInput: vi.fn().mockResolvedValue(true),
  submitTextFromTextarea: vi.fn().mockResolvedValue("submitted" as const),
  appendTerminalInputHistory: vi.fn(),
  navigateTerminalInputHistory: vi.fn(),
  sendAltVShortcut: vi.fn().mockResolvedValue(true),
  focusTerminalInput: vi.fn(),
  copyTerminalSelectionIfAny: vi.fn().mockResolvedValue(false),
  ...overrides
});

const createTextarea = (value = ""): HTMLTextAreaElement => {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  Object.defineProperty(textarea, "selectionStart", { value: 0, writable: true });
  Object.defineProperty(textarea, "selectionEnd", { value: 0, writable: true });
  return textarea;
};

const createKeyboardEvent = (
  key: string,
  options: Partial<KeyboardEvent> & { currentTarget?: HTMLTextAreaElement } = {}
): KeyboardEvent => {
  const { currentTarget, ...eventInit } = options;
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...eventInit
  });
  if (currentTarget) {
    Object.defineProperty(event, "currentTarget", { value: currentTarget });
  }
  return event;
};

describe("createTerminalInputHistoryHandlers", () => {
  it("returns all four handler functions", () => {
    const handlers = createTerminalInputHistoryHandlers(createMockOptions());
    expect(typeof handlers.handleTextareaKeydown).toBe("function");
    expect(typeof handlers.handleTextareaInput).toBe("function");
    expect(typeof handlers.handleTextareaPaste).toBe("function");
    expect(typeof handlers.sendTextareaToTerminal).toBe("function");
  });
});

describe("handleTextareaKeydown", () => {
  describe("Escape passthrough", () => {
    it("sends Escape character to terminal and prevents default", () => {
      const options = createMockOptions();
      const handlers = createTerminalInputHistoryHandlers(options);
      const textarea = createTextarea();
      const event = createKeyboardEvent("Escape", { currentTarget: textarea });
      const preventDefaultSpy = vi.spyOn(event, "preventDefault");

      handlers.handleTextareaKeydown(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(options.sendTerminalInput).toHaveBeenCalledWith(
        "\u001b",
        expect.any(String)
      );
    });

    it("does not handle Escape when event.isComposing", () => {
      const options = createMockOptions();
      const handlers = createTerminalInputHistoryHandlers(options);
      const textarea = createTextarea();
      const event = new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true
      });
      Object.defineProperty(event, "currentTarget", { value: textarea });
      Object.defineProperty(event, "isComposing", { value: true });

      handlers.handleTextareaKeydown(event);

      expect(options.sendTerminalInput).not.toHaveBeenCalled();
    });
  });

  describe("Ctrl+C passthrough", () => {
    it("handles Ctrl+C without selection by copying terminal selection or sending interrupt", () => {
      const options = createMockOptions();
      const handlers = createTerminalInputHistoryHandlers(options);
      const textarea = createTextarea();
      Object.defineProperty(textarea, "selectionStart", { value: 0, writable: true });
      Object.defineProperty(textarea, "selectionEnd", { value: 0, writable: true });
      const event = createKeyboardEvent("c", {
        ctrlKey: true,
        code: "KeyC",
        currentTarget: textarea
      });
      const preventDefaultSpy = vi.spyOn(event, "preventDefault");

      handlers.handleTextareaKeydown(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(options.copyTerminalSelectionIfAny).toHaveBeenCalled();
    });

    it("does not intercept Ctrl+C when textarea has selection", () => {
      const options = createMockOptions();
      const handlers = createTerminalInputHistoryHandlers(options);
      const textarea = createTextarea("some text");
      Object.defineProperty(textarea, "selectionStart", { value: 0, writable: true });
      Object.defineProperty(textarea, "selectionEnd", { value: 4, writable: true });
      const event = createKeyboardEvent("c", {
        ctrlKey: true,
        code: "KeyC",
        currentTarget: textarea
      });

      handlers.handleTextareaKeydown(event);

      expect(options.copyTerminalSelectionIfAny).not.toHaveBeenCalled();
    });
  });

  describe("Enter submission", () => {
    it("submits textarea text on plain Enter", () => {
      const options = createMockOptions();
      options.terminalInputText.value = "echo hello";
      const handlers = createTerminalInputHistoryHandlers(options);
      const textarea = createTextarea("echo hello");
      const event = createKeyboardEvent("Enter", { currentTarget: textarea });
      const preventDefaultSpy = vi.spyOn(event, "preventDefault");

      handlers.handleTextareaKeydown(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(options.submitTextFromTextarea).toHaveBeenCalledWith("echo hello");
    });

    it("does not submit on Shift+Enter", () => {
      const options = createMockOptions();
      const handlers = createTerminalInputHistoryHandlers(options);
      const textarea = createTextarea();
      const event = createKeyboardEvent("Enter", {
        shiftKey: true,
        currentTarget: textarea
      });

      handlers.handleTextareaKeydown(event);

      expect(options.submitTextFromTextarea).not.toHaveBeenCalled();
    });

    it("does not submit on Ctrl+Enter", () => {
      const options = createMockOptions();
      const handlers = createTerminalInputHistoryHandlers(options);
      const textarea = createTextarea();
      const event = createKeyboardEvent("Enter", {
        ctrlKey: true,
        currentTarget: textarea
      });

      handlers.handleTextareaKeydown(event);

      expect(options.submitTextFromTextarea).not.toHaveBeenCalled();
    });
  });
});

describe("handleTextareaInput", () => {
  it("resets history index to null when user types while navigating history", () => {
    const options = createMockOptions();
    options.terminalInputHistoryIndex.value = 2;
    options.terminalInputText.value = "modified text";
    const handlers = createTerminalInputHistoryHandlers(options);

    const textarea = createTextarea("modified text");
    const event = new Event("input", { bubbles: true });
    Object.defineProperty(event, "currentTarget", { value: textarea });

    handlers.handleTextareaInput(event);

    expect(options.terminalInputHistoryIndex.value).toBeNull();
    expect(options.terminalInputDraft.value).toBe("modified text");
  });

  it("does nothing when not navigating history (index is null)", () => {
    const options = createMockOptions();
    options.terminalInputHistoryIndex.value = null;
    const handlers = createTerminalInputHistoryHandlers(options);

    const textarea = createTextarea("text");
    const event = new Event("input", { bubbles: true });
    Object.defineProperty(event, "currentTarget", { value: textarea });

    handlers.handleTextareaInput(event);

    expect(options.terminalInputHistoryIndex.value).toBeNull();
  });
});

describe("sendTextareaToTerminal", () => {
  let options: TerminalInputHistoryHandlersOptions;

  beforeEach(() => {
    options = createMockOptions();
  });

  it("submits text, appends to history, clears input and refocuses", async () => {
    options.terminalInputText.value = "ls -la";
    const handlers = createTerminalInputHistoryHandlers(options);

    await handlers.sendTextareaToTerminal();

    expect(options.submitTextFromTextarea).toHaveBeenCalledWith("ls -la");
    expect(options.appendTerminalInputHistory).toHaveBeenCalledWith("ls -la");
    expect(options.terminalInputText.value).toBe("");
    expect(options.focusTerminalInput).toHaveBeenCalled();
  });

  it("does not append to history or clear when submit result is not 'submitted'", async () => {
    options.terminalInputText.value = "test";
    vi.mocked(options.submitTextFromTextarea).mockResolvedValue("failed");
    const handlers = createTerminalInputHistoryHandlers(options);

    await handlers.sendTextareaToTerminal();

    expect(options.appendTerminalInputHistory).not.toHaveBeenCalled();
    expect(options.terminalInputText.value).toBe("test");
    expect(options.focusTerminalInput).not.toHaveBeenCalled();
  });

  it("does not append to history when submit returns 'empty'", async () => {
    options.terminalInputText.value = "";
    vi.mocked(options.submitTextFromTextarea).mockResolvedValue("empty");
    const handlers = createTerminalInputHistoryHandlers(options);

    await handlers.sendTextareaToTerminal();

    expect(options.appendTerminalInputHistory).not.toHaveBeenCalled();
  });
});

describe("handleTextareaPaste", () => {
  it("does nothing when clipboard has no image data", async () => {
    const options = createMockOptions();
    const handlers = createTerminalInputHistoryHandlers(options);

    const clipboardData = new DataTransfer();
    const event = new ClipboardEvent("paste", { clipboardData });
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");

    await handlers.handleTextareaPaste(event);

    expect(preventDefaultSpy).not.toHaveBeenCalled();
    expect(options.sendAltVShortcut).not.toHaveBeenCalled();
  });
});
