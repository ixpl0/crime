import { inject, provide, type InjectionKey } from "vue";
import { type ReadableRef } from "../types/utils";
import { type TodoDraftViewItem } from "./use-todo-panel";

export interface DebugTodoStore {
  todoDraftViewItems: ReadableRef<TodoDraftViewItem[]>;
  todoDragSourceIndex: ReadableRef<number | null>;
  todoDragOverIndex: ReadableRef<number | null>;
  canDragTodoDraft: (index: number) => boolean;
  shouldShowTodoDragHandle: (index: number) => boolean;
  handleTodoGripMouseDown: (index: number, event: MouseEvent) => void;
  handleTodoTextareaInput: (index: number, event: Event) => void;
  handleTodoTextareaKeydown: (event: KeyboardEvent) => void;
  handleTodoTextareaBlur: () => void;
  confirmTodoEntry: () => void;
  removeTodoEntry: (index: number) => void;
  forcePersistTodoEntries: () => void;
  hidePanel: () => void;
}

const debugTodoStoreKey: InjectionKey<DebugTodoStore> = Symbol(
  "crime-debug-todo-store"
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
