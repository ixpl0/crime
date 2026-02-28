const NATIVE_TEXTAREA_CTRL_EDITING_CODES = new Set([
  "KeyA",
  "KeyC",
  "KeyV",
  "KeyX",
  "KeyY",
  "KeyZ",
  "Insert"
]);

const CTRL_CHARACTER_BY_CODE: Readonly<Partial<Record<string, string>>> = {
  Digit2: "\u0000",
  Backquote: "\u0000",
  Space: "\u0000",
  Digit3: "\u001b",
  BracketLeft: "\u001b",
  Digit4: "\u001c",
  Backslash: "\u001c",
  Digit5: "\u001d",
  BracketRight: "\u001d",
  Digit6: "\u001e",
  Digit7: "\u001f",
  Minus: "\u001f",
  Slash: "\u001f",
  Digit8: "\u007f"
};

const CTRL_SPECIAL_KEY_TEMPLATES: Readonly<Partial<Record<string, string>>> = {
  ArrowUp: "\u001b[1;{m}A",
  ArrowDown: "\u001b[1;{m}B",
  ArrowRight: "\u001b[1;{m}C",
  ArrowLeft: "\u001b[1;{m}D",
  Home: "\u001b[1;{m}H",
  End: "\u001b[1;{m}F",
  Insert: "\u001b[2;{m}~",
  Delete: "\u001b[3;{m}~",
  PageUp: "\u001b[5;{m}~",
  PageDown: "\u001b[6;{m}~",
  F1: "\u001b[1;{m}P",
  F2: "\u001b[1;{m}Q",
  F3: "\u001b[1;{m}R",
  F4: "\u001b[1;{m}S",
  F5: "\u001b[15;{m}~",
  F6: "\u001b[17;{m}~",
  F7: "\u001b[18;{m}~",
  F8: "\u001b[19;{m}~",
  F9: "\u001b[20;{m}~",
  F10: "\u001b[21;{m}~",
  F11: "\u001b[23;{m}~",
  F12: "\u001b[24;{m}~"
};

const CTRL_SPECIAL_KEY_LITERALS: Readonly<Partial<Record<string, string>>> = {
  Enter: "\r",
  Backspace: "\u007f",
  Escape: "\u001b",
  Esc: "\u001b"
};

function parseCssPixelValue(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getComputedLineHeightPixels(style: CSSStyleDeclaration) {
  const lineHeight = Number.parseFloat(style.lineHeight);
  if (Number.isFinite(lineHeight)) {
    return lineHeight;
  }

  const fontSize = Number.parseFloat(style.fontSize);
  if (Number.isFinite(fontSize)) {
    return fontSize * 1.2;
  }

  return 16 * 1.2;
}

function applyMirrorStyle(mirror: HTMLDivElement, style: CSSStyleDeclaration, width: number) {
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.pointerEvents = "none";
  mirror.style.top = "0";
  mirror.style.left = "-9999px";
  mirror.style.boxSizing = "border-box";
  mirror.style.width = `${String(width)}px`;
  mirror.style.padding = style.padding;
  mirror.style.font = style.font;
  mirror.style.lineHeight = style.lineHeight;
  mirror.style.letterSpacing = style.letterSpacing;
  mirror.style.wordSpacing = style.wordSpacing;
  mirror.style.textTransform = style.textTransform;
  mirror.style.textIndent = style.textIndent;
  mirror.style.textAlign = style.textAlign;
  mirror.style.tabSize = style.tabSize;
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "break-word";
  mirror.style.wordBreak = "break-word";
}

function createMirror(textarea: HTMLTextAreaElement) {
  const style = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");
  mirror.setAttribute("aria-hidden", "true");
  applyMirrorStyle(mirror, style, textarea.clientWidth);
  return { mirror, style };
}

function createCaretMarker() {
  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  return marker;
}

export function isCursorOnFirstLine(textarea: HTMLTextAreaElement) {
  return !textarea.value.slice(0, textarea.selectionStart).includes("\n");
}

export function isCursorOnLastLine(textarea: HTMLTextAreaElement) {
  return !textarea.value.slice(textarea.selectionEnd).includes("\n");
}

export function isCursorOnFirstVisualLine(textarea: HTMLTextAreaElement) {
  if (textarea.selectionStart === 0) {
    return true;
  }

  const { mirror, style } = createMirror(textarea);
  mirror.textContent = textarea.value.slice(0, textarea.selectionStart);
  const caretMarker = createCaretMarker();
  mirror.appendChild(caretMarker);

  document.body.appendChild(mirror);
  try {
    const mirrorRect = mirror.getBoundingClientRect();
    const caretRect = caretMarker.getBoundingClientRect();
    const caretTop = caretRect.top - mirrorRect.top;
    const paddingTop = parseCssPixelValue(style.paddingTop);
    const lineHeight = getComputedLineHeightPixels(style);
    return caretTop <= paddingTop + lineHeight * 0.5;
  } finally {
    mirror.remove();
  }
}

export function isCursorOnLastVisualLine(textarea: HTMLTextAreaElement) {
  const { mirror, style } = createMirror(textarea);
  const beforeCursor = textarea.value.slice(0, textarea.selectionEnd);
  const afterCursor = textarea.value.slice(textarea.selectionEnd);
  mirror.appendChild(document.createTextNode(beforeCursor));

  const caretMarker = createCaretMarker();
  mirror.appendChild(caretMarker);
  mirror.appendChild(document.createTextNode(afterCursor));

  const endMarker = createCaretMarker();
  mirror.appendChild(endMarker);

  document.body.appendChild(mirror);
  try {
    const mirrorRect = mirror.getBoundingClientRect();
    const caretTop = caretMarker.getBoundingClientRect().top - mirrorRect.top;
    const endTop = endMarker.getBoundingClientRect().top - mirrorRect.top;
    const lineHeight = getComputedLineHeightPixels(style);
    return endTop - caretTop <= lineHeight * 0.5;
  } finally {
    mirror.remove();
  }
}

function getCsiModifierValue(event: KeyboardEvent) {
  let modifier = 1;
  if (event.shiftKey) {
    modifier += 1;
  }
  if (event.altKey) {
    modifier += 2;
  }
  if (event.ctrlKey) {
    modifier += 4;
  }
  return modifier;
}

function getCtrlCharacterInput(event: KeyboardEvent): string | null {
  if (/^Key[A-Z]$/.test(event.code)) {
    const code = event.code.charCodeAt(3) - 64;
    return String.fromCharCode(code);
  }

  return CTRL_CHARACTER_BY_CODE[event.code] ?? null;
}

function getCtrlSpecialKeyInput(event: KeyboardEvent): string | null {
  const template = CTRL_SPECIAL_KEY_TEMPLATES[event.key];
  if (template) {
    return template.replace("{m}", String(getCsiModifierValue(event)));
  }

  return CTRL_SPECIAL_KEY_LITERALS[event.key] ?? null;
}

export function getCtrlKeyInput(event: KeyboardEvent): string | null {
  const controlCharacter = getCtrlCharacterInput(event);
  if (controlCharacter !== null) {
    return event.altKey ? `\u001b${controlCharacter}` : controlCharacter;
  }

  return getCtrlSpecialKeyInput(event);
}

function isTextareaNativeEditingShortcut(event: KeyboardEvent) {
  if (event.metaKey) {
    return true;
  }

  if (event.altKey) {
    return false;
  }

  if (event.ctrlKey) {
    return NATIVE_TEXTAREA_CTRL_EDITING_CODES.has(event.code);
  }

  return event.shiftKey && (event.code === "Insert" || event.code === "Delete");
}

export function getEmptyTextareaPassthroughInput(
  event: KeyboardEvent,
  textarea: HTMLTextAreaElement
) {
  if (textarea.value.trim().length > 0 || event.isComposing) {
    return null;
  }

  if (isTextareaNativeEditingShortcut(event)) {
    return null;
  }

  if (event.ctrlKey) {
    return getCtrlKeyInput(event);
  }

  if (event.altKey || event.shiftKey) {
    return null;
  }

  if (event.key === "Escape" || event.key === "Esc") {
    return "\u001b";
  }
  if (event.key === "Enter") {
    return "\r";
  }
  if (event.key === "Backspace") {
    return "\u007f";
  }
  if (event.key === "Delete") {
    return "\u001b[3~";
  }

  return null;
}
