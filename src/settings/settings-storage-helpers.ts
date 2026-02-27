import { isFailFastMode, toContextualErrorMessage, toErrorMessage } from "../utils/fail-fast";

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

type FailOrFallback<T> = (error: unknown, fallbackReason: string) => T;

function createFailOrFallback<T>(settingLabel: string, fallbackValue: T): FailOrFallback<T> {
  return (error: unknown, fallbackReason: string): T => {
    const message = toContextualErrorMessage(`Failed to load ${settingLabel}`, error, fallbackReason);
    if (isFailFastMode) {
      throw new Error(message);
    }

    console.error(message, error);
    return fallbackValue;
  };
}

async function persistFallbackAndReturn<T>(
  projectPath: string,
  filename: string,
  fallbackPersistValue: unknown,
  fallbackValue: T,
  settingLabel: string,
  failOrFallback: FailOrFallback<T>
): Promise<T> {
  try {
    await saveJsonProjectSetting(projectPath, filename, fallbackPersistValue, settingLabel);
    return fallbackValue;
  } catch (error) {
    return failOrFallback(error, `Unable to persist fallback value for ${settingLabel}.`);
  }
}

function parseLoadedSettingContent<T>(
  content: string,
  parser: (value: unknown) => T | null,
  settingLabel: string,
  failOrFallback: FailOrFallback<T>
): T {
  try {
    const parsed: unknown = JSON.parse(content);
    const parsedValue = parser(parsed);
    if (parsedValue === null) {
      return failOrFallback(null, `${settingLabel} has invalid structure.`);
    }

    return parsedValue;
  } catch (error) {
    return failOrFallback(error, `${settingLabel} has invalid JSON.`);
  }
}

function createPersistFallbackHandler<T>(
  projectPath: string,
  filename: string,
  fallbackPersistValue: unknown,
  fallbackValue: T,
  settingLabel: string,
  failOrFallback: FailOrFallback<T>
) {
  return () =>
    persistFallbackAndReturn(
      projectPath,
      filename,
      fallbackPersistValue,
      fallbackValue,
      settingLabel,
      failOrFallback
    );
}

async function readProjectSettingResponse<T>(
  projectPath: string,
  filename: string,
  settingLabel: string,
  failOrFallback: FailOrFallback<T>
): Promise<SettingsReadResponse | null> {
  try {
    return await window.projectApi.settings.read(projectPath, filename);
  } catch (error) {
    failOrFallback(error, `Unexpected error while loading ${settingLabel}.`);
    return null;
  }
}

export async function loadJsonProjectSetting<T>(
  projectPath: string,
  filename: string,
  parser: (value: unknown) => T | null,
  fallbackValue: T,
  options?: {
    readonly settingLabel?: string;
    readonly persistFallbackValue?: unknown;
  }
): Promise<T> {
  const settingLabel = options?.settingLabel ?? filename;
  const fallbackPersistValue = options?.persistFallbackValue ?? fallbackValue;
  const failOrFallback = createFailOrFallback(settingLabel, fallbackValue);
  const persistFallback = createPersistFallbackHandler(projectPath, filename, fallbackPersistValue, fallbackValue, settingLabel, failOrFallback);
  const response = await readProjectSettingResponse(projectPath, filename, settingLabel, failOrFallback);
  if (response === null) {
    return fallbackValue;
  }

  if (!response.ok) {
    return failOrFallback(response.error, `Unable to read ${settingLabel}.`);
  }

  if (!response.content) {
    return persistFallback();
  }

  return parseLoadedSettingContent(response.content, parser, settingLabel, failOrFallback);
}

export const saveJsonProjectSetting = async (
  projectPath: string,
  filename: string,
  value: unknown,
  settingLabel: string
): Promise<void> => {
  const saveErrorPrefix = `Failed to save ${settingLabel}`;

  try {
    const content = JSON.stringify(value, null, 2);
    const response = await window.projectApi.settings.write(projectPath, filename, content);
    if (!response.ok) {
      const message = `${saveErrorPrefix}: ${toErrorMessage(response.error, "write request failed")}`;
      if (isFailFastMode) {
        throw new Error(message);
      }

      console.error(message, response.error);
    }
  } catch (error) {
    const message = toContextualErrorMessage(
      saveErrorPrefix,
      error,
      `${saveErrorPrefix}.`
    );
    if (isFailFastMode) {
      throw new Error(message);
    }

    console.error(message, error);
  }
};
