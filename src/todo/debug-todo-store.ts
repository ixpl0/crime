import { inject, provide, type InjectionKey } from "vue";
import { type MaybePromise, type ReadableRef } from "../types/utils";
import { type TodoDraftViewItem } from "./use-todo-panel";

export interface DebugTodoStore {
  todoDraftViewItems: ReadableRef<TodoDraftViewItem[]>;
  todoDragSourceIndex: ReadableRef<number | null>;
  todoDragOverIndex: ReadableRef<number | null>;
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
  sendTodoEntryToTerminal: (index: number) => MaybePromise;
  hidePanel: () => void;
}

const debugTodoStoreKey: InjectionKey<DebugTodoStore> = Symbol(
  "dream-ide-debug-todo-store"
);

export function provideDebugTodoStore(store: DebugTodoStore) {
  provide(debugTodoStoreKey, store);
}

export function useDebugTodoStore() {
  const store = inject(debugTodoStoreKey);
  if (store === undefined) {
    throw new Error("Debug todo store is not available.");
  }

  return store;
}
