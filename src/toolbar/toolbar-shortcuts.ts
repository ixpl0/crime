import { type ToolbarAction, type ToolbarConfig } from "../types/toolbar";

export interface ParsedShortcut {
  readonly alt: boolean;
  readonly ctrl: boolean;
  readonly shift: boolean;
  readonly meta: boolean;
  readonly key: string;
}

export const parseShortcut = (shortcut: string): ParsedShortcut | null => {
  const parts = shortcut.toLowerCase().split("+");
  if (parts.length < 2) {
    return null;
  }

  const key = parts[parts.length - 1];
  const modifiers = parts.slice(0, -1);

  if (!key) {
    return null;
  }

  return {
    alt: modifiers.includes("alt"),
    ctrl: modifiers.includes("ctrl"),
    shift: modifiers.includes("shift"),
    meta: modifiers.includes("meta"),
    key,
  };
};

export const matchesShortcut = (event: KeyboardEvent, parsed: ParsedShortcut): boolean =>
  event.altKey === parsed.alt &&
  event.ctrlKey === parsed.ctrl &&
  event.shiftKey === parsed.shift &&
  event.metaKey === parsed.meta &&
  event.key.toLowerCase() === parsed.key;

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
  parts.push(parsed.key.toUpperCase());

  return parts.join("+");
};

export interface ShortcutMapping {
  readonly parsed: ParsedShortcut;
  readonly action: ToolbarAction;
}

export const buildShortcutMap = (config: ToolbarConfig): readonly ShortcutMapping[] =>
  config.elements.flatMap((element): readonly ShortcutMapping[] => {
    if (element.type === "button" && element.shortcut) {
      const parsed = parseShortcut(element.shortcut);
      if (!parsed) {
        return [];
      }
      return [{ parsed, action: element.action }];
    }

    if (element.type === "dropdown") {
      return element.items.flatMap((item): readonly ShortcutMapping[] => {
        if (!item.shortcut) {
          return [];
        }
        const parsed = parseShortcut(item.shortcut);
        if (!parsed) {
          return [];
        }
        return [{ parsed, action: item.action }];
      });
    }

    return [];
  });
