import { type Ref, watch, onScopeDispose } from "vue";
import { type ToolbarConfig } from "../types/toolbar";
import { type ToolbarAction } from "../types/toolbar";
import { buildShortcutMap, matchesShortcut, type ShortcutMapping } from "../toolbar/toolbar-shortcuts";

function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  // xterm uses an internal textarea for keyboard capture; treat it as terminal context.
  if (target.classList.contains("xterm-helper-textarea") || target.closest(".terminal-host")) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return tagName === "textarea" || tagName === "input" || target.isContentEditable;
}

function createShortcutKeydownHandler(
  getMappings: () => readonly ShortcutMapping[],
  executeAction: (action: ToolbarAction) => void
) {
  return (event: KeyboardEvent): void => {
    if (isTextInputTarget(event.target) && !event.altKey) {
      return;
    }

    for (const mapping of getMappings()) {
      if (matchesShortcut(event, mapping.parsed)) {
        event.preventDefault();
        event.stopPropagation();
        executeAction(mapping.action);
        return;
      }
    }
  };
}

function stopShortcutTracking(handler: (event: KeyboardEvent) => void, stopWatch: () => void) {
  window.removeEventListener("keydown", handler);
  stopWatch();
}

export const useToolbarShortcuts = (
  config: Ref<ToolbarConfig>,
  executeAction: (action: ToolbarAction) => void
): void => {
  let shortcutMappings: readonly ShortcutMapping[] = buildShortcutMap(config.value);
  const handleKeydown = createShortcutKeydownHandler(() => shortcutMappings, executeAction);

  window.addEventListener("keydown", handleKeydown);

  const stopWatch = watch(
    config,
    (newConfig) => {
      shortcutMappings = buildShortcutMap(newConfig);
    },
    { deep: true }
  );

  onScopeDispose(() => {
    stopShortcutTracking(handleKeydown, stopWatch);
  });
};
