import { app, screen } from "electron";
import { dirname, join } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const WINDOW_STATE_FILENAME = "window-state.json";
const DEFAULT_WINDOW_WIDTH = 1280;
const DEFAULT_WINDOW_HEIGHT = 800;

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toValidCoordinate(value) {
  return Number.isFinite(value) ? Math.round(value) : null;
}

function toValidSize(value) {
  const parsed = toValidCoordinate(value);
  if (parsed === null || parsed <= 0) {
    return null;
  }

  return parsed;
}

function clampWindowBoundsToWorkArea(bounds, workArea) {
  const maxWidth = Math.max(1, workArea.width);
  const maxHeight = Math.max(1, workArea.height);
  const width = Math.min(Math.max(1, bounds.width), maxWidth);
  const height = Math.min(Math.max(1, bounds.height), maxHeight);
  const maxX = Math.max(workArea.x, workArea.x + workArea.width - width);
  const maxY = Math.max(workArea.y, workArea.y + workArea.height - height);
  const x = Math.min(Math.max(bounds.x, workArea.x), maxX);
  const y = Math.min(Math.max(bounds.y, workArea.y), maxY);
  return { x, y, width, height };
}

function getWindowStateFilePath() {
  return join(app.getPath("userData"), WINDOW_STATE_FILENAME);
}

function getDefaultWindowBounds() {
  const workArea = screen.getPrimaryDisplay().workArea;
  const width = Math.min(DEFAULT_WINDOW_WIDTH, Math.max(1, workArea.width));
  const height = Math.min(DEFAULT_WINDOW_HEIGHT, Math.max(1, workArea.height));
  const x = workArea.x + Math.floor((workArea.width - width) / 2);
  const y = workArea.y + Math.floor((workArea.height - height) / 2);
  return { x, y, width, height };
}

function parseWindowState(value) {
  if (!isRecord(value)) {
    return null;
  }

  const x = toValidCoordinate(value.x);
  const y = toValidCoordinate(value.y);
  const width = toValidSize(value.width);
  const height = toValidSize(value.height);
  if (x === null || y === null || width === null || height === null) {
    return null;
  }

  const displayId = Number.isInteger(value.displayId) ? value.displayId : null;
  const isMaximized = value.isMaximized === true;
  return { x, y, width, height, displayId, isMaximized };
}

function loadWindowState() {
  try {
    const content = readFileSync(getWindowStateFilePath(), "utf-8");
    return parseWindowState(JSON.parse(content));
  } catch {
    return null;
  }
}

function resolveWindowDisplay(savedState, bounds) {
  if (savedState?.displayId !== null) {
    const matchedDisplay = screen
      .getAllDisplays()
      .find((display) => display.id === savedState.displayId);
    if (matchedDisplay) {
      return matchedDisplay;
    }
  }

  return screen.getDisplayMatching(bounds);
}

function buildWindowStateSnapshot(win) {
  const isMaximized = win.isMaximized();
  const sourceBounds = isMaximized ? win.getNormalBounds() : win.getBounds();
  const display = screen.getDisplayMatching(sourceBounds);
  const bounds = clampWindowBoundsToWorkArea(sourceBounds, display.workArea);
  return {
    ...bounds,
    displayId: display.id,
    isMaximized
  };
}

function saveWindowState(snapshot) {
  try {
    const filePath = getWindowStateFilePath();
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(snapshot, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to save window state.", error);
  }
}

function persistWindowState(win) {
  if (win.isDestroyed()) {
    return;
  }

  saveWindowState(buildWindowStateSnapshot(win));
}

export function getInitialWindowState() {
  const defaultBounds = getDefaultWindowBounds();
  const savedState = loadWindowState();
  if (!savedState) {
    const defaultDisplay = screen.getDisplayMatching(defaultBounds);
    return {
      bounds: clampWindowBoundsToWorkArea(defaultBounds, defaultDisplay.workArea),
      isMaximized: false
    };
  }

  const requestedBounds = {
    x: savedState.x,
    y: savedState.y,
    width: savedState.width,
    height: savedState.height
  };
  const display = resolveWindowDisplay(savedState, requestedBounds);
  return {
    bounds: clampWindowBoundsToWorkArea(requestedBounds, display.workArea),
    isMaximized: savedState.isMaximized
  };
}

export function attachWindowStatePersistence(win, debounceMs) {
  let saveWindowStateTimer = null;
  const scheduleWindowStateSave = () => {
    if (saveWindowStateTimer) {
      clearTimeout(saveWindowStateTimer);
    }

    saveWindowStateTimer = setTimeout(() => {
      saveWindowStateTimer = null;
      persistWindowState(win);
    }, debounceMs);
  };

  win.on("move", scheduleWindowStateSave);
  win.on("resize", scheduleWindowStateSave);
  win.on("maximize", scheduleWindowStateSave);
  win.on("unmaximize", scheduleWindowStateSave);
  win.on("close", () => {
    if (saveWindowStateTimer) {
      clearTimeout(saveWindowStateTimer);
      saveWindowStateTimer = null;
    }

    persistWindowState(win);
  });
}
