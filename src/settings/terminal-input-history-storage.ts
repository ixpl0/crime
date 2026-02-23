export const TERMINAL_INPUT_HISTORY_FILENAME = "terminal-input-history.json";

interface TerminalInputHistoryPayload {
  version: 1;
  entries: string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

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
  try {
    const response = await window.projectApi.settings.read(
      projectPath,
      TERMINAL_INPUT_HISTORY_FILENAME
    );
    if (!response.ok || !response.content) {
      return [];
    }

    const parsed: unknown = JSON.parse(response.content);
    return toHistoryEntries(parsed, limit);
  } catch {
    return [];
  }
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

  try {
    const content = JSON.stringify(payload, null, 2);
    const response = await window.projectApi.settings.write(
      projectPath,
      TERMINAL_INPUT_HISTORY_FILENAME,
      content
    );
    if (!response.ok) {
      console.error("Failed to save terminal input history:", response.error);
    }
  } catch (error) {
    console.error("Failed to save terminal input history.", error);
  }
};
