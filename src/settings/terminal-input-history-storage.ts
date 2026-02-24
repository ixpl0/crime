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

const parseHistoryEntries = (value: unknown, limit: number): string[] | null => {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === "string")
      .slice(-limit);
  }

  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.entries)) {
    return null;
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
    (value) => parseHistoryEntries(value, limit),
    [],
    {
      settingLabel: "terminal input history",
      persistFallbackValue: {
        version: 1,
        entries: []
      } satisfies TerminalInputHistoryPayload
    }
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
