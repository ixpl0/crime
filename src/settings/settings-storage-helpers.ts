export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export interface VersionedStringEntriesPayload {
  readonly version: 1;
  readonly entries: readonly string[];
}

const normalizeStringEntries = (value: readonly unknown[]): string[] =>
  value.filter((entry): entry is string => typeof entry === "string");

const getSafeSliceLimit = (limit: number | undefined): number | null => {
  if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 0) {
    return null;
  }

  return limit;
};

const applyOptionalTailLimit = (entries: string[], limit: number | undefined): string[] => {
  const safeLimit = getSafeSliceLimit(limit);
  if (safeLimit === null) {
    return entries;
  }

  return entries.slice(-safeLimit);
};

export const parseVersionedStringEntries = (
  value: unknown,
  options?: {
    readonly limit?: number;
  }
): string[] | null => {
  if (Array.isArray(value)) {
    return applyOptionalTailLimit(normalizeStringEntries(value), options?.limit);
  }

  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.entries)) {
    return null;
  }

  return applyOptionalTailLimit(normalizeStringEntries(value.entries), options?.limit);
};

export const toVersionedStringEntriesPayload = (
  entries: readonly string[],
  options?: {
    readonly limit?: number;
  }
): VersionedStringEntriesPayload => {
  const normalizedEntries = applyOptionalTailLimit(normalizeStringEntries(entries), options?.limit);

  return {
    version: 1,
    entries: normalizedEntries
  };
};

export const loadJsonProjectSetting = async <T>(
  projectPath: string,
  filename: string,
  parser: (value: unknown) => T | null,
  fallbackValue: T,
  options?: {
    readonly settingLabel?: string;
    readonly persistFallbackValue?: unknown;
  }
): Promise<T> => {
  const settingLabel = options?.settingLabel ?? filename;
  const fallbackPersistValue = options?.persistFallbackValue ?? fallbackValue;

  const persistFallbackAndReturn = async (): Promise<T> => {
    await saveJsonProjectSetting(projectPath, filename, fallbackPersistValue, settingLabel);
    return fallbackValue;
  };

  try {
    const response = await window.projectApi.settings.read(projectPath, filename);
    if (!response.ok) {
      return fallbackValue;
    }

    if (!response.content) {
      return await persistFallbackAndReturn();
    }

    try {
      const parsed: unknown = JSON.parse(response.content);
      const parsedValue = parser(parsed);
      return parsedValue ?? fallbackValue;
    } catch {
      return fallbackValue;
    }
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
