import { type Ref } from "vue";
import { DEFAULT_IDE_ZOOM_FACTOR, DEFAULT_TERMINAL_FONT_SIZE, IDE_ZOOM_FACTOR_STEP, TERMINAL_FONT_SIZE_STEP } from "../settings/project-settings-storage";
import { type ProjectSettings } from "../types/project-settings";
import { isTerminalZoomResetShortcut, normalizeIdeZoomFactor, normalizeProjectZoomSettings } from "./project-layout-utils";
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
  removeWindowResizeListener: (() => void) | null;
  removeWindowWheelListener: (() => void) | null;
  removeWindowKeydownListener: (() => void) | null;
  pendingZoomResizeAnimationFrame: number | null;
};
function createProjectLayoutState(options: UseProjectLayoutOptions): ProjectLayoutState {
  return {
    options,
    removeWindowResizeListener: null,
    removeWindowWheelListener: null,
    removeWindowKeydownListener: null,
    pendingZoomResizeAnimationFrame: null
  };
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
    state.options.reportUiError("Zoom", null, "Не удалось применить масштаб IDE.");
  }
  if (didSetIdeZoom || didUpdateTerminalFontSize) {
    scheduleTerminalResizeAfterZoom(state);
  }
}
function applyProjectSettings(state: ProjectLayoutState, settings: ProjectSettings) {
  applyProjectZoomSettings(state, settings);
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
  if (state.pendingZoomResizeAnimationFrame !== null) {
    window.cancelAnimationFrame(state.pendingZoomResizeAnimationFrame);
    state.pendingZoomResizeAnimationFrame = null;
  }
}
export function useProjectLayout(options: UseProjectLayoutOptions) {
  const state = createProjectLayoutState(options);
  return {
    applyProjectSettings: (settings: ProjectSettings) => {
      applyProjectSettings(state, settings);
    },
    startProjectLayoutListeners: () => {
      startProjectLayoutListeners(state);
    },
    stopProjectLayout: () => {
      stopProjectLayout(state);
    }
  };
}
