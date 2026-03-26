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
  const actualBounds = win.getBounds();
  const normalBounds = isMaximized ? win.getNormalBounds() : actualBounds;
  // Always use actual bounds for display detection — getNormalBounds() can
  // return stale coordinates on Windows, pointing to a wrong monitor.
  const display = screen.getDisplayMatching(actualBounds);
  const bounds = clampWindowBoundsToWorkArea(normalBounds, display.workArea);
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
  if (win.isDestroyed() || win.isMinimized()) {
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
  let lastGoodSnapshot = null;

  const captureSnapshot = () => {
    if (win.isDestroyed() || win.isMinimized()) {
      return;
    }

    const bounds = win.getBounds();
    // On Windows, minimizing moves the window to extreme coordinates
    // (e.g., x ≈ -32000) before isMinimized() returns true.
    if (bounds.x <= -10000 || bounds.y <= -10000) {
      return;
    }

    lastGoodSnapshot = buildWindowStateSnapshot(win);
  };

  const scheduleWindowStateSave = () => {
    captureSnapshot();

    if (saveWindowStateTimer) {
      clearTimeout(saveWindowStateTimer);
    }

    saveWindowStateTimer = setTimeout(() => {
      saveWindowStateTimer = null;
      persistWindowState(win);
    }, debounceMs);
  };

  captureSnapshot();

  win.on("move", scheduleWindowStateSave);
  win.on("resize", scheduleWindowStateSave);
  win.on("maximize", scheduleWindowStateSave);
  win.on("unmaximize", scheduleWindowStateSave);

  win.on("restore", () => {
    if (win.isDestroyed() || !lastGoodSnapshot) {
      return;
    }

    const restoredDisplay = screen.getDisplayMatching(win.getBounds());
    if (restoredDisplay.id !== lastGoodSnapshot.displayId) {
      const targetDisplay = screen
        .getAllDisplays()
        .find((d) => d.id === lastGoodSnapshot.displayId);
      if (targetDisplay) {
        const bounds = {
          x: lastGoodSnapshot.x,
          y: lastGoodSnapshot.y,
          width: lastGoodSnapshot.width,
          height: lastGoodSnapshot.height
        };
        win.setBounds(clampWindowBoundsToWorkArea(bounds, targetDisplay.workArea));
        if (lastGoodSnapshot.isMaximized) {
          win.maximize();
        }
      }
    }
  });

  win.on("close", () => {
    if (saveWindowStateTimer) {
      clearTimeout(saveWindowStateTimer);
      saveWindowStateTimer = null;
    }

    if (win.isMinimized() && lastGoodSnapshot) {
      saveWindowState(lastGoodSnapshot);
    } else {
      persistWindowState(win);
    }
  });
}
