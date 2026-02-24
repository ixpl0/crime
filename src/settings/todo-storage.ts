import {
  isRecord,
  loadJsonProjectSetting,
  saveJsonProjectSetting
} from "./settings-storage-helpers";

export const TODO_FILENAME = "todo.json";

interface TodoPayload {
  version: 1;
  entries: string[];
}

const parseTodoEntries = (value: unknown): string[] | null => {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }

  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.entries)) {
    return null;
  }

  return value.entries.filter((entry): entry is string => typeof entry === "string");
};

export const loadTodoEntries = async (projectPath: string): Promise<string[]> => {
  return loadJsonProjectSetting(projectPath, TODO_FILENAME, parseTodoEntries, [], {
    settingLabel: "todo prompts",
    persistFallbackValue: {
      version: 1,
      entries: []
    } satisfies TodoPayload
  });
};

export const saveTodoEntries = async (projectPath: string, entries: string[]): Promise<void> => {
  const payload: TodoPayload = {
    version: 1,
    entries
  };

  await saveJsonProjectSetting(projectPath, TODO_FILENAME, payload, "todo prompts");
};
