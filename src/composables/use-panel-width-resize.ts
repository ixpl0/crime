import { ref, type Ref } from "vue";

const DEFAULT_MIN_PANEL_WIDTH = 160;
const HANDLE_WIDTH = 16;

interface UsePanelWidthResizeOptions {
  storageKey: string;
  defaultWidth: number;
  minWidth?: number;
  minOppositeWidth?: number;
}

interface PanelWidthResizeState {
  options: UsePanelWidthResizeOptions;
  panelWidth: Ref<number>;
  isResizeActive: Ref<boolean>;
  startX: number;
  startWidth: number;
  containerWidth: number;
  removeListeners: (() => void) | null;
}

function getMinWidth(options: UsePanelWidthResizeOptions): number {
  return options.minWidth ?? DEFAULT_MIN_PANEL_WIDTH;
}

function getMinOppositeWidth(options: UsePanelWidthResizeOptions): number {
  return options.minOppositeWidth ?? DEFAULT_MIN_PANEL_WIDTH;
}

function computePanelMaxWidth(options: UsePanelWidthResizeOptions): string {
  const reserved = HANDLE_WIDTH + getMinOppositeWidth(options);
  return `calc(100% - ${String(reserved)}px)`;
}

function parseStoredWidth(storageKey: string, defaultWidth: number, minWidth: number): number {
  const stored = localStorage.getItem(storageKey);
  if (stored === null) {
    return defaultWidth;
  }
  const parsed = Number(stored);
  return isFinite(parsed) && parsed >= minWidth ? parsed : defaultWidth;
}

function clampWidth(width: number, containerWidth: number, options: UsePanelWidthResizeOptions): number {
  const minWidth = getMinWidth(options);
  const maxWidth = containerWidth - HANDLE_WIDTH - getMinOppositeWidth(options);
  return Math.max(minWidth, Math.min(width, maxWidth));
}

function createState(options: UsePanelWidthResizeOptions): PanelWidthResizeState {
  const minWidth = getMinWidth(options);
  return {
    options,
    panelWidth: ref(parseStoredWidth(options.storageKey, options.defaultWidth, minWidth)),
    isResizeActive: ref(false),
    startX: 0,
    startWidth: 0,
    containerWidth: 0,
    removeListeners: null
  };
}

function stopResize(state: PanelWidthResizeState) {
  state.removeListeners?.();
  state.removeListeners = null;
  if (!state.isResizeActive.value) {
    return;
  }
  state.isResizeActive.value = false;
  document.body.style.removeProperty("cursor");
  document.body.style.removeProperty("user-select");
  localStorage.setItem(state.options.storageKey, String(Math.round(state.panelWidth.value)));
}

function handlePointerMove(state: PanelWidthResizeState, event: PointerEvent) {
  if (!state.isResizeActive.value) {
    return;
  }
  event.preventDefault();
  const deltaX = event.clientX - state.startX;
  const nextWidth = clampWidth(state.startWidth + deltaX, state.containerWidth, state.options);
  if (nextWidth === state.panelWidth.value) {
    return;
  }
  state.panelWidth.value = nextWidth;
}

function bindResizeListeners(state: PanelWidthResizeState) {
  const handleMove = (event: PointerEvent) => {
    handlePointerMove(state, event);
  };
  const handleUp = () => {
    stopResize(state);
  };
  window.addEventListener("pointermove", handleMove, { passive: false });
  window.addEventListener("pointerup", handleUp, true);
  window.addEventListener("pointercancel", handleUp, true);
  state.removeListeners = () => {
    window.removeEventListener("pointermove", handleMove);
    window.removeEventListener("pointerup", handleUp, true);
    window.removeEventListener("pointercancel", handleUp, true);
  };
}

function syncPanelWidthFromDom(state: PanelWidthResizeState, handle: HTMLElement) {
  const leftPanel = handle.previousElementSibling;
  if (leftPanel instanceof HTMLElement) {
    state.panelWidth.value = Math.round(leftPanel.getBoundingClientRect().width);
  }
}

function handleResizePointerDown(
  state: PanelWidthResizeState,
  event: PointerEvent,
  container: HTMLElement
) {
  if (event.button !== 0) {
    return;
  }
  event.preventDefault();
  stopResize(state);
  syncPanelWidthFromDom(state, event.currentTarget as HTMLElement);
  state.startX = event.clientX;
  state.startWidth = state.panelWidth.value;
  state.containerWidth = container.clientWidth;
  state.isResizeActive.value = true;
  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";
  bindResizeListeners(state);
}

export function usePanelWidthResize(options: UsePanelWidthResizeOptions) {
  const state = createState(options);
  return {
    panelWidth: state.panelWidth,
    panelMaxWidth: computePanelMaxWidth(options),
    isResizeActive: state.isResizeActive,
    handleResizePointerDown: (event: PointerEvent, container: HTMLElement) => {
      handleResizePointerDown(state, event, container);
    }
  };
}
