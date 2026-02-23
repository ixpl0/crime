import {
  isRecord,
  loadJsonProjectSetting,
  saveJsonProjectSetting
} from "./settings-storage-helpers";

export const TERMINAL_INPUT_HISTORY_FILENAME = "terminal-input-history.json";

interface TerminalInputHistoryPayload {
  version: 1;
  entries: string[];
}

const toHistoryEntries = (value: unknown, limit: number): string[] => {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === "string")
      .slice(-limit);
  }

  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.entries)) {
    return [];
  }

  return value.entries
    .filter((entry): entry is string => typeof entry === "string")
    .slice(-limit);
};

export const loadTerminalInputHistory = async (
  projectPath: string,
  limit: number
): Promise<string[]> => {
  return loadJsonProjectSetting(
    projectPath,
    TERMINAL_INPUT_HISTORY_FILENAME,
    (value) => toHistoryEntries(value, limit),
    []
  );
};

export const saveTerminalInputHistory = async (
  projectPath: string,
  entries: string[],
  limit: number
): Promise<void> => {
  const payload: TerminalInputHistoryPayload = {
    version: 1,
    entries: entries.slice(-limit)
  };

  await saveJsonProjectSetting(
    projectPath,
    TERMINAL_INPUT_HISTORY_FILENAME,
    payload,
    "terminal input history"
  );
};
