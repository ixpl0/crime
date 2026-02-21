import { type Ref, watch, onScopeDispose } from "vue";
import { type ToolbarConfig } from "../types/toolbar";
import { type ToolbarAction } from "../types/toolbar";
import { buildShortcutMap, matchesShortcut, type ShortcutMapping } from "../toolbar/toolbar-shortcuts";

export const useToolbarShortcuts = (
  config: Ref<ToolbarConfig>,
  executeAction: (action: ToolbarAction) => void
): void => {
  let shortcutMappings: readonly ShortcutMapping[] = buildShortcutMap(config.value);

  const isTextInput = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) {
      return false;
    }
    const tagName = target.tagName.toLowerCase();
    return tagName === "textarea" || tagName === "input" || target.isContentEditable;
  };

  const handleKeydown = (event: KeyboardEvent): void => {
    if (isTextInput(event.target) && !event.altKey) {
      return;
    }

    for (const mapping of shortcutMappings) {
      if (matchesShortcut(event, mapping.parsed)) {
        event.preventDefault();
        event.stopPropagation();
        executeAction(mapping.action);
        return;
      }
    }
  };

  window.addEventListener("keydown", handleKeydown);

  const stopWatch = watch(
    config,
    (newConfig) => {
      shortcutMappings = buildShortcutMap(newConfig);
    },
    { deep: true }
  );

  onScopeDispose(() => {
    window.removeEventListener("keydown", handleKeydown);
    stopWatch();
  });
};
