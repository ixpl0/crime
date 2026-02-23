export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const loadJsonProjectSetting = async <T>(
  projectPath: string,
  filename: string,
  parser: (value: unknown) => T | null,
  fallbackValue: T
): Promise<T> => {
  try {
    const response = await window.projectApi.settings.read(projectPath, filename);
    if (!response.ok || !response.content) {
      return fallbackValue;
    }

    const parsed: unknown = JSON.parse(response.content);
    const parsedValue = parser(parsed);
    return parsedValue ?? fallbackValue;
  } catch {
    return fallbackValue;
  }
};

export const saveJsonProjectSetting = async (
  projectPath: string,
  filename: string,
  value: unknown,
  settingLabel: string
): Promise<void> => {
  try {
    const content = JSON.stringify(value, null, 2);
    const response = await window.projectApi.settings.write(projectPath, filename, content);
    if (!response.ok) {
      console.error(`Failed to save ${settingLabel}:`, response.error);
    }
  } catch (error) {
    console.error(`Failed to save ${settingLabel}.`, error);
  }
};
