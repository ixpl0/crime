import { ref, type Ref } from "vue";

const DEFAULT_MIN_PANEL_HEIGHT = 100;
const HANDLE_HEIGHT = 16;

interface UsePanelHeightResizeOptions {
  storageKey: string;
  defaultHeight: number;
  minHeight?: number;
  minOppositeHeight?: number;
}

interface PanelHeightResizeState {
  options: UsePanelHeightResizeOptions;
  panelHeight: Ref<number>;
  isResizeActive: Ref<boolean>;
  startY: number;
  startHeight: number;
  containerHeight: number;
  removeListeners: (() => void) | null;
}

function getMinHeight(options: UsePanelHeightResizeOptions): number {
  return options.minHeight ?? DEFAULT_MIN_PANEL_HEIGHT;
}

function getMinOppositeHeight(options: UsePanelHeightResizeOptions): number {
  return options.minOppositeHeight ?? DEFAULT_MIN_PANEL_HEIGHT;
}

function computePanelMaxHeight(options: UsePanelHeightResizeOptions): string {
  const reserved = HANDLE_HEIGHT + getMinOppositeHeight(options);
  return `calc(100% - ${String(reserved)}px)`;
}

function parseStoredHeight(storageKey: string, defaultHeight: number, minHeight: number): number {
  const stored = localStorage.getItem(storageKey);
  if (stored === null) {
    return defaultHeight;
  }
  const parsed = Number(stored);
  return isFinite(parsed) && parsed >= minHeight ? parsed : defaultHeight;
}

function clampHeight(height: number, containerHeight: number, options: UsePanelHeightResizeOptions): number {
  const minHeight = getMinHeight(options);
  const maxHeight = containerHeight - HANDLE_HEIGHT - getMinOppositeHeight(options);
  return Math.max(minHeight, Math.min(height, maxHeight));
}

function createState(options: UsePanelHeightResizeOptions): PanelHeightResizeState {
  const minHeight = getMinHeight(options);
  return {
    options,
    panelHeight: ref(parseStoredHeight(options.storageKey, options.defaultHeight, minHeight)),
    isResizeActive: ref(false),
    startY: 0,
    startHeight: 0,
    containerHeight: 0,
    removeListeners: null
  };
}

function stopResize(state: PanelHeightResizeState) {
  state.removeListeners?.();
  state.removeListeners = null;
  if (!state.isResizeActive.value) {
    return;
  }
  state.isResizeActive.value = false;
  document.body.style.removeProperty("cursor");
  document.body.style.removeProperty("user-select");
  localStorage.setItem(state.options.storageKey, String(Math.round(state.panelHeight.value)));
}

function handlePointerMove(state: PanelHeightResizeState, event: PointerEvent) {
  if (!state.isResizeActive.value) {
    return;
  }
  event.preventDefault();
  const deltaY = event.clientY - state.startY;
  // Moving handle down shrinks the bottom panel, moving up grows it
  const nextHeight = clampHeight(state.startHeight - deltaY, state.containerHeight, state.options);
  if (nextHeight === state.panelHeight.value) {
    return;
  }
  state.panelHeight.value = nextHeight;
}

function bindResizeListeners(state: PanelHeightResizeState) {
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

function handleResizePointerDown(
  state: PanelHeightResizeState,
  event: PointerEvent,
  container: HTMLElement
) {
  if (event.button !== 0) {
    return;
  }
  event.preventDefault();
  stopResize(state);
  state.startY = event.clientY;
  state.startHeight = state.panelHeight.value;
  state.containerHeight = container.clientHeight;
  state.isResizeActive.value = true;
  document.body.style.cursor = "row-resize";
  document.body.style.userSelect = "none";
  bindResizeListeners(state);
}

export function usePanelHeightResize(options: UsePanelHeightResizeOptions) {
  const state = createState(options);
  return {
    panelHeight: state.panelHeight,
    panelMaxHeight: computePanelMaxHeight(options),
    isResizeActive: state.isResizeActive,
    handleResizePointerDown: (event: PointerEvent, container: HTMLElement) => {
      handleResizePointerDown(state, event, container);
    }
  };
}
