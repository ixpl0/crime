import { ref, type Ref } from "vue";
import { DEFAULT_IDE_ZOOM_FACTOR, DEFAULT_TERMINAL_FONT_SIZE, DEFAULT_TERMINAL_PANEL_HEIGHT, IDE_ZOOM_FACTOR_STEP, TERMINAL_FONT_SIZE_STEP } from "../settings/project-settings-storage";
import { type ProjectSettings } from "../types/project-settings";
import { isTerminalZoomResetShortcut, normalizeIdeZoomFactor, normalizeProjectZoomSettings, normalizeTerminalPanelHeight } from "./project-layout-utils";
type UseProjectLayoutOptions = {
  projectPath: Ref<string | null>;
  projectSettings: Ref<ProjectSettings>;
  terminalContainer: Ref<HTMLElement | null>;
  resizeTodoTextareas: () => void;
  resizeTerminalInputTextareaElement: () => void;
  resizeTerminalBackend: () => void | Promise<void>;
  syncTerminalFontSize: (fontSize: number) => boolean;
  persistProjectSettings: (settings: ProjectSettings) => void;
  reportUiError: (context: string, error: unknown, fallbackMessage: string) => void;
};
type ProjectLayoutState = {
  options: UseProjectLayoutOptions;
  terminalPanelHeight: Ref<number>;
  isTerminalPanelResizeActive: Ref<boolean>;
  removeWindowResizeListener: (() => void) | null;
  removeWindowWheelListener: (() => void) | null;
  removeWindowKeydownListener: (() => void) | null;
  removeWindowTerminalPanelResizeListeners: (() => void) | null;
  pendingZoomResizeAnimationFrame: number | null;
  pendingTerminalPanelResizeAnimationFrame: number | null;
  terminalPanelResizeStartY: number;
  terminalPanelResizeStartHeight: number;
};
function createProjectLayoutState(options: UseProjectLayoutOptions): ProjectLayoutState {
  return {
    options,
    terminalPanelHeight: ref(normalizeTerminalPanelHeight(DEFAULT_TERMINAL_PANEL_HEIGHT)),
    isTerminalPanelResizeActive: ref(false),
    removeWindowResizeListener: null,
    removeWindowWheelListener: null,
    removeWindowKeydownListener: null,
    removeWindowTerminalPanelResizeListeners: null,
    pendingZoomResizeAnimationFrame: null,
    pendingTerminalPanelResizeAnimationFrame: null,
    terminalPanelResizeStartY: 0,
    terminalPanelResizeStartHeight: 0
  };
}
function persistTerminalPanelHeight(state: ProjectLayoutState, value: number) {
  if (!state.options.projectPath.value) {
    return;
  }
  const updatedSettings: ProjectSettings = {
    ...state.options.projectSettings.value,
    terminal: {
      ...state.options.projectSettings.value.terminal,
      panelHeight: normalizeTerminalPanelHeight(value)
    }
  };
  state.options.projectSettings.value = updatedSettings;
  state.options.persistProjectSettings(updatedSettings);
}
function scheduleTerminalResizeForPanelHeight(state: ProjectLayoutState) {
  if (state.pendingTerminalPanelResizeAnimationFrame !== null) {
    return;
  }
  state.pendingTerminalPanelResizeAnimationFrame = window.requestAnimationFrame(() => {
    state.pendingTerminalPanelResizeAnimationFrame = null;
    void state.options.resizeTerminalBackend();
  });
}
function clearTerminalPanelResizeListeners(state: ProjectLayoutState) {
  state.removeWindowTerminalPanelResizeListeners?.();
  state.removeWindowTerminalPanelResizeListeners = null;
}
function stopTerminalPanelResize(state: ProjectLayoutState) {
  clearTerminalPanelResizeListeners(state);
  if (!state.isTerminalPanelResizeActive.value) {
    return;
  }
  state.isTerminalPanelResizeActive.value = false;
  document.body.style.removeProperty("cursor");
  document.body.style.removeProperty("user-select");
  persistTerminalPanelHeight(state, state.terminalPanelHeight.value);
}
function handleTerminalPanelResizePointerMove(state: ProjectLayoutState, event: PointerEvent) {
  if (!state.isTerminalPanelResizeActive.value) {
    return;
  }
  event.preventDefault();
  const deltaY = event.clientY - state.terminalPanelResizeStartY;
  const nextHeight = normalizeTerminalPanelHeight(state.terminalPanelResizeStartHeight + deltaY);
  if (nextHeight === state.terminalPanelHeight.value) {
    return;
  }
  state.terminalPanelHeight.value = nextHeight;
  scheduleTerminalResizeForPanelHeight(state);
}
function bindTerminalPanelResizeListeners(state: ProjectLayoutState) {
  const handlePointerMove = (event: PointerEvent) => {
    handleTerminalPanelResizePointerMove(state, event);
  };
  const handlePointerUp = () => {
    stopTerminalPanelResize(state);
  };
  window.addEventListener("pointermove", handlePointerMove, { passive: false });
  window.addEventListener("pointerup", handlePointerUp, true);
  window.addEventListener("pointercancel", handlePointerUp, true);
  state.removeWindowTerminalPanelResizeListeners = () => {
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp, true);
    window.removeEventListener("pointercancel", handlePointerUp, true);
  };
}
function handleTerminalPanelResizePointerDown(state: ProjectLayoutState, event: PointerEvent) {
  if (event.button !== 0) {
    return;
  }
  event.preventDefault();
  stopTerminalPanelResize(state);
  state.terminalPanelResizeStartY = event.clientY;
  state.terminalPanelResizeStartHeight = state.terminalPanelHeight.value;
  state.isTerminalPanelResizeActive.value = true;
  document.body.style.cursor = "ns-resize";
  document.body.style.userSelect = "none";
  bindTerminalPanelResizeListeners(state);
}
function scheduleTerminalResizeAfterZoom(state: ProjectLayoutState) {
  if (state.pendingZoomResizeAnimationFrame !== null) {
    window.cancelAnimationFrame(state.pendingZoomResizeAnimationFrame);
  }
  state.pendingZoomResizeAnimationFrame = window.requestAnimationFrame(() => {
    state.pendingZoomResizeAnimationFrame = null;
    void state.options.resizeTerminalBackend();
    window.requestAnimationFrame(() => {
      void state.options.resizeTerminalBackend();
    });
  });
}
function isWheelEventInsideTerminal(state: ProjectLayoutState, event: WheelEvent) {
  const container = state.options.terminalContainer.value;
  const target = event.target;
  if (!container || !(target instanceof Node)) {
    return false;
  }
  return container.contains(target);
}
function isTerminalHoveredOrFocused(state: ProjectLayoutState) {
  const container = state.options.terminalContainer.value;
  if (!container) {
    return false;
  }
  if (container.matches(":hover")) {
    return true;
  }
  const activeElement = document.activeElement;
  return activeElement instanceof Node && container.contains(activeElement);
}
function applyProjectZoomSettings(state: ProjectLayoutState, settings: ProjectSettings) {
  const normalizedZoom = normalizeProjectZoomSettings(settings.zoom);
  const didSetIdeZoom = window.projectApi.zoom.setFactor(normalizedZoom.ideZoomFactor);
  const didUpdateTerminalFontSize = state.options.syncTerminalFontSize(
    normalizedZoom.terminalFontSize
  );
  if (!didSetIdeZoom) {
    state.options.reportUiError("Zoom", null, "Failed to apply IDE zoom factor.");
  }
  if (didSetIdeZoom || didUpdateTerminalFontSize) {
    scheduleTerminalResizeAfterZoom(state);
  }
}
function applyProjectTerminalSettings(state: ProjectLayoutState, settings: ProjectSettings) {
  const nextHeight = normalizeTerminalPanelHeight(settings.terminal.panelHeight);
  if (nextHeight === state.terminalPanelHeight.value) {
    return;
  }
  state.terminalPanelHeight.value = nextHeight;
  scheduleTerminalResizeForPanelHeight(state);
}
function applyProjectSettings(state: ProjectLayoutState, settings: ProjectSettings) {
  applyProjectZoomSettings(state, settings);
  applyProjectTerminalSettings(state, settings);
}
function updateProjectZoomSettings(
  state: ProjectLayoutState,
  nextZoom: Partial<ProjectSettings["zoom"]>
) {
  const currentSettings = state.options.projectSettings.value;
  const nextNormalizedZoom = normalizeProjectZoomSettings({
    ...currentSettings.zoom,
    ...nextZoom
  });
  if (
    nextNormalizedZoom.ideZoomFactor === currentSettings.zoom.ideZoomFactor &&
    nextNormalizedZoom.terminalFontSize === currentSettings.zoom.terminalFontSize
  ) {
    return;
  }
  const updatedSettings: ProjectSettings = { ...currentSettings, zoom: nextNormalizedZoom };
  state.options.projectSettings.value = updatedSettings;
  applyProjectZoomSettings(state, updatedSettings);
  state.options.persistProjectSettings(updatedSettings);
}
function handleBrowserZoomKeyboardShortcut(state: ProjectLayoutState, event: KeyboardEvent) {
  if (!isTerminalZoomResetShortcut(event)) {
    return;
  }
  event.preventDefault();
  if (isTerminalHoveredOrFocused(state)) {
    updateProjectZoomSettings(state, { terminalFontSize: DEFAULT_TERMINAL_FONT_SIZE });
    return;
  }
  updateProjectZoomSettings(state, { ideZoomFactor: DEFAULT_IDE_ZOOM_FACTOR });
}
function handleBrowserZoomCtrlWheel(state: ProjectLayoutState, event: WheelEvent) {
  if (!event.ctrlKey || event.metaKey || event.deltaY === 0) {
    return;
  }
  event.preventDefault();
  if (isWheelEventInsideTerminal(state, event)) {
    const delta = event.deltaY < 0 ? TERMINAL_FONT_SIZE_STEP : -TERMINAL_FONT_SIZE_STEP;
    updateProjectZoomSettings(state, {
      terminalFontSize: state.options.projectSettings.value.zoom.terminalFontSize + delta
    });
    return;
  }
  const ideZoomDelta = event.deltaY < 0 ? IDE_ZOOM_FACTOR_STEP : -IDE_ZOOM_FACTOR_STEP;
  const currentIdeZoomFactor = normalizeIdeZoomFactor(window.projectApi.zoom.getFactor());
  updateProjectZoomSettings(state, { ideZoomFactor: currentIdeZoomFactor + ideZoomDelta });
}
function handleWindowResize(state: ProjectLayoutState) {
  state.options.resizeTodoTextareas();
  state.options.resizeTerminalInputTextareaElement();
  const nextHeight = normalizeTerminalPanelHeight(state.terminalPanelHeight.value);
  if (nextHeight !== state.terminalPanelHeight.value) {
    state.terminalPanelHeight.value = nextHeight;
  }
  void state.options.resizeTerminalBackend();
}
function startProjectLayoutListeners(state: ProjectLayoutState) {
  stopProjectLayout(state);
  const handleResize = () => {
    handleWindowResize(state);
  };
  const handleWheel = (event: WheelEvent) => {
    handleBrowserZoomCtrlWheel(state, event);
  };
  const handleKeydown = (event: KeyboardEvent) => {
    handleBrowserZoomKeyboardShortcut(state, event);
  };
  window.addEventListener("resize", handleResize);
  window.addEventListener("wheel", handleWheel, { passive: false, capture: true });
  window.addEventListener("keydown", handleKeydown, true);
  state.removeWindowResizeListener = () => {
    window.removeEventListener("resize", handleResize);
  };
  state.removeWindowWheelListener = () => {
    window.removeEventListener("wheel", handleWheel, true);
  };
  state.removeWindowKeydownListener = () => {
    window.removeEventListener("keydown", handleKeydown, true);
  };
}
function stopProjectLayout(state: ProjectLayoutState) {
  state.removeWindowResizeListener?.();
  state.removeWindowWheelListener?.();
  state.removeWindowKeydownListener?.();
  state.removeWindowResizeListener = null;
  state.removeWindowWheelListener = null;
  state.removeWindowKeydownListener = null;
  stopTerminalPanelResize(state);
  if (state.pendingZoomResizeAnimationFrame !== null) {
    window.cancelAnimationFrame(state.pendingZoomResizeAnimationFrame);
    state.pendingZoomResizeAnimationFrame = null;
  }
  if (state.pendingTerminalPanelResizeAnimationFrame !== null) {
    window.cancelAnimationFrame(state.pendingTerminalPanelResizeAnimationFrame);
    state.pendingTerminalPanelResizeAnimationFrame = null;
  }
}
export function useProjectLayout(options: UseProjectLayoutOptions) {
  const state = createProjectLayoutState(options);
  return {
    terminalPanelHeight: state.terminalPanelHeight,
    isTerminalPanelResizeActive: state.isTerminalPanelResizeActive,
    applyProjectSettings: (settings: ProjectSettings) => {
      applyProjectSettings(state, settings);
    },
    handleTerminalPanelResizePointerDown: (event: PointerEvent) => {
      handleTerminalPanelResizePointerDown(state, event);
    },
    startProjectLayoutListeners: () => {
      startProjectLayoutListeners(state);
    },
    stopProjectLayout: () => {
      stopProjectLayout(state);
    }
  };
}
