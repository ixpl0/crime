/* eslint-disable max-lines */
import { ref, type ComponentPublicInstance } from "vue";
import { type PromptSuffixConfig } from "../types/prompt-suffix";
import { type ProjectSettings } from "../types/project-settings";
import { type ToolbarAction, type ToolbarConfig } from "../types/toolbar";
import { defaultPromptSuffixConfig } from "../prompt-suffix/default-prompt-suffix-config";
import {
  PROMPT_SUFFIX_CONFIG_FILENAME,
  savePromptSuffixConfig
} from "../prompt-suffix/prompt-suffix-storage";
import {
  defaultProjectSettings,
  PROJECT_SETTINGS_FILENAME,
  saveProjectSettings
} from "../settings/project-settings-storage";
import {
  loadTerminalInputHistory as loadTerminalInputHistoryFromProject,
  saveTerminalInputHistory
} from "../settings/terminal-input-history-storage";
import { defaultToolbarConfig } from "../toolbar/default-toolbar-config";
import {
  saveToolbarConfig,
  TOOLBAR_CONFIG_FILENAME
} from "../toolbar/toolbar-storage";
import { toContextualErrorMessage } from "../utils/fail-fast";
import { provideAppConfigStore } from "./config-store";
import {
  normalizeProjectZoomSettings,
  normalizeTerminalFontSize
} from "./project-layout-utils";
import { provideAppNavigationStore } from "./navigation-store";
import { useAppNavigation } from "./use-app-navigation";
import { useAppRuntime } from "./use-app-runtime";
import { useFileNavigation } from "./use-file-navigation";
import { useProjectLayout } from "./use-project-layout";
import { useProjectSession } from "./use-project-session";
import { useRecentProjects } from "./use-recent-projects";
import { provideAppTerminalStore } from "./terminal-store";
import { useTerminalInputHistory } from "./use-terminal-input-history";
import { useTerminalSubmit } from "./use-terminal-submit";
import { useTerminalView } from "./use-terminal-view";
import { provideAppTodoStore } from "./todo-store";
import { useTodoPanel } from "./use-todo-panel";
import { useToolbarShortcuts } from "../composables/use-toolbar-shortcuts";

// Root composition layer for app bootstrap. Split further when domain boundaries settle.
// eslint-disable-next-line max-lines-per-function
export function useAppShell() {
  const settingsDirectoryName = window.projectApi.settings.directoryName;
  const QUICK_KEY_GRID_SIZE = 12;
  const quickKeyGridSlots: Array<QuickKeyBinding | null> = Array.from(
    { length: QUICK_KEY_GRID_SIZE },
    () => null
  );
  for (const quickKey of window.projectApi.quickKeys) {
    if (quickKey.gridIndex < 1 || quickKey.gridIndex > QUICK_KEY_GRID_SIZE) {
      continue;
    }

    quickKeyGridSlots[quickKey.gridIndex - 1] = quickKey;
  }

  const isOpening = ref(false);
  const isTerminalReady = ref(false);
  const projectPath = ref<string | null>(null);
  const errorMessage = ref("");
  const terminalContainer = ref<HTMLElement | null>(null);
  const TERMINAL_INPUT_HISTORY_LIMIT = 200;
  const TERMINAL_INPUT_CHUNK_SIZE = 2048;
  const TEXTAREA_SUBMIT_ACTIVITY_TIMEOUT_CAP_MS = 400;
  const TEXTAREA_SUBMIT_QUIET_TIMEOUT_CAP_MS = 1200;
  const RECENT_PROJECTS_STORAGE_KEY = "dream-ide:recent-projects";
  const TODO_PANEL_COLLAPSED_STORAGE_KEY = "dream-ide:todo-panel-collapsed";
  const {
    recentProjects,
    getProjectNameFromPath,
    loadRecentProjectsFromStorage,
    addRecentProject,
    validateRecentProjects
  } = useRecentProjects(
    RECENT_PROJECTS_STORAGE_KEY,
    (path) => window.projectApi.filesystem.readDirectory(path)
  );
  const {
    isTodoPanelCollapsed,
    todoDragSourceIndex,
    todoDragOverIndex,
    todoDraftViewItems,
    toggleTodoPanelCollapse,
    handleTodoPanelCollapsedChanged,
    canDragTodoDraft,
    shouldShowTodoDragHandle,
    handleTodoDragStart,
    handleTodoDragEnter,
    handleTodoDragOver,
    handleTodoDragEnd,
    handleTodoDrop,
    handleTodoTextareaInput,
    handleTodoTextareaKeydown,
    handleTodoTextareaBlur,
    loadTodoEntriesForProject,
    getTodoEntry,
    removeTodoEntry,
    resetTodoRuntimeState,
    resizeTodoTextareas
  } = useTodoPanel({
    projectPath,
    collapsedStorageKey: TODO_PANEL_COLLAPSED_STORAGE_KEY,
    reportUiError
  });
  const toolbarConfig = ref<ToolbarConfig>(defaultToolbarConfig);
  const promptSuffixConfig = ref<PromptSuffixConfig>(defaultPromptSuffixConfig);
  const projectSettings = ref<ProjectSettings>(defaultProjectSettings);
  const isToolbarConfigEditorOpen = ref(false);
  const isPromptSuffixConfigEditorOpen = ref(false);
  const isProjectSettingsEditorOpen = ref(false);
  const {
    sendTerminalInput,
    attemptSubmitTerminalText,
    sendAltVShortcut,
    markTerminalDataReceived,
    resetTerminalSessionState
  } = useTerminalSubmit({
    isTerminalReady,
    errorMessage,
    projectSettings,
    promptSuffixConfig,
    applyPromptSuffixConfig,
    terminalInputChunkSize: TERMINAL_INPUT_CHUNK_SIZE,
    textareaSubmitActivityTimeoutCapMs: TEXTAREA_SUBMIT_ACTIVITY_TIMEOUT_CAP_MS,
    textareaSubmitQuietTimeoutCapMs: TEXTAREA_SUBMIT_QUIET_TIMEOUT_CAP_MS,
    sendTerminalInputRequest: (data) => window.projectApi.terminal.input(data)
  });
  const {
    terminalInputText,
    terminalInputTextarea,
    lastPrompt,
    resizeTerminalInputTextareaElement,
    appendTerminalInputHistory,
    loadTerminalInputHistoryForProject,
    handleTextareaKeydown,
    handleTextareaInput,
    handleTextareaPaste,
    sendTextareaToTerminal,
    resetTerminalInputRuntimeState
  } = useTerminalInputHistory({
    projectPath,
    historyLimit: TERMINAL_INPUT_HISTORY_LIMIT,
    reportUiError,
    loadTerminalInputHistory: loadTerminalInputHistoryFromProject,
    saveTerminalInputHistory,
    sendTerminalInput,
    submitTextFromTextarea: (text) =>
      attemptSubmitTerminalText(text, {
        notReady: "Terminal is not ready to send input.",
        messages: {
          sendSlash: "Failed to send slash command to terminal.",
          sendText: "Failed to send input to terminal.",
          submit: "Failed to send Enter to terminal."
        },
        inputType: "prompt"
      }),
    sendAltVShortcut
  });
  const {
    activeTab,
    isProjectDropdownOpen,
    isHiddenPanelsDropdownOpen,
    hiddenPanelOptions,
    setProjectDropdownOpen,
    setHiddenPanelsDropdownOpen,
    toggleProjectDropdown,
    toggleHiddenPanelsDropdown,
    handleProjectDropdownTriggerKeydown,
    handleHiddenPanelsDropdownTriggerKeydown,
    handleProjectDropdownFocusOut,
    handleHiddenPanelsDropdownFocusOut,
    handleProjectDropdownOpenFolderClick,
    handleProjectDropdownRecentClick,
    handleHiddenPanelOptionClick,
    setActiveTab,
    clearTabNavigationHistory,
    handleHistoryNavigationMouseButton
  } = useAppNavigation({
    isTodoPanelCollapsed,
    onOpenProjectFolder: () => {
      void openProjectFolder();
    },
    onOpenRecentProject: (path) => {
      void openProject(path);
    },
    onAgentTabActivated: () => {
      void resizeTerminalBackend();
    }
  });
  const {
    selectedFilePath,
    filesDisplayPath,
    changesSelectedFilePath,
    selectedFileTargetLine,
    selectedFileTargetRequestToken,
    fileTreeRevealPath,
    fileTreeRevealRequestToken,
    openTerminalPathInFiles,
    handleFileSelect,
    handleChangesFileSelect,
    handleChangesPathOpen,
    resetFileNavigationState
  } = useFileNavigation({
    projectPath,
    errorMessage,
    activateFilesTab: () => {
      setActiveTab("files");
    },
    reportUiError,
    readDirectory: (path) => window.projectApi.filesystem.readDirectory(path),
    readFile: (currentProjectPath, path) =>
      window.projectApi.filesystem.readFile(currentProjectPath, path)
  });
  const {
    startTerminal,
    resizeTerminalBackend,
    focusTerminal,
    handleTerminalContextMenu,
    handleTerminalAuxClick,
    writeTerminalOutput,
    writeTerminalNotice,
    syncTerminalFontSize,
    disposeTerminalView
  } = useTerminalView({
    terminalContainer,
    projectPath,
    isTerminalReady,
    getTerminalFontSize: () =>
      normalizeTerminalFontSize(projectSettings.value.zoom.terminalFontSize),
    sendTerminalInput,
    openTerminalPath: openTerminalPathInFiles,
    reportUiError,
    writeClipboardText: (text) => window.projectApi.clipboard.writeText(text),
    resizeTerminalBackendRequest: (size) => window.projectApi.terminal.resize(size),
    startTerminalBackendRequest: (cwd, size) =>
      window.projectApi.terminal.start(cwd, size),
    resetTerminalSessionState
  });
  const {
    terminalPanelHeight,
    isTerminalPanelResizeActive,
    applyProjectSettings,
    handleTerminalPanelResizePointerDown,
    startProjectLayoutListeners,
    stopProjectLayout
  } = useProjectLayout({
    projectPath,
    projectSettings,
    terminalContainer,
    resizeTodoTextareas,
    resizeTerminalInputTextareaElement,
    resizeTerminalBackend,
    syncTerminalFontSize,
    persistProjectSettings,
    reportUiError
  });
  const {
    openProject,
    openProjectFolder,
    openLastProjectOnStartup,
    stopSettingsWatcher
  } = useProjectSession({
    projectPath,
    isOpening,
    isTerminalReady,
    errorMessage,
    toolbarConfig,
    promptSuffixConfig,
    projectSettings,
    addRecentProject,
    resetProjectRuntimeState,
    applyProjectSettings,
    canReloadPromptSuffixConfig: () =>
      promptSuffixConfigEditVersion <= promptSuffixConfigPersistedVersion,
    loadTerminalInputHistoryForProject,
    loadTodoEntriesForProject,
    startTerminal,
    reportUiError
  });

  let promptSuffixConfigEditVersion = 0;
  let promptSuffixConfigPersistedVersion = 0;
  let promptSuffixConfigPersistQueue: Promise<void> = Promise.resolve();
  let projectSettingsPersistQueue: Promise<void> = Promise.resolve();

  useAppRuntime({
    isTodoPanelCollapsed,
    isTerminalReady,
    loadRecentProjectsFromStorage,
    validateRecentProjects,
    subscribeTerminalData: (listener) => window.projectApi.terminal.onData(listener),
    markTerminalDataReceived,
    writeTerminalOutput,
    subscribeTerminalExit: (listener) => window.projectApi.terminal.onExit(listener),
    writeTerminalNotice,
    startProjectLayoutListeners,
    handleHistoryNavigationMouseButton,
    reportUiError,
    subscribeGlobalQuickKey: (listener) => window.projectApi.onGlobalQuickKey(listener),
    sendQuickKey,
    resizeTerminalInputTextareaElement,
    openLastProjectOnStartup,
    handleTodoPanelCollapsedChanged,
    stopProjectLayout,
    stopSettingsWatcher,
    stopTerminalRequest: () => window.projectApi.terminal.stop(),
    disposeTerminalView
  });

  useToolbarShortcuts(toolbarConfig, executeToolbarAction);

  provideAppNavigationStore({
    projectPath,
    activeTab,
    isOpening,
    isProjectDropdownOpen,
    isHiddenPanelsDropdownOpen,
    hiddenPanelOptions,
    recentProjects,
    getProjectNameFromPath,
    setActiveTab,
    toggleProjectDropdown,
    handleProjectDropdownFocusOut,
    handleProjectDropdownTriggerKeydown,
    setProjectDropdownOpen,
    openProjectFolder: handleProjectDropdownOpenFolderClick,
    openRecentProject: handleProjectDropdownRecentClick,
    toggleHiddenPanelsDropdown,
    handleHiddenPanelsDropdownFocusOut,
    handleHiddenPanelsDropdownTriggerKeydown,
    setHiddenPanelsDropdownOpen,
    showHiddenPanel: handleHiddenPanelOptionClick,
    filesDisplayPath,
    fileTreeRevealPath,
    fileTreeRevealRequestToken,
    handleFileSelect,
    selectedFilePath,
    selectedFileTargetLine,
    selectedFileTargetRequestToken,
    changesSelectedFilePath,
    handleChangesFileSelect,
    handleChangesPathOpen
  });
  provideAppConfigStore({
    settingsDirectoryName,
    toolbarConfigFilename: TOOLBAR_CONFIG_FILENAME,
    promptSuffixConfigFilename: PROMPT_SUFFIX_CONFIG_FILENAME,
    projectSettingsFilename: PROJECT_SETTINGS_FILENAME,
    errorMessage,
    toolbarConfig,
    promptSuffixConfig,
    projectSettings,
    isToolbarConfigEditorOpen,
    isPromptSuffixConfigEditorOpen,
    isProjectSettingsEditorOpen,
    handleToolbarConfigSave,
    handlePromptSuffixConfigSave,
    handleProjectSettingsSave,
    openToolbarConfigEditor,
    openPromptSuffixConfigEditor,
    openProjectSettingsEditor,
    closeToolbarConfigEditor,
    closePromptSuffixConfigEditor,
    closeProjectSettingsEditor,
    handlePromptSuffixToggle
  });
  provideAppTerminalStore({
    isTerminalReady,
    terminalPanelHeight,
    isTerminalPanelResizeActive,
    terminalInputText,
    quickKeyGridSlots,
    lastPrompt,
    setTerminalContainer: setTerminalContainerElement,
    setTerminalInputTextarea: setTerminalInputTextareaElement,
    executeToolbarAction,
    focusTerminal,
    handleTerminalContextMenu,
    handleTerminalAuxClick,
    handleTerminalPanelResizePointerDown,
    setTerminalInputText,
    handleTextareaKeydown,
    handleTextareaInput,
    handleTextareaPaste,
    sendTextareaToTerminal,
    sendQuickKey
  });
  provideAppTodoStore({
    isTodoPanelCollapsed,
    todoDraftViewItems,
    todoDragSourceIndex,
    todoDragOverIndex,
    toggleTodoPanelCollapse,
    canDragTodoDraft,
    shouldShowTodoDragHandle,
    handleTodoDragStart,
    handleTodoDragEnter,
    handleTodoDragOver,
    handleTodoDragEnd,
    handleTodoDrop,
    handleTodoTextareaInput,
    handleTodoTextareaKeydown,
    handleTodoTextareaBlur,
    sendTodoEntryToTerminal
  });

  return {
    errorMessage,
    isOpening,
    isTodoPanelCollapsed,
    openProjectFolder,
    projectPath
  };

  function reportUiError(
    context: string,
    error: unknown,
    fallbackMessage: string
  ) {
    const message = toContextualErrorMessage(context, error, fallbackMessage);
    errorMessage.value = message;
    console.error(message, error);
    return message;
  }

  function persistProjectSettings(settings: ProjectSettings) {
    if (!projectPath.value) {
      return;
    }

    const path = projectPath.value;
    const operation = async () => {
      try {
        await saveProjectSettings(path, settings);
      } catch (error) {
        reportUiError(
          "Project settings",
          error,
          "Failed to persist project settings."
        );
      }
    };

    projectSettingsPersistQueue = projectSettingsPersistQueue.then(
      operation,
      operation
    );
  }

  function resetProjectRuntimeState() {
    clearTabNavigationHistory();
    resetFileNavigationState();
    resetTerminalInputRuntimeState();
    resetTodoRuntimeState();
    promptSuffixConfigEditVersion = 0;
    promptSuffixConfigPersistedVersion = 0;
    promptSuffixConfigPersistQueue = Promise.resolve();
    projectSettingsPersistQueue = Promise.resolve();
  }

  function setTerminalContainerElement(
    element: Element | ComponentPublicInstance | null
  ) {
    terminalContainer.value = element instanceof HTMLElement ? element : null;
  }

  function setTerminalInputTextareaElement(
    element: Element | ComponentPublicInstance | null
  ) {
    terminalInputTextarea.value =
      element instanceof HTMLTextAreaElement ? element : null;
  }

  function setTerminalInputText(value: string) {
    terminalInputText.value = value;
  }

  function openToolbarConfigEditor() {
    isToolbarConfigEditorOpen.value = true;
  }

  function closeToolbarConfigEditor() {
    isToolbarConfigEditorOpen.value = false;
  }

  function openPromptSuffixConfigEditor() {
    isPromptSuffixConfigEditorOpen.value = true;
  }

  function closePromptSuffixConfigEditor() {
    isPromptSuffixConfigEditorOpen.value = false;
  }

  function openProjectSettingsEditor() {
    isProjectSettingsEditorOpen.value = true;
  }

  function closeProjectSettingsEditor() {
    isProjectSettingsEditorOpen.value = false;
  }

  async function runTerminalCommand(command: string) {
    const result = await attemptSubmitTerminalText(command, {
      notReady: "Terminal is not ready to run commands.",
      messages: {
        sendSlash: "Failed to send slash command to terminal.",
        sendText: "Failed to send command text to terminal.",
        submit: "Failed to submit command in terminal."
      },
      inputType: "command"
    });
    if (result !== "submitted") {
      return;
    }

    focusTerminal();
  }

  async function runToolbarPrompt(promptText: string) {
    const result = await attemptSubmitTerminalText(promptText, {
      notReady: "Terminal is not ready to send prompt.",
      messages: {
        sendSlash: "Failed to send slash command from prompt.",
        sendText: "Failed to send prompt text to terminal.",
        submit: "Failed to submit prompt in terminal."
      },
      inputType: "prompt"
    });
    if (result !== "submitted") {
      return;
    }

    focusTerminal();
  }

  function executeToolbarAction(action: ToolbarAction) {
    if (!isTerminalReady.value) {
      return;
    }

    if (action.type === "prompt") {
      void runToolbarPrompt(action.value);
      return;
    }

    if (action.type === "raw-input") {
      void sendTerminalInput(
        action.value,
        "Failed to send raw input to terminal."
      );
      return;
    }

    void runTerminalCommand(action.value);
  }

  function sendQuickKey(data: string) {
    if (!isTerminalReady.value) {
      return;
    }

    void sendTerminalInput(data, "Failed to send quick key to terminal.");
  }

  function persistPromptSuffixSettings(
    config: PromptSuffixConfig,
    version: number
  ) {
    if (!projectPath.value) {
      return;
    }

    const path = projectPath.value;
    const operation = async () => {
      try {
        await savePromptSuffixConfig(path, config);
      } catch (error) {
        reportUiError(
          "Prompt suffix config",
          error,
          "Failed to persist prompt suffix configuration."
        );
        return;
      }

      if (projectPath.value === path && version > promptSuffixConfigPersistedVersion) {
        promptSuffixConfigPersistedVersion = version;
      }
    };

    promptSuffixConfigPersistQueue = promptSuffixConfigPersistQueue.then(
      operation,
      operation
    );
  }

  function applyPromptSuffixConfig(config: PromptSuffixConfig) {
    promptSuffixConfigEditVersion += 1;
    promptSuffixConfig.value = config;
    persistPromptSuffixSettings(config, promptSuffixConfigEditVersion);
  }

  async function handleToolbarConfigSave(config: ToolbarConfig) {
    toolbarConfig.value = config;
    if (projectPath.value) {
      try {
        await saveToolbarConfig(projectPath.value, config);
      } catch (error) {
        reportUiError(
          "Toolbar config",
          error,
          "Failed to save toolbar configuration."
        );
        return;
      }
    }
    isToolbarConfigEditorOpen.value = false;
  }

  function handlePromptSuffixToggle(index: number) {
    const currentItems = promptSuffixConfig.value.items;
    if (index < 0 || index >= currentItems.length) {
      return;
    }

    const cycleNext = { off: "once", once: "always", always: "off" } as const;
    const nextItems = currentItems.map((item, itemIndex) =>
      itemIndex === index
        ? {
            ...item,
            mode: cycleNext[item.mode]
          }
        : item
    );

    applyPromptSuffixConfig({ items: nextItems });
  }

  function handlePromptSuffixConfigSave(config: PromptSuffixConfig) {
    applyPromptSuffixConfig(config);
    isPromptSuffixConfigEditorOpen.value = false;
  }

  function handleProjectSettingsSave(settings: ProjectSettings) {
    const normalizedSettings: ProjectSettings = {
      ...settings,
      zoom: normalizeProjectZoomSettings(settings.zoom)
    };
    projectSettings.value = normalizedSettings;
    applyProjectSettings(normalizedSettings);
    persistProjectSettings(normalizedSettings);
    isProjectSettingsEditorOpen.value = false;
  }

  async function sendTodoEntryToTerminal(index: number) {
    const text = getTodoEntry(index);
    if (text === null) {
      return;
    }

    const result = await attemptSubmitTerminalText(text, {
      notReady: "Terminal is not ready to send input.",
      messages: {
        sendSlash: "Failed to send slash command from todo to terminal.",
        sendText: "Failed to send todo prompt to terminal.",
        submit: "Failed to send Enter to terminal."
      },
      inputType: "prompt"
    });
    if (result !== "submitted") {
      return;
    }

    appendTerminalInputHistory(text);
    removeTodoEntry(index);
  }
}
