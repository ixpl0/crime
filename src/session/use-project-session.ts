/* eslint-disable max-lines */
import { nextTick, type Ref } from "vue";
import {
  defaultPromptSuffixConfig,
  loadPromptSuffixConfig,
  PROMPT_SUFFIX_CONFIG_FILENAME
} from "../prompt-suffix/prompt-suffix-storage";
import {
  defaultProjectSettings,
  loadProjectSettings,
  PROJECT_SETTINGS_FILENAME
} from "../settings/project-settings-storage";
import { defaultSecretsContent, loadSecrets, SECRETS_FILENAME } from "../settings/secrets-storage";
import { TERMINAL_INPUT_HISTORY_FILENAME } from "../settings/terminal-input-history-storage";
import { TODO_FILENAME } from "../settings/todo-storage";
import {
  defaultGitToolbarConfig,
  loadGitToolbarConfig,
  GIT_TOOLBAR_CONFIG_FILENAME
} from "../toolbar/git-toolbar-storage";
import {
  defaultTerminalToolbarConfig,
  loadTerminalToolbarConfig,
  TERMINAL_TOOLBAR_CONFIG_FILENAME
} from "../toolbar/terminal-toolbar-storage";
import {
  defaultToolbarConfig,
  loadToolbarConfig,
  TOOLBAR_CONFIG_FILENAME
} from "../toolbar/toolbar-storage";
import { type PromptSuffixConfig } from "../types/prompt-suffix";
import { type ProjectSettings } from "../types/project-settings";
import { type ToolbarConfig } from "../types/toolbar";
import { toErrorMessage } from "../utils/fail-fast";
import type { TerminalInputHistoryLoadSource } from "../terminal/use-terminal-input-history";
import type { TodoEntriesLoadSource } from "../todo/use-todo-panel";

const EMPTY_PROMPT_SUFFIX_CONFIG: PromptSuffixConfig = { items: [] };
const LAST_PROJECT_PATH_STORAGE_KEY = "crime:last-project-path";
const SETTINGS_WATCH_ALL = "*";

export interface UseProjectSessionOptions {
  projectPath: Ref<string | null>;
  isOpening: Ref<boolean>;
  isTerminalReady: Ref<boolean>;
  errorMessage: Ref<string>;
  toolbarConfig: Ref<ToolbarConfig>;
  terminalToolbarConfig: Ref<ToolbarConfig>;
  gitToolbarConfig: Ref<ToolbarConfig>;
  promptSuffixConfig: Ref<PromptSuffixConfig>;
  projectSettings: Ref<ProjectSettings>;
  secretsConfig: Ref<string>;
  addRecentProject: (path: string) => void;
  removeRecentProject: (path: string) => void;
  resetProjectRuntimeState: () => void;
  applyProjectSettings: (settings: ProjectSettings) => void;
  canReloadPromptSuffixConfig: () => boolean;
  loadTerminalInputHistoryForProject: (
    path: string,
    source: TerminalInputHistoryLoadSource
  ) => Promise<void>;
  loadTodoEntriesForProject: (path: string, source: TodoEntriesLoadSource) => Promise<void>;
  startTerminal: (path: string) => Promise<void>;
  stopTerminal: () => void;
  reportUiError: (context: string, error: unknown, fallbackMessage: string) => unknown;
}

interface ProjectSessionState {
  readonly options: UseProjectSessionOptions;
  unsubscribeSettingsFileChanged: (() => void) | null;
  settingsChangeQueue: Promise<void>;
}

interface SettingsFileChange {
  isWildcard: boolean;
  normalizedFilenameLower: string;
}

function createProjectSessionState(options: UseProjectSessionOptions): ProjectSessionState {
  return {
    options,
    unsubscribeSettingsFileChanged: null,
    settingsChangeQueue: Promise.resolve()
  };
}

function getLastProjectPathFromStorage() {
  const storedPath = window.localStorage.getItem(LAST_PROJECT_PATH_STORAGE_KEY);
  if (!storedPath) {
    return null;
  }

  const normalizedPath = storedPath.trim();
  return normalizedPath.length > 0 ? normalizedPath : null;
}

function setLastProjectPathInStorage(path: string) {
  window.localStorage.setItem(LAST_PROJECT_PATH_STORAGE_KEY, path);
}

function clearLastProjectPathInStorage() {
  window.localStorage.removeItem(LAST_PROJECT_PATH_STORAGE_KEY);
}

function clearSettingsFileChangedSubscription(state: ProjectSessionState) {
  state.unsubscribeSettingsFileChanged?.();
  state.unsubscribeSettingsFileChanged = null;
}

function createSettingsFileChange(filename: string): SettingsFileChange {
  const normalizedFilename = filename.split(/[\\/]/).pop() ?? filename;
  return {
    isWildcard: normalizedFilename === SETTINGS_WATCH_ALL,
    normalizedFilenameLower: normalizedFilename.toLowerCase()
  };
}

function matchesWatchedSettingsFile(change: SettingsFileChange, targetFilename: string) {
  return change.isWildcard || change.normalizedFilenameLower === targetFilename.toLowerCase();
}

function assignProjectSettings(state: ProjectSessionState, settings: ProjectSettings) {
  state.options.projectSettings.value = settings;
  state.options.applyProjectSettings(settings);
}

function resetProjectSessionToDefaults(state: ProjectSessionState) {
  document.title = "CRIME";
  state.options.projectPath.value = null;
  state.options.resetProjectRuntimeState();
  state.options.toolbarConfig.value = defaultToolbarConfig;
  state.options.terminalToolbarConfig.value = defaultTerminalToolbarConfig;
  state.options.gitToolbarConfig.value = defaultGitToolbarConfig;
  state.options.promptSuffixConfig.value = defaultPromptSuffixConfig;
  state.options.secretsConfig.value = defaultSecretsContent;
  assignProjectSettings(state, defaultProjectSettings);
  state.options.isTerminalReady.value = false;
}

function handleProjectOpenFailure(state: ProjectSessionState, error: unknown) {
  state.options.isTerminalReady.value = false;
  state.options.reportUiError("Project open", error, "Не удалось открыть проект или запустить терминал.");
}

async function stopPreviousSettingsWatcher(state: ProjectSessionState) {
  clearSettingsFileChangedSubscription(state);
  const response = await window.projectApi.settings.unwatch();
  if (!response.ok) {
    throw new Error(
      toErrorMessage(response.error, "Не удалось остановить наблюдатель настроек.")
    );
  }
}

async function stopSettingsWatcher(state: ProjectSessionState) {
  clearSettingsFileChangedSubscription(state);
  try {
    const response = await window.projectApi.settings.unwatch();
    if (!response.ok) {
      state.options.reportUiError(
        "Settings watcher teardown",
        response.error,
        "Не удалось остановить наблюдатель настроек."
      );
    }
  } catch (error) {
    state.options.reportUiError(
      "Settings watcher teardown",
      error,
      "Не удалось остановить наблюдатель настроек."
    );
  }
}

async function loadPromptSuffixConfigForProject(state: ProjectSessionState, path: string) {
  try {
    state.options.promptSuffixConfig.value = await loadPromptSuffixConfig(path);
  } catch (error) {
    state.options.promptSuffixConfig.value = EMPTY_PROMPT_SUFFIX_CONFIG;
    state.options.reportUiError(
      "Prompt suffix config",
      error,
      "Не удалось загрузить конфигурацию суффиксов. Исправьте .crime/prompt-suffixes.json или нажмите «Сброс» в настройках суффиксов."
    );
  }
}

async function loadProjectSettingsForProject(state: ProjectSessionState, path: string) {
  const settings = await loadProjectSettings(path);
  assignProjectSettings(state, settings);
}

async function loadProjectResources(state: ProjectSessionState, path: string) {
  state.options.toolbarConfig.value = await loadToolbarConfig(path);
  state.options.terminalToolbarConfig.value = await loadTerminalToolbarConfig(path);
  state.options.gitToolbarConfig.value = await loadGitToolbarConfig(path);
  state.options.secretsConfig.value = await loadSecrets(path);
  await loadPromptSuffixConfigForProject(state, path);
  await loadProjectSettingsForProject(state, path);
  await state.options.loadTerminalInputHistoryForProject(path, "project-open");
  await state.options.loadTodoEntriesForProject(path, "project-open");
}

/* eslint-disable-next-line max-lines-per-function */
async function handleSettingsFileChanged(state: ProjectSessionState, filename: string) {
  const path = state.options.projectPath.value;
  if (!path) {
    return;
  }

  const change = createSettingsFileChange(filename);
  if (matchesWatchedSettingsFile(change, TOOLBAR_CONFIG_FILENAME)) {
    state.options.toolbarConfig.value = await loadToolbarConfig(path);
  }
  if (matchesWatchedSettingsFile(change, TERMINAL_TOOLBAR_CONFIG_FILENAME)) {
    state.options.terminalToolbarConfig.value = await loadTerminalToolbarConfig(path);
  }
  if (matchesWatchedSettingsFile(change, GIT_TOOLBAR_CONFIG_FILENAME)) {
    state.options.gitToolbarConfig.value = await loadGitToolbarConfig(path);
  }
  if (matchesWatchedSettingsFile(change, SECRETS_FILENAME)) {
    state.options.secretsConfig.value = await loadSecrets(path);
  }
  if (
    matchesWatchedSettingsFile(change, PROMPT_SUFFIX_CONFIG_FILENAME) &&
    state.options.canReloadPromptSuffixConfig()
  ) {
    await loadPromptSuffixConfigForProject(state, path);
  }
  if (matchesWatchedSettingsFile(change, PROJECT_SETTINGS_FILENAME)) {
    await loadProjectSettingsForProject(state, path);
  }
  if (matchesWatchedSettingsFile(change, TODO_FILENAME)) {
    await state.options.loadTodoEntriesForProject(path, "settings-watch");
  }
  if (matchesWatchedSettingsFile(change, TERMINAL_INPUT_HISTORY_FILENAME)) {
    await state.options.loadTerminalInputHistoryForProject(path, "settings-watch");
  }
}

function enqueueSettingsFileChange(state: ProjectSessionState, filename: string) {
  const next = state.settingsChangeQueue.then(
    () => handleSettingsFileChanged(state, filename).catch((error: unknown) => {
      state.options.reportUiError(
        "Settings watcher event",
        error,
        "Не удалось перезагрузить настройки после изменения файла."
      );
    }),
    () => handleSettingsFileChanged(state, filename).catch((error: unknown) => {
      state.options.reportUiError(
        "Settings watcher event",
        error,
        "Не удалось перезагрузить настройки после изменения файла."
      );
    })
  );
  state.settingsChangeQueue = next.then(() => undefined, () => undefined);
}

function subscribeToSettingsFileChanges(state: ProjectSessionState) {
  state.unsubscribeSettingsFileChanged = window.projectApi.settings.onFileChanged((filename) => {
    enqueueSettingsFileChange(state, filename);
  });
}

async function startSettingsWatcher(state: ProjectSessionState, path: string) {
  await stopPreviousSettingsWatcher(state);
  subscribeToSettingsFileChanges(state);
  const response = await window.projectApi.settings.watch(path, SETTINGS_WATCH_ALL);
  if (response.ok) {
    return;
  }

  clearSettingsFileChangedSubscription(state);
  throw new Error(toErrorMessage(response.error, "Не удалось запустить наблюдатель настроек."));
}

const log = (level: LogLevel, message: string) => {
  void window.projectApi.log.write(level, message);
};

function getProjectFolderName(path: string) {
  return path.split(/[\\/]/).pop() ?? path;
}

async function performProjectOpen(state: ProjectSessionState, path: string) {
  log("info", `Opening project: ${path}`);
  state.options.projectPath.value = path;
  document.title = `CRIME — ${getProjectFolderName(path)}`;
  state.options.addRecentProject(path);
  state.options.resetProjectRuntimeState();
  log("info", "Loading project resources");
  await loadProjectResources(state, path);
  log("info", "Starting settings watcher");
  await startSettingsWatcher(state, path);
  await nextTick();
  log("info", "Starting terminal");
  await state.options.startTerminal(path);
  setLastProjectPathInStorage(path);
  log("info", "Project opened successfully");
}

async function closeProject(state: ProjectSessionState) {
  const closingPath = state.options.projectPath.value;
  if (closingPath) {
    setLastProjectPathInStorage(closingPath);
    state.options.addRecentProject(closingPath);
  }
  await stopSettingsWatcher(state);
  state.options.stopTerminal();
  resetProjectSessionToDefaults(state);
}

async function handleStartupRestoreFailure(state: ProjectSessionState, error: unknown) {
  clearLastProjectPathInStorage();
  resetProjectSessionToDefaults(state);
  await stopSettingsWatcher(state);
  state.options.reportUiError(
    "Startup project restore",
    error,
    "Не удалось открыть последний проект. Выберите папку вручную."
  );
}

async function runProjectOpenFlow(
  state: ProjectSessionState,
  operation: () => Promise<void>,
  handleError: (error: unknown) => Promise<void> | void
) {
  state.options.isOpening.value = true;
  state.options.errorMessage.value = "";
  try {
    await operation();
  } catch (error) {
    await handleError(error);
  } finally {
    state.options.isOpening.value = false;
  }
}

async function openProject(state: ProjectSessionState, path: string) {
  const isAccessible = await isProjectFolderAccessible(path);
  if (!isAccessible) {
    state.options.removeRecentProject(path);
    state.options.reportUiError(
      "Project open",
      null,
      `Project folder not found: ${path}`
    );
    return;
  }

  await runProjectOpenFlow(
    state,
    () => performProjectOpen(state, path),
    (error) => {
      handleProjectOpenFailure(state, error);
    }
  );
}

async function openProjectFolder(state: ProjectSessionState) {
  await runProjectOpenFlow(
    state,
    async () => {
      const selectedPath = await window.projectApi.openFolder();
      if (!selectedPath) {
        return;
      }

      await performProjectOpen(state, selectedPath);
    },
    (error) => {
      handleProjectOpenFailure(state, error);
    }
  );
}

async function createProjectFolder(state: ProjectSessionState) {
  await runProjectOpenFlow(
    state,
    async () => {
      const createdPath = await window.projectApi.createFolder();
      if (!createdPath) {
        return;
      }

      await performProjectOpen(state, createdPath);
    },
    (error) => {
      handleProjectOpenFailure(state, error);
    }
  );
}

async function isProjectFolderAccessible(path: string) {
  try {
    const response = await window.projectApi.filesystem.readDirectory(path);
    return response.ok;
  } catch {
    return false;
  }
}

function getStartupQueryParams() {
  return new URLSearchParams(window.location.search);
}

function shouldSkipLastProjectRestore() {
  return getStartupQueryParams().get("skipRestore") === "1";
}

function getStartupOpenProjectPath() {
  const path = getStartupQueryParams().get("openProject");
  return path && path.trim().length > 0 ? path.trim() : null;
}

async function openStartupProject(state: ProjectSessionState, path: string) {
  const isAccessible = await isProjectFolderAccessible(path);
  if (!isAccessible) {
    return;
  }

  await runProjectOpenFlow(
    state,
    () => performProjectOpen(state, path),
    (error) => handleStartupRestoreFailure(state, error)
  );
}

async function restoreLastProject(state: ProjectSessionState) {
  const lastProjectPath = getLastProjectPathFromStorage();
  if (!lastProjectPath) {
    log("info", "No last project to restore");
    return;
  }

  log("info", `Restoring last project: ${lastProjectPath}`);
  const isAccessible = await isProjectFolderAccessible(lastProjectPath);
  if (!isAccessible) {
    log("warn", `Last project folder not accessible: ${lastProjectPath}`);
    clearLastProjectPathInStorage();
    return;
  }

  await runProjectOpenFlow(
    state,
    () => performProjectOpen(state, lastProjectPath),
    (error) => handleStartupRestoreFailure(state, error)
  );
}

async function openLastProjectOnStartup(state: ProjectSessionState) {
  const startupProjectPath = getStartupOpenProjectPath();
  if (startupProjectPath) {
    await openStartupProject(state, startupProjectPath);
    return;
  }

  if (shouldSkipLastProjectRestore()) {
    return;
  }

  await restoreLastProject(state);
}

export function useProjectSession(options: UseProjectSessionOptions) {
  const state = createProjectSessionState(options);
  return {
    openProject: openProject.bind(null, state),
    openProjectFolder: openProjectFolder.bind(null, state),
    createProjectFolder: createProjectFolder.bind(null, state),
    closeProject: closeProject.bind(null, state),
    openLastProjectOnStartup: openLastProjectOnStartup.bind(null, state),
    stopSettingsWatcher: stopSettingsWatcher.bind(null, state)
  };
}
