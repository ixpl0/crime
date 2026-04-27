import { inject, provide, ref, type InjectionKey, type Ref } from "vue";

export interface TerminalWorkspaceActions {
  restartAllSessions: () => Promise<void>;
  closeAllSessions: () => Promise<void>;
}

const TERMINAL_WORKSPACE_ACTIONS_STORE_KEY: InjectionKey<Ref<TerminalWorkspaceActions | null>> = Symbol(
  "crime-terminal-workspace-actions-store"
);

export const provideTerminalWorkspaceActionsStore = (): Ref<TerminalWorkspaceActions | null> => {
  const store = ref<TerminalWorkspaceActions | null>(null);
  provide(TERMINAL_WORKSPACE_ACTIONS_STORE_KEY, store);
  return store;
};

export const useTerminalWorkspaceActionsStore = (): Ref<TerminalWorkspaceActions | null> => {
  const store = inject(TERMINAL_WORKSPACE_ACTIONS_STORE_KEY);
  if (!store) {
    throw new Error("Terminal workspace actions store is not available.");
  }
  return store;
};
