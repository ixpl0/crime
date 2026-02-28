import {
  IDE_ZOOM_FACTOR_MAX,
  IDE_ZOOM_FACTOR_MIN,
  TERMINAL_FONT_SIZE_MAX,
  TERMINAL_FONT_SIZE_MIN,
  TERMINAL_PANEL_MIN_HEIGHT
} from "../settings/project-settings-storage";
import { type ProjectSettings } from "../types/project-settings";

const TERMINAL_PANEL_MAX_VIEWPORT_RATIO = 0.85;

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function normalizeIdeZoomFactor(value: number) {
  const clampedValue = clampNumber(value, IDE_ZOOM_FACTOR_MIN, IDE_ZOOM_FACTOR_MAX);
  return Math.round(clampedValue * 100) / 100;
}

export function normalizeTerminalFontSize(value: number) {
  return Math.round(clampNumber(value, TERMINAL_FONT_SIZE_MIN, TERMINAL_FONT_SIZE_MAX));
}

export function normalizeProjectZoomSettings(
  zoom: ProjectSettings["zoom"]
): ProjectSettings["zoom"] {
  return {
    ideZoomFactor: normalizeIdeZoomFactor(zoom.ideZoomFactor),
    terminalFontSize: normalizeTerminalFontSize(zoom.terminalFontSize)
  };
}

export function normalizeTerminalPanelHeight(value: number) {
  const maxHeight = Math.max(
    TERMINAL_PANEL_MIN_HEIGHT,
    Math.floor(window.innerHeight * TERMINAL_PANEL_MAX_VIEWPORT_RATIO)
  );
  return Math.round(Math.min(Math.max(value, TERMINAL_PANEL_MIN_HEIGHT), maxHeight));
}

export function isTerminalZoomResetShortcut(event: KeyboardEvent) {
  if (event.metaKey || event.altKey || event.shiftKey || !event.ctrlKey) {
    return false;
  }

  return event.code === "Digit0" || event.code === "Numpad0";
}
