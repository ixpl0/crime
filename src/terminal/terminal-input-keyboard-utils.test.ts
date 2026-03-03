import { describe, it, expect } from "vitest";
import {
  isCursorOnFirstLine,
  isCursorOnLastLine,
  getCtrlKeyInput,
  getEmptyTextareaPassthroughInput
} from "./terminal-input-keyboard-utils";

function createTextarea(value: string, selectionStart: number, selectionEnd?: number) {
  return {
    value,
    selectionStart,
    selectionEnd: selectionEnd ?? selectionStart
  } as HTMLTextAreaElement;
}

function createKeyboardEvent(overrides: Partial<KeyboardEvent> = {}) {
  return {
    key: "",
    code: "",
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    isComposing: false,
    ...overrides
  } as KeyboardEvent;
}

describe("isCursorOnFirstLine", () => {
  it("returns true when textarea is empty", () => {
    expect(isCursorOnFirstLine(createTextarea("", 0))).toBe(true);
  });

  it("returns true when cursor is at start of single-line text", () => {
    expect(isCursorOnFirstLine(createTextarea("hello", 0))).toBe(true);
  });

  it("returns true when cursor is at end of single-line text", () => {
    expect(isCursorOnFirstLine(createTextarea("hello", 5))).toBe(true);
  });

  it("returns true when cursor is at end of first line in multiline text", () => {
    expect(isCursorOnFirstLine(createTextarea("hello\nworld", 5))).toBe(true);
  });

  it("returns false when cursor is on second line", () => {
    expect(isCursorOnFirstLine(createTextarea("hello\nworld", 6))).toBe(false);
  });

  it("returns false when cursor is on third line", () => {
    expect(isCursorOnFirstLine(createTextarea("a\nb\nc", 4))).toBe(false);
  });

  it("returns true when first line is empty and cursor is at position 0", () => {
    expect(isCursorOnFirstLine(createTextarea("\nsecond", 0))).toBe(true);
  });

  it("returns false when first line is empty and cursor is after newline", () => {
    expect(isCursorOnFirstLine(createTextarea("\nsecond", 1))).toBe(false);
  });
});

describe("isCursorOnLastLine", () => {
  it("returns true when textarea is empty", () => {
    expect(isCursorOnLastLine(createTextarea("", 0))).toBe(true);
  });

  it("returns true when cursor is at end of single-line text", () => {
    expect(isCursorOnLastLine(createTextarea("hello", 5))).toBe(true);
  });

  it("returns true when cursor is at start of single-line text", () => {
    expect(isCursorOnLastLine(createTextarea("hello", 0))).toBe(true);
  });

  it("returns true when cursor is on last line of multiline text", () => {
    expect(isCursorOnLastLine(createTextarea("hello\nworld", 6))).toBe(true);
  });

  it("returns false when cursor is on first line of multiline text", () => {
    expect(isCursorOnLastLine(createTextarea("hello\nworld", 3))).toBe(false);
  });

  it("returns false when cursor is right before last newline", () => {
    expect(isCursorOnLastLine(createTextarea("a\nb\nc", 2))).toBe(false);
  });

  it("returns true when last line is empty and cursor is at end", () => {
    expect(isCursorOnLastLine(createTextarea("hello\n", 6))).toBe(true);
  });

  it("uses selectionEnd for range selections", () => {
    const textarea = createTextarea("hello\nworld", 3, 8);
    expect(isCursorOnLastLine(textarea)).toBe(true);
  });

  it("returns false for range selection ending on first line", () => {
    const textarea = createTextarea("hello\nworld", 0, 4);
    expect(isCursorOnLastLine(textarea)).toBe(false);
  });
});

describe("getCtrlKeyInput", () => {
  describe("Ctrl + letter keys", () => {
    it("returns Ctrl+A (SOH, \\x01)", () => {
      const event = createKeyboardEvent({ ctrlKey: true, code: "KeyA", key: "a" });
      expect(getCtrlKeyInput(event)).toBe("\x01");
    });

    it("returns Ctrl+C (ETX, \\x03)", () => {
      const event = createKeyboardEvent({ ctrlKey: true, code: "KeyC", key: "c" });
      expect(getCtrlKeyInput(event)).toBe("\x03");
    });

    it("returns Ctrl+D (EOT, \\x04)", () => {
      const event = createKeyboardEvent({ ctrlKey: true, code: "KeyD", key: "d" });
      expect(getCtrlKeyInput(event)).toBe("\x04");
    });

    it("returns Ctrl+L (FF, \\x0c)", () => {
      const event = createKeyboardEvent({ ctrlKey: true, code: "KeyL", key: "l" });
      expect(getCtrlKeyInput(event)).toBe("\x0c");
    });

    it("returns Ctrl+Z (SUB, \\x1a)", () => {
      const event = createKeyboardEvent({ ctrlKey: true, code: "KeyZ", key: "z" });
      expect(getCtrlKeyInput(event)).toBe("\x1a");
    });
  });

  describe("Ctrl + digit/symbol keys", () => {
    it("returns NUL for Ctrl+2", () => {
      const event = createKeyboardEvent({ ctrlKey: true, code: "Digit2", key: "2" });
      expect(getCtrlKeyInput(event)).toBe("\x00");
    });

    it("returns ESC for Ctrl+3", () => {
      const event = createKeyboardEvent({ ctrlKey: true, code: "Digit3", key: "3" });
      expect(getCtrlKeyInput(event)).toBe("\x1b");
    });

    it("returns FS for Ctrl+4 (backslash)", () => {
      const event = createKeyboardEvent({ ctrlKey: true, code: "Digit4", key: "4" });
      expect(getCtrlKeyInput(event)).toBe("\x1c");
    });

    it("returns NUL for Ctrl+Space", () => {
      const event = createKeyboardEvent({ ctrlKey: true, code: "Space", key: " " });
      expect(getCtrlKeyInput(event)).toBe("\x00");
    });

    it("returns US for Ctrl+Minus", () => {
      const event = createKeyboardEvent({ ctrlKey: true, code: "Minus", key: "-" });
      expect(getCtrlKeyInput(event)).toBe("\x1f");
    });

    it("returns DEL for Ctrl+8", () => {
      const event = createKeyboardEvent({ ctrlKey: true, code: "Digit8", key: "8" });
      expect(getCtrlKeyInput(event)).toBe("\x7f");
    });
  });

  describe("Ctrl + Alt (Meta sends Escape prefix)", () => {
    it("prefixes Ctrl+A with ESC when Alt is held", () => {
      const event = createKeyboardEvent({ ctrlKey: true, altKey: true, code: "KeyA", key: "a" });
      expect(getCtrlKeyInput(event)).toBe("\x1b\x01");
    });

    it("prefixes Ctrl+C with ESC when Alt is held", () => {
      const event = createKeyboardEvent({ ctrlKey: true, altKey: true, code: "KeyC", key: "c" });
      expect(getCtrlKeyInput(event)).toBe("\x1b\x03");
    });
  });

  describe("special keys with CSI modifier templates", () => {
    it("returns CSI sequence for Ctrl+ArrowUp", () => {
      const event = createKeyboardEvent({ ctrlKey: true, key: "ArrowUp" });
      expect(getCtrlKeyInput(event)).toBe("\x1b[1;5A");
    });

    it("returns CSI sequence for Ctrl+ArrowDown", () => {
      const event = createKeyboardEvent({ ctrlKey: true, key: "ArrowDown" });
      expect(getCtrlKeyInput(event)).toBe("\x1b[1;5B");
    });

    it("returns CSI sequence for Ctrl+ArrowRight", () => {
      const event = createKeyboardEvent({ ctrlKey: true, key: "ArrowRight" });
      expect(getCtrlKeyInput(event)).toBe("\x1b[1;5C");
    });

    it("returns CSI sequence for Ctrl+ArrowLeft", () => {
      const event = createKeyboardEvent({ ctrlKey: true, key: "ArrowLeft" });
      expect(getCtrlKeyInput(event)).toBe("\x1b[1;5D");
    });

    it("returns CSI sequence for Shift+ArrowUp (modifier=2)", () => {
      const event = createKeyboardEvent({ shiftKey: true, key: "ArrowUp" });
      expect(getCtrlKeyInput(event)).toBe("\x1b[1;2A");
    });

    it("returns CSI sequence for Ctrl+Shift+ArrowRight (modifier=6)", () => {
      const event = createKeyboardEvent({ ctrlKey: true, shiftKey: true, key: "ArrowRight" });
      expect(getCtrlKeyInput(event)).toBe("\x1b[1;6C");
    });

    it("returns CSI sequence for Alt+ArrowLeft (modifier=3)", () => {
      const event = createKeyboardEvent({ altKey: true, key: "ArrowLeft" });
      expect(getCtrlKeyInput(event)).toBe("\x1b[1;3D");
    });

    it("returns CSI sequence for Ctrl+Alt+Shift+ArrowUp (modifier=8)", () => {
      const event = createKeyboardEvent({ ctrlKey: true, altKey: true, shiftKey: true, key: "ArrowUp" });
      expect(getCtrlKeyInput(event)).toBe("\x1b[1;8A");
    });

    it("returns CSI sequence for Ctrl+Home", () => {
      const event = createKeyboardEvent({ ctrlKey: true, key: "Home" });
      expect(getCtrlKeyInput(event)).toBe("\x1b[1;5H");
    });

    it("returns CSI sequence for Ctrl+End", () => {
      const event = createKeyboardEvent({ ctrlKey: true, key: "End" });
      expect(getCtrlKeyInput(event)).toBe("\x1b[1;5F");
    });

    it("returns CSI sequence for Ctrl+Delete", () => {
      const event = createKeyboardEvent({ ctrlKey: true, key: "Delete" });
      expect(getCtrlKeyInput(event)).toBe("\x1b[3;5~");
    });

    it("returns CSI sequence for Ctrl+PageUp", () => {
      const event = createKeyboardEvent({ ctrlKey: true, key: "PageUp" });
      expect(getCtrlKeyInput(event)).toBe("\x1b[5;5~");
    });

    it("returns CSI sequence for Ctrl+F1", () => {
      const event = createKeyboardEvent({ ctrlKey: true, key: "F1" });
      expect(getCtrlKeyInput(event)).toBe("\x1b[1;5P");
    });

    it("returns CSI sequence for Ctrl+F5", () => {
      const event = createKeyboardEvent({ ctrlKey: true, key: "F5" });
      expect(getCtrlKeyInput(event)).toBe("\x1b[15;5~");
    });

    it("returns CSI sequence for Ctrl+F12", () => {
      const event = createKeyboardEvent({ ctrlKey: true, key: "F12" });
      expect(getCtrlKeyInput(event)).toBe("\x1b[24;5~");
    });
  });

  describe("special key literals", () => {
    it("returns CR for Enter", () => {
      const event = createKeyboardEvent({ key: "Enter" });
      expect(getCtrlKeyInput(event)).toBe("\r");
    });

    it("returns DEL for Backspace", () => {
      const event = createKeyboardEvent({ key: "Backspace" });
      expect(getCtrlKeyInput(event)).toBe("\x7f");
    });

    it("returns ESC for Escape", () => {
      const event = createKeyboardEvent({ key: "Escape" });
      expect(getCtrlKeyInput(event)).toBe("\x1b");
    });

    it("returns ESC for Esc", () => {
      const event = createKeyboardEvent({ key: "Esc" });
      expect(getCtrlKeyInput(event)).toBe("\x1b");
    });
  });

  describe("unrecognized keys", () => {
    it("still maps letter code to control character even without ctrlKey flag", () => {
      const event = createKeyboardEvent({ code: "KeyA", key: "a" });
      expect(getCtrlKeyInput(event)).toBe("\x01");
    });

    it("returns null for unrecognized code", () => {
      const event = createKeyboardEvent({ ctrlKey: true, code: "NumpadAdd", key: "+" });
      expect(getCtrlKeyInput(event)).toBeNull();
    });
  });
});

describe("getEmptyTextareaPassthroughInput", () => {
  const emptyTextarea = createTextarea("", 0);
  const nonEmptyTextarea = createTextarea("hello", 3);
  const whitespaceTextarea = createTextarea("   ", 1);

  describe("returns null for non-empty textarea", () => {
    it("does not passthrough Enter when textarea has content", () => {
      const event = createKeyboardEvent({ key: "Enter" });
      expect(getEmptyTextareaPassthroughInput(event, nonEmptyTextarea)).toBeNull();
    });

    it("does not passthrough Ctrl+C when textarea has content", () => {
      const event = createKeyboardEvent({ ctrlKey: true, code: "KeyC", key: "c" });
      expect(getEmptyTextareaPassthroughInput(event, nonEmptyTextarea)).toBeNull();
    });
  });

  describe("whitespace-only textarea is treated as empty", () => {
    it("passes through Enter for whitespace-only value", () => {
      const event = createKeyboardEvent({ key: "Enter" });
      expect(getEmptyTextareaPassthroughInput(event, whitespaceTextarea)).toBe("\r");
    });
  });

  describe("returns null during IME composition", () => {
    it("does not passthrough when isComposing is true", () => {
      const event = createKeyboardEvent({ key: "Enter", isComposing: true });
      expect(getEmptyTextareaPassthroughInput(event, emptyTextarea)).toBeNull();
    });
  });

  describe("native editing shortcuts are not passed through", () => {
    it("blocks Ctrl+A (select all)", () => {
      const event = createKeyboardEvent({ ctrlKey: true, code: "KeyA", key: "a" });
      expect(getEmptyTextareaPassthroughInput(event, emptyTextarea)).toBeNull();
    });

    it("blocks Ctrl+C (copy)", () => {
      const event = createKeyboardEvent({ ctrlKey: true, code: "KeyC", key: "c" });
      expect(getEmptyTextareaPassthroughInput(event, emptyTextarea)).toBeNull();
    });

    it("blocks Ctrl+V (paste)", () => {
      const event = createKeyboardEvent({ ctrlKey: true, code: "KeyV", key: "v" });
      expect(getEmptyTextareaPassthroughInput(event, emptyTextarea)).toBeNull();
    });

    it("blocks Ctrl+X (cut)", () => {
      const event = createKeyboardEvent({ ctrlKey: true, code: "KeyX", key: "x" });
      expect(getEmptyTextareaPassthroughInput(event, emptyTextarea)).toBeNull();
    });

    it("blocks Ctrl+Z (undo)", () => {
      const event = createKeyboardEvent({ ctrlKey: true, code: "KeyZ", key: "z" });
      expect(getEmptyTextareaPassthroughInput(event, emptyTextarea)).toBeNull();
    });

    it("blocks Ctrl+Y (redo)", () => {
      const event = createKeyboardEvent({ ctrlKey: true, code: "KeyY", key: "y" });
      expect(getEmptyTextareaPassthroughInput(event, emptyTextarea)).toBeNull();
    });

    it("blocks Ctrl+Insert (copy alternative)", () => {
      const event = createKeyboardEvent({ ctrlKey: true, code: "Insert", key: "Insert" });
      expect(getEmptyTextareaPassthroughInput(event, emptyTextarea)).toBeNull();
    });

    it("blocks Shift+Insert (paste alternative)", () => {
      const event = createKeyboardEvent({ shiftKey: true, code: "Insert", key: "Insert" });
      expect(getEmptyTextareaPassthroughInput(event, emptyTextarea)).toBeNull();
    });

    it("blocks Shift+Delete (cut alternative)", () => {
      const event = createKeyboardEvent({ shiftKey: true, code: "Delete", key: "Delete" });
      expect(getEmptyTextareaPassthroughInput(event, emptyTextarea)).toBeNull();
    });

    it("blocks any Meta key combination", () => {
      const event = createKeyboardEvent({ metaKey: true, code: "KeyS", key: "s" });
      expect(getEmptyTextareaPassthroughInput(event, emptyTextarea)).toBeNull();
    });
  });

  describe("Ctrl key passthrough (non-native shortcuts)", () => {
    it("passes through Ctrl+D as terminal EOF", () => {
      const event = createKeyboardEvent({ ctrlKey: true, code: "KeyD", key: "d" });
      expect(getEmptyTextareaPassthroughInput(event, emptyTextarea)).toBe("\x04");
    });

    it("passes through Ctrl+L as form feed (clear)", () => {
      const event = createKeyboardEvent({ ctrlKey: true, code: "KeyL", key: "l" });
      expect(getEmptyTextareaPassthroughInput(event, emptyTextarea)).toBe("\x0c");
    });

    it("passes through Ctrl+R as reverse search", () => {
      const event = createKeyboardEvent({ ctrlKey: true, code: "KeyR", key: "r" });
      expect(getEmptyTextareaPassthroughInput(event, emptyTextarea)).toBe("\x12");
    });

    it("passes through Ctrl+U as line clear", () => {
      const event = createKeyboardEvent({ ctrlKey: true, code: "KeyU", key: "u" });
      expect(getEmptyTextareaPassthroughInput(event, emptyTextarea)).toBe("\x15");
    });
  });

  describe("bare key passthrough on empty textarea", () => {
    it("passes through Escape as ESC", () => {
      const event = createKeyboardEvent({ key: "Escape" });
      expect(getEmptyTextareaPassthroughInput(event, emptyTextarea)).toBe("\x1b");
    });

    it("passes through Esc as ESC", () => {
      const event = createKeyboardEvent({ key: "Esc" });
      expect(getEmptyTextareaPassthroughInput(event, emptyTextarea)).toBe("\x1b");
    });

    it("passes through Enter as CR", () => {
      const event = createKeyboardEvent({ key: "Enter" });
      expect(getEmptyTextareaPassthroughInput(event, emptyTextarea)).toBe("\r");
    });

    it("passes through Backspace as DEL", () => {
      const event = createKeyboardEvent({ key: "Backspace" });
      expect(getEmptyTextareaPassthroughInput(event, emptyTextarea)).toBe("\x7f");
    });

    it("passes through Delete as CSI 3~", () => {
      const event = createKeyboardEvent({ key: "Delete" });
      expect(getEmptyTextareaPassthroughInput(event, emptyTextarea)).toBe("\x1b[3~");
    });
  });

  describe("modifier-only combinations return null", () => {
    it("returns null for Alt+key", () => {
      const event = createKeyboardEvent({ altKey: true, key: "a", code: "KeyA" });
      expect(getEmptyTextareaPassthroughInput(event, emptyTextarea)).toBeNull();
    });

    it("returns null for Shift+key (non-special)", () => {
      const event = createKeyboardEvent({ shiftKey: true, key: "A", code: "KeyA" });
      expect(getEmptyTextareaPassthroughInput(event, emptyTextarea)).toBeNull();
    });

    it("returns null for unrecognized bare key", () => {
      const event = createKeyboardEvent({ key: "Tab", code: "Tab" });
      expect(getEmptyTextareaPassthroughInput(event, emptyTextarea)).toBeNull();
    });
  });
});
