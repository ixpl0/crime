import {
  inject,
  provide,
  type ComponentPublicInstance,
  type InjectionKey,
  type Ref
} from "vue";
import { type ToolbarAction } from "../types/toolbar";

type ReadableRef<T> = Readonly<Ref<T>>;
type MaybePromise = void | Promise<void>;

export interface AppTerminalStore {
  isTerminalReady: ReadableRef<boolean>;
  terminalPanelHeight: ReadableRef<number>;
  isTerminalPanelResizeActive: ReadableRef<boolean>;
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
  handleTerminalContextMenu: (event: MouseEvent) => void;
  handleTerminalAuxClick: (event: MouseEvent) => void;
  handleTerminalPanelResizePointerDown: (event: PointerEvent) => void;
  setTerminalInputText: (value: string) => void;
  handleTextareaKeydown: (event: KeyboardEvent) => void;
  handleTextareaInput: (event: Event) => void;
  handleTextareaPaste: (event: ClipboardEvent) => MaybePromise;
  sendTextareaToTerminal: () => MaybePromise;
  sendQuickKey: (data: string) => void;
}

const appTerminalStoreKey: InjectionKey<AppTerminalStore> = Symbol(
  "dream-ide-app-terminal-store"
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
