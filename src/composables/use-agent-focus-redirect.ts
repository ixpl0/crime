import { onScopeDispose, type Ref } from "vue";
import { type AppTab } from "../navigation/use-app-navigation";

interface UseAgentFocusRedirectOptions {
  activeTab: Ref<AppTab>;
  isAgentDetached: Ref<boolean>;
  focusTerminal: () => void;
}

const MODIFIER_KEYS = new Set(["Control", "Alt", "Shift", "Meta"]);

const isFocusIdle = (): boolean => {
  const active = document.activeElement;
  if (!active || active === document.body) {
    return true;
  }
  if (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement) {
    return false;
  }
  if ((active as HTMLElement).isContentEditable) {
    return false;
  }
  if ((active as HTMLElement).closest(".cm-editor")) {
    return false;
  }
  return true;
};

export const useAgentFocusRedirect = (options: UseAgentFocusRedirectOptions): void => {
  const handleKeydown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || MODIFIER_KEYS.has(event.key)) {
      return;
    }
    if (!isFocusIdle()) {
      return;
    }
    if (options.activeTab.value !== "agent" && !options.isAgentDetached.value) {
      return;
    }
    options.focusTerminal();
  };

  window.addEventListener("keydown", handleKeydown);
  onScopeDispose(() => {
    window.removeEventListener("keydown", handleKeydown);
  });
};
