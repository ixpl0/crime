export interface NormalizeTodoDraftsOptions {
  includePlaceholder?: boolean;
}

export interface TodoFocusSnapshot {
  index: number;
  selectionStart: number;
  selectionEnd: number;
  scrollTop: number;
}

export function getNormalizedTodoDrafts(
  entries: string[],
  options: NormalizeTodoDraftsOptions = {}
) {
  const includePlaceholder = options.includePlaceholder ?? true;
  const nonEmptyEntries = entries.filter((entry) => entry.trim().length > 0);
  if (nonEmptyEntries.length === 0) {
    return [""];
  }

  return includePlaceholder ? [...nonEmptyEntries, ""] : nonEmptyEntries;
}

export function hasTodoDraftPlaceholder(entries: string[]) {
  return entries.some((entry) => entry.trim().length === 0);
}

export function getPersistedTodoEntries(entries: string[]) {
  return entries.filter((entry) => entry.trim().length > 0);
}

export function resizeTodoTextareas() {
  const textareas = document.querySelectorAll<HTMLTextAreaElement>(
    'textarea[data-todo-textarea="true"]'
  );
  for (const textarea of textareas) {
    textarea.style.removeProperty("height");
  }
}

export function getFocusedTodoSnapshot() {
  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLTextAreaElement)) {
    return null;
  }

  if (activeElement.dataset.todoTextarea !== "true") {
    return null;
  }

  const index = Number.parseInt(activeElement.dataset.todoIndex ?? "", 10);
  if (!Number.isInteger(index) || index < 0) {
    return null;
  }

  return {
    index,
    selectionStart: activeElement.selectionStart,
    selectionEnd: activeElement.selectionEnd,
    scrollTop: activeElement.scrollTop
  } satisfies TodoFocusSnapshot;
}

export function restoreTodoFocus(snapshot: TodoFocusSnapshot | null) {
  if (!snapshot) {
    return;
  }

  const selector = `textarea[data-todo-textarea="true"][data-todo-index="${String(snapshot.index)}"]`;
  const textarea = document.querySelector<HTMLTextAreaElement>(selector);
  if (!textarea) {
    return;
  }

  textarea.focus();
  const maxSelectionIndex = textarea.value.length;
  const selectionStart = Math.min(snapshot.selectionStart, maxSelectionIndex);
  const selectionEnd = Math.min(snapshot.selectionEnd, maxSelectionIndex);
  textarea.setSelectionRange(selectionStart, selectionEnd);
  textarea.scrollTop = snapshot.scrollTop;
}

function focusTodoTextareaByIndex(index: number) {
  const selector = `textarea[data-todo-textarea="true"][data-todo-index="${String(index)}"]`;
  const textarea = document.querySelector<HTMLTextAreaElement>(selector);
  if (!textarea) {
    return;
  }

  textarea.focus();
  const cursorPosition = textarea.value.length;
  textarea.setSelectionRange(cursorPosition, cursorPosition);
}

export function focusTodoComposerTextarea(totalDraftsCount: number) {
  const composerIndex = totalDraftsCount - 1;
  if (composerIndex < 0) {
    return;
  }

  focusTodoTextareaByIndex(composerIndex);
}
