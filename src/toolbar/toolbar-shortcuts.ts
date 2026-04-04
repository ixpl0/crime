import { type ToolbarAction, type ToolbarConfig } from "../types/toolbar";

export interface ParsedShortcut {
  readonly alt: boolean;
  readonly ctrl: boolean;
  readonly shift: boolean;
  readonly meta: boolean;
  readonly code: string;
}

const keyTokenToCode: Readonly<Record<string, string>> = {
  up: "ArrowUp",
  arrowup: "ArrowUp",
  down: "ArrowDown",
  arrowdown: "ArrowDown",
  left: "ArrowLeft",
  arrowleft: "ArrowLeft",
  right: "ArrowRight",
  arrowright: "ArrowRight",
  esc: "Escape",
  escape: "Escape",
  enter: "Enter",
  return: "Enter",
  tab: "Tab",
  space: "Space",
  backspace: "Backspace",
  delete: "Delete",
  del: "Delete",
  insert: "Insert",
  ins: "Insert",
  home: "Home",
  end: "End",
  pageup: "PageUp",
  pgup: "PageUp",
  pagedown: "PageDown",
  pgdown: "PageDown",
  minus: "Minus",
  "-": "Minus",
  equal: "Equal",
  "=": "Equal",
  bracketleft: "BracketLeft",
  "[": "BracketLeft",
  bracketright: "BracketRight",
  "]": "BracketRight",
  backslash: "Backslash",
  "\\": "Backslash",
  semicolon: "Semicolon",
  ";": "Semicolon",
  quote: "Quote",
  "'": "Quote",
  comma: "Comma",
  ",": "Comma",
  period: "Period",
  ".": "Period",
  slash: "Slash",
  "/": "Slash",
  backquote: "Backquote",
  "`": "Backquote",
};

const codeToDisplayKey: Readonly<Record<string, string>> = {
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  Escape: "Esc",
  Enter: "Enter",
  Tab: "Tab",
  Space: "Space",
  Backspace: "Backspace",
  Delete: "Delete",
  Insert: "Insert",
  Home: "Home",
  End: "End",
  PageUp: "PageUp",
  PageDown: "PageDown",
  Minus: "Minus",
  Equal: "Equal",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Backquote: "`",
};

const parseShortcutCode = (token: string): string | null => {
  const normalizedToken = token.trim().toLowerCase();

  if (/^key[a-z]$/.test(normalizedToken)) {
    return `Key${normalizedToken.slice(3).toUpperCase()}`;
  }

  if (/^digit[0-9]$/.test(normalizedToken)) {
    return `Digit${normalizedToken.slice(5)}`;
  }

  if (/^[a-z]$/.test(normalizedToken)) {
    return `Key${normalizedToken.toUpperCase()}`;
  }

  if (/^[0-9]$/.test(normalizedToken)) {
    return `Digit${normalizedToken}`;
  }

  if (/^f([1-9]|1[0-9]|2[0-4])$/.test(normalizedToken)) {
    return normalizedToken.toUpperCase();
  }

  return keyTokenToCode[normalizedToken] ?? null;
};

const formatShortcutCode = (code: string): string => {
  if (/^Key[A-Z]$/.test(code)) {
    return code.slice(3);
  }

  if (/^Digit[0-9]$/.test(code)) {
    return code.slice(5);
  }

  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) {
    return code;
  }

  return codeToDisplayKey[code] ?? code;
};

interface ParsedShortcutModifiers {
  alt: boolean;
  ctrl: boolean;
  shift: boolean;
  meta: boolean;
}

function applyUniqueModifierFlag(
  modifiers: ParsedShortcutModifiers,
  key: keyof ParsedShortcutModifiers
): boolean {
  if (modifiers[key]) {
    return false;
  }

  modifiers[key] = true;
  return true;
}

function applyShortcutModifier(
  modifiers: ParsedShortcutModifiers,
  modifierToken: string
): boolean {
  const token = modifierToken.toLowerCase();
  if (token === "alt") {
    return applyUniqueModifierFlag(modifiers, "alt");
  }

  if (token === "ctrl" || token === "control") {
    return applyUniqueModifierFlag(modifiers, "ctrl");
  }

  if (token === "shift") {
    return applyUniqueModifierFlag(modifiers, "shift");
  }

  if (token === "meta" || token === "cmd" || token === "command") {
    return applyUniqueModifierFlag(modifiers, "meta");
  }

  return false;
}

function parseShortcutModifiers(modifierTokens: readonly string[]): ParsedShortcutModifiers | null {
  const modifiers: ParsedShortcutModifiers = {
    alt: false,
    ctrl: false,
    shift: false,
    meta: false
  };

  for (const modifierToken of modifierTokens) {
    if (!applyShortcutModifier(modifiers, modifierToken)) {
      return null;
    }
  }

  return modifiers;
}

export const parseShortcut = (shortcut: string): ParsedShortcut | null => {
  const parts = shortcut.split("+").map((part) => part.trim());
  if (parts.length < 2 || parts.some((part) => part.length === 0)) {
    return null;
  }

  const code = parseShortcutCode(parts[parts.length - 1]);
  if (!code) {
    return null;
  }

  const modifiers = parseShortcutModifiers(parts.slice(0, -1));
  if (!modifiers) {
    return null;
  }

  return {
    ...modifiers,
    code
  };
};

export const matchesShortcut = (event: KeyboardEvent, parsed: ParsedShortcut): boolean =>
  event.altKey === parsed.alt &&
  event.ctrlKey === parsed.ctrl &&
  event.shiftKey === parsed.shift &&
  event.metaKey === parsed.meta &&
  event.code === parsed.code;

export const formatShortcut = (shortcut: string): string => {
  const parsed = parseShortcut(shortcut);
  if (!parsed) {
    return shortcut;
  }

  const parts: string[] = [];
  if (parsed.ctrl) {
    parts.push("Ctrl");
  }
  if (parsed.alt) {
    parts.push("Alt");
  }
  if (parsed.shift) {
    parts.push("Shift");
  }
  if (parsed.meta) {
    parts.push("Meta");
  }
  parts.push(formatShortcutCode(parsed.code));

  return parts.join("+");
};

export interface ShortcutMapping {
  readonly parsed: ParsedShortcut;
  readonly action: ToolbarAction;
}

const toElementActions = (element: ToolbarConfig["elements"][number]): readonly ToolbarAction[] =>
  "items" in element ? element.items.flatMap(toElementActions) : [element];

function toActionShortcutMapping(action: ToolbarAction): ShortcutMapping | null {
  if (!action.shortcut) {
    return null;
  }

  const parsed = parseShortcut(action.shortcut);
  if (!parsed) {
    return null;
  }

  return { parsed, action };
}

function appendElementShortcutMappings(
  mappings: ShortcutMapping[],
  element: ToolbarConfig["elements"][number]
) {
  for (const action of toElementActions(element)) {
    const mapping = toActionShortcutMapping(action);
    if (mapping) {
      mappings.push(mapping);
    }
  }
}

export const buildShortcutMap = (config: ToolbarConfig): readonly ShortcutMapping[] => {
  const mappings: ShortcutMapping[] = [];
  for (const element of config.elements) {
    appendElementShortcutMappings(mappings, element);
  }

  return mappings;
};
