import { onBeforeUnmount, onMounted, type Ref } from "vue";

interface UseGitGraphNavigationOptions {
  isActive: Ref<boolean | undefined>;
  rowsLength: Ref<number>;
  selectedRowIndex: Ref<number | null>;
  scrollContainer: Ref<HTMLElement | null>;
  rowHeight: number;
  selectCommit: (rowIndex: number) => Promise<void> | void;
}

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
    return true;
  }
  if (target.isContentEditable) {
    return true;
  }
  if (target.closest(".cm-editor")) {
    return true;
  }
  return false;
};

const shouldHandleArrowKey = (event: KeyboardEvent): boolean => {
  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
    return false;
  }
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
    return false;
  }
  return !isEditableTarget(event.target);
};

const computeNextIndex = (
  currentIndex: number | null,
  total: number,
  direction: "up" | "down"
): number => {
  if (currentIndex === null) {
    return direction === "down" ? 0 : total - 1;
  }
  const step = direction === "down" ? 1 : -1;
  return Math.min(Math.max(currentIndex + step, 0), total - 1);
};

const ensureRowVisible = (container: HTMLElement, rowIndex: number, rowHeight: number) => {
  const top = rowIndex * rowHeight;
  const bottom = top + rowHeight;
  if (top < container.scrollTop) {
    container.scrollTop = top;
    return;
  }
  if (bottom > container.scrollTop + container.clientHeight) {
    container.scrollTop = bottom - container.clientHeight;
  }
};

export function useGitGraphNavigation(options: UseGitGraphNavigationOptions) {
  const handleKeydown = (event: KeyboardEvent) => {
    if (!options.isActive.value || !shouldHandleArrowKey(event)) {
      return;
    }
    const total = options.rowsLength.value;
    if (total === 0) {
      return;
    }
    event.preventDefault();
    const direction = event.key === "ArrowDown" ? "down" : "up";
    const nextIndex = computeNextIndex(options.selectedRowIndex.value, total, direction);
    if (nextIndex === options.selectedRowIndex.value) {
      return;
    }
    void options.selectCommit(nextIndex);
    const container = options.scrollContainer.value;
    if (container) {
      ensureRowVisible(container, nextIndex, options.rowHeight);
    }
  };

  onMounted(() => { window.addEventListener("keydown", handleKeydown); });
  onBeforeUnmount(() => { window.removeEventListener("keydown", handleKeydown); });
}

