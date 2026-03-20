import { inject, provide, type InjectionKey } from "vue";
import { type MaybePromise, type ReadableRef } from "../types/utils";
import { type TodoDraftViewItem } from "./use-todo-panel";

export interface AppTodoStore {
  isTodoPanelCollapsed: ReadableRef<boolean>;
  todoDraftViewItems: ReadableRef<TodoDraftViewItem[]>;
  todoDragSourceIndex: ReadableRef<number | null>;
  todoDragOverIndex: ReadableRef<number | null>;
  toggleTodoPanelCollapse: () => void;
  canDragTodoDraft: (index: number) => boolean;
  shouldShowTodoDragHandle: (index: number) => boolean;
  handleTodoDragStart: (index: number, event: DragEvent) => void;
  handleTodoDragEnter: (index: number, event: DragEvent) => void;
  handleTodoDragOver: (index: number, event: DragEvent) => void;
  handleTodoDragEnd: () => void;
  handleTodoDrop: (index: number, event: DragEvent) => void;
  handleTodoTextareaInput: (index: number, event: Event) => void;
  handleTodoTextareaKeydown: (event: KeyboardEvent) => void;
  handleTodoTextareaBlur: () => void;
  confirmTodoEntry: () => void;
  sendTodoEntryToTerminal: (index: number) => MaybePromise;
  isDebugTodoPanelVisible: ReadableRef<boolean>;
  toggleDebugTodoPanel: () => void;
}

const appTodoStoreKey: InjectionKey<AppTodoStore> = Symbol(
  "crime-app-todo-store"
);

export function provideAppTodoStore(store: AppTodoStore) {
  provide(appTodoStoreKey, store);
}

export function useAppTodoStore() {
  const store = inject(appTodoStoreKey);
  if (store === undefined) {
    throw new Error("App todo store is not available.");
  }

  return store;
}
