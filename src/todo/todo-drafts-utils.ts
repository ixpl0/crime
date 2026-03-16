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

const DEFAULT_TEXTAREA_DATA_ATTRIBUTE = "todo-textarea";

export function resizeTodoTextareas(dataAttribute: string = DEFAULT_TEXTAREA_DATA_ATTRIBUTE) {
  const textareas = document.querySelectorAll<HTMLTextAreaElement>(
    `textarea[data-${dataAttribute}="true"]`
  );
  for (const textarea of textareas) {
    textarea.style.removeProperty("height");
  }
}

export function getFocusedTodoSnapshot(dataAttribute: string = DEFAULT_TEXTAREA_DATA_ATTRIBUTE) {
  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLTextAreaElement)) {
    return null;
  }

  if (activeElement.getAttribute(`data-${dataAttribute}`) !== "true") {
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

export function restoreTodoFocus(snapshot: TodoFocusSnapshot | null, dataAttribute: string = DEFAULT_TEXTAREA_DATA_ATTRIBUTE) {
  if (!snapshot) {
    return;
  }

  const selector = `textarea[data-${dataAttribute}="true"][data-todo-index="${String(snapshot.index)}"]`;
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

function focusTodoTextareaByIndex(index: number, dataAttribute: string = DEFAULT_TEXTAREA_DATA_ATTRIBUTE) {
  const selector = `textarea[data-${dataAttribute}="true"][data-todo-index="${String(index)}"]`;
  const textarea = document.querySelector<HTMLTextAreaElement>(selector);
  if (!textarea) {
    return;
  }

  textarea.focus();
  const cursorPosition = textarea.value.length;
  textarea.setSelectionRange(cursorPosition, cursorPosition);
}

export function focusTodoComposerTextarea(totalDraftsCount: number, dataAttribute: string = DEFAULT_TEXTAREA_DATA_ATTRIBUTE) {
  const composerIndex = totalDraftsCount - 1;
  if (composerIndex < 0) {
    return;
  }

  focusTodoTextareaByIndex(composerIndex, dataAttribute);
}
