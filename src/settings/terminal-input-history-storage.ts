import {
  loadJsonProjectSetting,
  parseVersionedStringEntries,
  saveJsonProjectSetting,
  toVersionedStringEntriesPayload
} from "./settings-storage-helpers";

export const TERMINAL_INPUT_HISTORY_FILENAME = "terminal-input-history.json";

export const loadTerminalInputHistory = async (
  projectPath: string,
  limit: number
): Promise<string[]> => {
  return loadJsonProjectSetting(
    projectPath,
    TERMINAL_INPUT_HISTORY_FILENAME,
    (value) => parseVersionedStringEntries(value, { limit }),
    [],
    {
      settingLabel: "terminal input history",
      persistFallbackValue: toVersionedStringEntriesPayload([], { limit })
    }
  );
};

export const saveTerminalInputHistory = async (
  projectPath: string,
  entries: string[],
  limit: number
): Promise<void> => {
  await saveJsonProjectSetting(
    projectPath,
    TERMINAL_INPUT_HISTORY_FILENAME,
    toVersionedStringEntriesPayload(entries, { limit }),
    "terminal input history"
  );
};
