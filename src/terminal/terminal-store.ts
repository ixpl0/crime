import {
  inject,
  provide,
  type ComponentPublicInstance,
  type InjectionKey
} from "vue";
import { type ToolbarAction } from "../types/toolbar";
import { type MaybePromise, type ReadableRef } from "../types/utils";

export interface AppTerminalStore {
  isTerminalReady: ReadableRef<boolean>;
  terminalInputText: ReadableRef<string>;
  quickKeyGridSlots: Array<QuickKeyBinding | null>;
  lastPrompt: ReadableRef<string | undefined>;
  setTerminalContainer: (
    element: Element | ComponentPublicInstance | null
  ) => void;
  setTerminalInputTextarea: (
    element: Element | ComponentPublicInstance | null
  ) => void;
  executeToolbarAction: (action: ToolbarAction) => void;
  focusTerminal: () => void;
  handleTerminalCopyEvent: (event: MouseEvent) => void;
  setTerminalInputText: (value: string) => void;
  handleTextareaKeydown: (event: KeyboardEvent) => void;
  handleTextareaInput: (event: Event) => void;
  handleTextareaPaste: (event: ClipboardEvent) => MaybePromise;
  sendTextareaToTerminal: () => MaybePromise;
  sendQuickKey: (quickKey: QuickKeyBinding) => void;
}

const appTerminalStoreKey: InjectionKey<AppTerminalStore> = Symbol(
  "crime-app-terminal-store"
);

export function provideAppTerminalStore(store: AppTerminalStore) {
  provide(appTerminalStoreKey, store);
}

export function useAppTerminalStore() {
  const store = inject(appTerminalStoreKey);
  if (store === undefined) {
    throw new Error("App terminal store is not available.");
  }

  return store;
}
