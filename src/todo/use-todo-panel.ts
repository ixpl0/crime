import { computed, nextTick, ref, type Ref } from "vue";
import { loadTodoEntries, saveTodoEntries } from "../settings/todo-storage";
import { areStringArraysEqual } from "../utils/array-utils";
import {
  focusTodoComposerTextarea,
  getFocusedTodoSnapshot,
  getNormalizedTodoDrafts,
  getPersistedTodoEntries,
  hasTodoDraftPlaceholder,
  resizeTodoTextareas,
  restoreTodoFocus
} from "./todo-drafts-utils";

export type TodoEntriesLoadSource = "project-open" | "settings-watch";

export interface UseTodoPanelOptions {
  projectPath: Ref<string | null>;
  collapsedStorageKey: string;
  reportUiError: (context: string, error: unknown, fallbackMessage: string) => unknown;
}

export interface TodoDraftViewItem {
  index: number;
  value: string;
}

interface TodoPanelState {
  readonly options: UseTodoPanelOptions;
  readonly todoDrafts: Ref<string[]>;
  readonly todoDragSourceIndex: Ref<number | null>;
  readonly todoDragOverIndex: Ref<number | null>;
  readonly isTodoPanelCollapsed: Ref<boolean>;
  readonly todoDraftViewItems: Ref<TodoDraftViewItem[]>;
  todoEntriesLoadToken: number;
  todoDraftEditVersion: number;
  todoPersistedVersion: number;
  todoPersistQueue: Promise<void>;
}

function scheduleTodoTextareasResize() {
  void nextTick(() => {
    resizeTodoTextareas();
  });
}

function createTodoPanelState(options: UseTodoPanelOptions): TodoPanelState {
  const todoDrafts = ref<string[]>([""]);
  const todoDragSourceIndex = ref<number | null>(null);
  const todoDragOverIndex = ref<number | null>(null);
  const isTodoPanelCollapsed = ref(window.localStorage.getItem(options.collapsedStorageKey) === "1");
  const todoDraftViewItems = computed<TodoDraftViewItem[]>(() =>
    todoDrafts.value.map((value, index) => ({ index, value })).reverse()
  );
  return {
    options,
    todoDrafts,
    todoDragSourceIndex,
    todoDragOverIndex,
    isTodoPanelCollapsed,
    todoDraftViewItems,
    todoEntriesLoadToken: 0,
    todoDraftEditVersion: 0,
    todoPersistedVersion: 0,
    todoPersistQueue: Promise.resolve()
  };
}

function persistTodoPanelCollapsedState(state: TodoPanelState, isCollapsed: boolean) {
  window.localStorage.setItem(state.options.collapsedStorageKey, isCollapsed ? "1" : "0");
}

function toggleTodoPanelCollapse(state: TodoPanelState) {
  state.isTodoPanelCollapsed.value = !state.isTodoPanelCollapsed.value;
}

function handleTodoPanelCollapsedChanged(state: TodoPanelState, isCollapsed: boolean) {
  persistTodoPanelCollapsedState(state, isCollapsed);
  if (!isCollapsed) {
    scheduleTodoTextareasResize();
  }
}

function isTodoDraftIndexValid(state: TodoPanelState, index: number) {
  return index >= 0 && index < state.todoDrafts.value.length;
}

function canDragTodoDraft(state: TodoPanelState, index: number) {
  return isTodoDraftIndexValid(state, index) && state.todoDrafts.value[index].trim().length > 0;
}

function shouldShowTodoDragHandle(state: TodoPanelState, index: number) {
  return canDragTodoDraft(state, index);
}

function resetTodoDragState(state: TodoPanelState) {
  state.todoDragSourceIndex.value = null;
  state.todoDragOverIndex.value = null;
}

function getTodoDragSourceIndex(state: TodoPanelState, event: DragEvent) {
  if (state.todoDragSourceIndex.value !== null) {
    return state.todoDragSourceIndex.value;
  }
  const rawSourceIndex = event.dataTransfer?.getData("text/plain") ?? "";
  const parsedSourceIndex = Number.parseInt(rawSourceIndex, 10);
  return Number.isInteger(parsedSourceIndex) ? parsedSourceIndex : null;
}

function createPersistTodoOperation(state: TodoPanelState, path: string, entries: string[], version: number) {
  return async () => {
    try {
      await saveTodoEntries(path, entries);
    } catch (error) {
      state.options.reportUiError("Todo entries", error, "Failed to persist todo entries.");
      return;
    }
    if (state.options.projectPath.value === path && version > state.todoPersistedVersion) {
      state.todoPersistedVersion = version;
    }
  };
}

function persistTodoEntries(state: TodoPanelState, entries: string[], version: number) {
  if (!state.options.projectPath.value) {
    return;
  }
  const path = state.options.projectPath.value;
  const operation = createPersistTodoOperation(state, path, entries, version);
  state.todoPersistQueue = state.todoPersistQueue.then(operation, operation);
}

function persistCurrentTodoEntries(state: TodoPanelState, version: number) {
  persistTodoEntries(state, getPersistedTodoEntries(state.todoDrafts.value), version);
}

function updateTodoDrafts(state: TodoPanelState, drafts: string[]) {
  state.todoDraftEditVersion += 1;
  state.todoDrafts.value = drafts;
  return state.todoDraftEditVersion;
}

function handleTodoDragStart(state: TodoPanelState, index: number, event: DragEvent) {
  if (!canDragTodoDraft(state, index)) {
    event.preventDefault();
    return;
  }
  state.todoDragSourceIndex.value = index;
  state.todoDragOverIndex.value = index;
  if (!event.dataTransfer) {
    return;
  }
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", String(index));
}

function handleTodoDragEnter(state: TodoPanelState, index: number, event: DragEvent) {
  if (state.todoDragSourceIndex.value === null || !isTodoDraftIndexValid(state, index)) {
    return;
  }
  event.preventDefault();
  state.todoDragOverIndex.value = index;
}

function handleTodoDragOver(state: TodoPanelState, index: number, event: DragEvent) {
  if (state.todoDragSourceIndex.value === null || !isTodoDraftIndexValid(state, index)) {
    return;
  }
  event.preventDefault();
  state.todoDragOverIndex.value = index;
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
}

function handleTodoDragEnd(state: TodoPanelState) {
  resetTodoDragState(state);
}

function applyReorderedTodoDrafts(state: TodoPanelState, sourceIndex: number, targetIndex: number) {
  const focusedTodoSnapshot = getFocusedTodoSnapshot();
  const shouldIncludePlaceholder = hasTodoDraftPlaceholder(state.todoDrafts.value);
  const reorderedDrafts = [...state.todoDrafts.value];
  const [movedDraft] = reorderedDrafts.splice(sourceIndex, 1);
  if (typeof movedDraft !== "string" || movedDraft.trim().length === 0) {
    return;
  }
  reorderedDrafts.splice(targetIndex, 0, movedDraft);
  const normalizedDrafts = getNormalizedTodoDrafts(
    reorderedDrafts.filter((entry) => entry.trim().length > 0),
    { includePlaceholder: shouldIncludePlaceholder }
  );
  const nextVersion = updateTodoDrafts(state, normalizedDrafts);
  persistCurrentTodoEntries(state, nextVersion);
  void nextTick(() => {
    resizeTodoTextareas();
    restoreTodoFocus(focusedTodoSnapshot);
  });
}

function handleTodoDrop(state: TodoPanelState, index: number, event: DragEvent) {
  if (!isTodoDraftIndexValid(state, index)) {
    resetTodoDragState(state);
    return;
  }
  const sourceIndex = getTodoDragSourceIndex(state, event);
  if (sourceIndex === null || !canDragTodoDraft(state, sourceIndex) || sourceIndex === index) {
    resetTodoDragState(state);
    return;
  }

  applyReorderedTodoDrafts(state, sourceIndex, index);
  resetTodoDragState(state);
}

function finalizeTodoDraftEditing(state: TodoPanelState, options: { focusComposer?: boolean } = {}) {
  const nextDrafts = getNormalizedTodoDrafts(state.todoDrafts.value, { includePlaceholder: true });
  const didUpdateDrafts = !areStringArraysEqual(state.todoDrafts.value, nextDrafts);
  const nextVersion = didUpdateDrafts ? updateTodoDrafts(state, nextDrafts) : state.todoDraftEditVersion;
  if (state.todoDraftEditVersion > state.todoPersistedVersion) {
    persistCurrentTodoEntries(state, nextVersion);
  }
  if (!didUpdateDrafts && !options.focusComposer) {
    return;
  }

  void nextTick(() => {
    if (didUpdateDrafts) {
      resizeTodoTextareas();
    }
    if (options.focusComposer) {
      focusTodoComposerTextarea(state.todoDrafts.value.length);
    }
  });
}

function handleTodoTextareaInput(state: TodoPanelState, index: number, event: Event) {
  const textarea = event.target;
  if (!(textarea instanceof HTMLTextAreaElement) || !isTodoDraftIndexValid(state, index)) {
    return;
  }
  const nextDrafts = [...state.todoDrafts.value];
  const previousValue = nextDrafts[index] ?? "";
  const hadPlaceholder = hasTodoDraftPlaceholder(state.todoDrafts.value);
  nextDrafts[index] = textarea.value;
  const isCompletedPlaceholder = previousValue.trim().length === 0 && textarea.value.trim().length > 0;
  const includePlaceholder = hadPlaceholder && !isCompletedPlaceholder;
  updateTodoDrafts(state, getNormalizedTodoDrafts(nextDrafts, { includePlaceholder }));
}

function handleTodoTextareaKeydown(state: TodoPanelState, event: KeyboardEvent) {
  if (event.key !== "Enter" || (!event.ctrlKey && !event.metaKey)) {
    return;
  }
  event.preventDefault();
  finalizeTodoDraftEditing(state, { focusComposer: true });
}

function handleTodoTextareaBlur(state: TodoPanelState) {
  finalizeTodoDraftEditing(state);
}

async function loadTodoEntriesForProject(state: TodoPanelState, path: string, source: TodoEntriesLoadSource) {
  const loadToken = state.todoEntriesLoadToken + 1;
  state.todoEntriesLoadToken = loadToken;
  const entries = await loadTodoEntries(path);
  if (state.options.projectPath.value !== path || state.todoEntriesLoadToken !== loadToken) {
    return;
  }
  if (source === "settings-watch" && state.todoDraftEditVersion > state.todoPersistedVersion) {
    return;
  }
  const focusedTodoSnapshot = getFocusedTodoSnapshot();
  const nextDrafts = getNormalizedTodoDrafts(entries);
  if (areStringArraysEqual(state.todoDrafts.value, nextDrafts)) {
    void nextTick(() => {
      resizeTodoTextareas();
      restoreTodoFocus(focusedTodoSnapshot);
    });
    return;
  }
  state.todoDrafts.value = nextDrafts;
  void nextTick(() => {
    resizeTodoTextareas();
    restoreTodoFocus(focusedTodoSnapshot);
  });
}

function getTodoEntry(state: TodoPanelState, index: number) {
  if (!isTodoDraftIndexValid(state, index)) {
    return null;
  }
  return state.todoDrafts.value[index];
}

function removeTodoEntry(state: TodoPanelState, index: number) {
  if (!isTodoDraftIndexValid(state, index)) {
    return false;
  }
  const nextDrafts = [...state.todoDrafts.value];
  nextDrafts.splice(index, 1);
  const nextVersion = updateTodoDrafts(state, getNormalizedTodoDrafts(nextDrafts));
  resetTodoDragState(state);
  persistCurrentTodoEntries(state, nextVersion);
  scheduleTodoTextareasResize();
  return true;
}

function resetTodoRuntimeState(state: TodoPanelState) {
  state.todoDrafts.value = [""];
  resetTodoDragState(state);
  state.todoDraftEditVersion = 0;
  state.todoPersistedVersion = 0;
  state.todoPersistQueue = Promise.resolve();
}

export function useTodoPanel(options: UseTodoPanelOptions) {
  const state = createTodoPanelState(options);
  return {
    isTodoPanelCollapsed: state.isTodoPanelCollapsed, todoDragSourceIndex: state.todoDragSourceIndex,
    todoDragOverIndex: state.todoDragOverIndex, todoDraftViewItems: state.todoDraftViewItems,
    toggleTodoPanelCollapse: toggleTodoPanelCollapse.bind(null, state),
    handleTodoPanelCollapsedChanged: handleTodoPanelCollapsedChanged.bind(null, state),
    canDragTodoDraft: canDragTodoDraft.bind(null, state), shouldShowTodoDragHandle: shouldShowTodoDragHandle.bind(null, state),
    handleTodoDragStart: handleTodoDragStart.bind(null, state), handleTodoDragEnter: handleTodoDragEnter.bind(null, state),
    handleTodoDragOver: handleTodoDragOver.bind(null, state), handleTodoDragEnd: handleTodoDragEnd.bind(null, state),
    handleTodoDrop: handleTodoDrop.bind(null, state), handleTodoTextareaInput: handleTodoTextareaInput.bind(null, state),
    handleTodoTextareaKeydown: handleTodoTextareaKeydown.bind(null, state), handleTodoTextareaBlur: handleTodoTextareaBlur.bind(null, state),
    loadTodoEntriesForProject: loadTodoEntriesForProject.bind(null, state),
    getTodoEntry: getTodoEntry.bind(null, state), removeTodoEntry: removeTodoEntry.bind(null, state),
    resetTodoRuntimeState: resetTodoRuntimeState.bind(null, state),
    resizeTodoTextareas
  };
}
