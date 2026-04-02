import {
  IDE_ZOOM_FACTOR_MAX,
  IDE_ZOOM_FACTOR_MIN,
  TERMINAL_FONT_SIZE_MAX,
  TERMINAL_FONT_SIZE_MIN
} from "../settings/project-settings-storage";
import { type ProjectSettings } from "../types/project-settings";

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

export function isTerminalZoomResetShortcut(event: KeyboardEvent) {
  if (event.metaKey || event.altKey || event.shiftKey || !event.ctrlKey) {
    return false;
  }

  return event.code === "Digit0" || event.code === "Numpad0";
}
