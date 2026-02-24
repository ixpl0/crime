import {
  loadJsonProjectSetting,
  parseVersionedStringEntries,
  saveJsonProjectSetting,
  toVersionedStringEntriesPayload
} from "./settings-storage-helpers";

export const TODO_FILENAME = "todo.json";

export const loadTodoEntries = async (projectPath: string): Promise<string[]> => {
  return loadJsonProjectSetting(projectPath, TODO_FILENAME, parseVersionedStringEntries, [], {
    settingLabel: "todo prompts",
    persistFallbackValue: toVersionedStringEntriesPayload([])
  });
};

export const saveTodoEntries = async (projectPath: string, entries: string[]): Promise<void> => {
  await saveJsonProjectSetting(
    projectPath,
    TODO_FILENAME,
    toVersionedStringEntriesPayload(entries),
    "todo prompts"
  );
};
