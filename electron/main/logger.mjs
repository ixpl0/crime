import { app } from "electron";
import { dirname, join } from "node:path";
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";

const LOG_FILENAME = "app.log";

let logFilePath = null;

function getLogFilePath() {
  return join(app.getPath("userData"), LOG_FILENAME);
}

function formatTimestamp() {
  return new Date().toISOString();
}

function formatLogEntry(level, message, detail) {
  const timestamp = formatTimestamp();
  const base = `[${timestamp}] [${level}] ${message}`;
  if (detail === undefined) {
    return base;
  }

  if (detail instanceof Error) {
    return `${base}\n  ${detail.stack ?? detail.message}`;
  }

  return `${base}\n  ${String(detail)}`;
}

function ensureLogFile() {
  if (logFilePath) {
    return;
  }

  logFilePath = getLogFilePath();
  mkdirSync(dirname(logFilePath), { recursive: true });
  writeFileSync(logFilePath, "", "utf-8");
}

function writeLog(level, message, detail) {
  try {
    ensureLogFile();
    const entry = formatLogEntry(level, message, detail);
    appendFileSync(logFilePath, entry + "\n", "utf-8");
  } catch {
    // Logging must never crash the app
  }
}

export const logger = {
  info: (message, detail) => writeLog("INFO", message, detail),
  warn: (message, detail) => writeLog("WARN", message, detail),
  error: (message, detail) => writeLog("ERROR", message, detail),
  getFilePath: () => {
    ensureLogFile();
    return logFilePath;
  }
};
