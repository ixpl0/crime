/* eslint-disable max-lines */
import { computed, nextTick, ref, watch, type ComponentPublicInstance } from "vue";
import { type ProjectSettings } from "../types/project-settings";
import { type ToolbarAction } from "../types/toolbar";
import {
  PROMPT_SUFFIX_CONFIG_FILENAME
} from "../prompt-suffix/prompt-suffix-storage";
import {
  PROJECT_SETTINGS_FILENAME
} from "../settings/project-settings-storage";
import {
  SECRETS_FILENAME
} from "../settings/secrets-storage";
import {
  loadTerminalInputHistory as loadTerminalInputHistoryFromProject,
  saveTerminalInputHistory
} from "../settings/terminal-input-history-storage";
import {
  TOOLBAR_CONFIG_FILENAME
} from "../toolbar/toolbar-storage";
import {
  GIT_TOOLBAR_CONFIG_FILENAME
} from "../toolbar/git-toolbar-storage";
import {
  TERMINAL_TOOLBAR_CONFIG_FILENAME
} from "../toolbar/terminal-toolbar-storage";
import { toContextualErrorMessage } from "../utils/fail-fast";
import { provideConfirmDialog, providePromptDialog } from "../utils/dialog-utils";
import { provideAppConfigStore } from "../config/config-store";
import { normalizeProjectZoomSettings, normalizeTerminalFontSize } from "../layout/project-layout-utils";
import { provideAppNavigationStore } from "../navigation/navigation-store";
import { useAppNavigation } from "../navigation/use-app-navigation";
import { useAppRuntime } from "../session/use-app-runtime";
import { useConfigManagement } from "../config/use-config-management";
import { useFileNavigation } from "../navigation/use-file-navigation";
import { useProjectLayout } from "../layout/use-project-layout";
import { useProjectSession } from "../session/use-project-session";
import { useRecentProjects } from "../session/use-recent-projects";
import { provideAppTerminalStore } from "../terminal/terminal-store";
import { useBellReminder } from "../terminal/use-bell-reminder";
import { useTerminalActions } from "../terminal/use-terminal-actions";
import { useTerminalInputHistory } from "../terminal/use-terminal-input-history";
import { useTerminalSubmit } from "../terminal/use-terminal-submit";
import { useTerminalView } from "../terminal/use-terminal-view";
import { provideDebugTodoStore } from "../todo/debug-todo-store";
import { provideAppTodoStore } from "../todo/todo-store";
import { useTodoPanel } from "../todo/use-todo-panel";
import { useToolbarShortcuts } from "../composables/use-toolbar-shortcuts";
import { provideSearchDialogStore } from "../search/search-dialog-store";
import { provideStatusBarStore } from "../composables/status-bar-store";
import { provideAppToastStore } from "../toast/toast-store";

// eslint-disable-next-line max-lines-per-function
export function useAppShell() {
  const settingsDirectoryName = window.projectApi.settings.directoryName;
  const QUICK_KEY_GRID_SIZE = 12;
  const quickKeyGridSlots: Array<QuickKeyBinding | null> = Array.from(
    { length: QUICK_KEY_GRID_SIZE },
    () => null
  );
  const quickKeysByInput = new Map<string, QuickKeyBinding>();
  for (const quickKey of window.projectApi.quickKeys) {
    quickKeysByInput.set(quickKey.input, quickKey);
    if (quickKey.gridIndex < 1 || quickKey.gridIndex > QUICK_KEY_GRID_SIZE) {
      continue;
    }

    quickKeyGridSlots[quickKey.gridIndex - 1] = quickKey;
  }

  const findQuickKeyByInput = (input: string) => quickKeysByInput.get(input);

  const isOpening = ref(false);
  const isStartupReady = ref(false);
  const isTerminalReady = ref(false);
  const projectPath = ref<string | null>(null);
  const errorMessage = ref("");
  const toastStore = provideAppToastStore();
  const terminalContainer = ref<HTMLElement | null>(null);
  const TERMINAL_INPUT_HISTORY_LIMIT = 200;
  const TERMINAL_INPUT_CHUNK_SIZE = 2048;
  const TEXTAREA_SUBMIT_ACTIVITY_TIMEOUT_CAP_MS = 400;
  const TEXTAREA_SUBMIT_QUIET_TIMEOUT_CAP_MS = 1200;
  const RECENT_PROJECTS_STORAGE_KEY = "crime:recent-projects";
  const TODO_PANEL_COLLAPSED_STORAGE_KEY = "crime:todo-panel-collapsed";
  const DEBUG_TODO_PANEL_VISIBLE_STORAGE_KEY = "crime:debug-todo-panel-visible";
  const DEBUG_TODO_PANEL_COLLAPSED_STORAGE_KEY = "crime:debug-todo-panel-collapsed";
  const CRIME_PROJECT_PATH = "D:\\projects\\life\\crime";
  const AGENT_DETACHED_STORAGE_KEY = "crime:agent-detached";

  const isAgentDetached = ref(
    localStorage.getItem(AGENT_DETACHED_STORAGE_KEY) === "true"
  );

  const {
    recentProjects,
    getProjectNameFromPath,
    loadRecentProjectsFromStorage,
    addRecentProject,
    removeRecentProject,
    validateRecentProjects
  } = useRecentProjects(
    RECENT_PROJECTS_STORAGE_KEY,
    (path) => window.projectApi.filesystem.readDirectory(path)
  );

  const isDebugTodoPanelVisible = ref(
    localStorage.getItem(DEBUG_TODO_PANEL_VISIBLE_STORAGE_KEY) === "1"
  );
  const debugTodoProjectPath = ref<string | null>(CRIME_PROJECT_PATH);

  const {
    isTodoPanelCollapsed,
    todoDragSourceIndex,
    todoDragOverIndex,
    todoDraftViewItems,
    toggleTodoPanelCollapse,
    handleTodoPanelCollapsedChanged,
    canDragTodoDraft,
    shouldShowTodoDragHandle,
    handleTodoGripMouseDown,
    handleTodoTextareaInput,
    handleTodoTextareaKeydown,
    handleTodoTextareaBlur,
    confirmTodoEntry,
    loadTodoEntriesForProject,
    getTodoEntry,
    removeTodoEntry,
    forcePersistTodoEntries,
    resetTodoRuntimeState,
    resizeTodoTextareas
  } = useTodoPanel({
    projectPath,
    collapsedStorageKey: TODO_PANEL_COLLAPSED_STORAGE_KEY,
    reportUiError
  });

  const debugTodo = useTodoPanel({
    projectPath: debugTodoProjectPath,
    collapsedStorageKey: DEBUG_TODO_PANEL_COLLAPSED_STORAGE_KEY,
    textareaDataAttribute: "debug-todo-textarea",
    reportUiError
  });

  const resizeAllTodoTextareas = () => {
    resizeTodoTextareas();
    debugTodo.resizeTodoTextareas();
  };

  const {
    toolbarConfig,
    terminalToolbarConfig,
    gitToolbarConfig,
    promptSuffixConfig,
    projectSettings,
    secretsConfig,
    isToolbarConfigEditorOpen,
    isTerminalToolbarConfigEditorOpen,
    isGitToolbarConfigEditorOpen,
    isPromptSuffixConfigEditorOpen,
    isProjectSettingsEditorOpen,
    isSecretsEditorOpen,
    openToolbarConfigEditor,
    openTerminalToolbarConfigEditor,
    openGitToolbarConfigEditor,
    closeToolbarConfigEditor,
    closeTerminalToolbarConfigEditor,
    closeGitToolbarConfigEditor,
    openPromptSuffixConfigEditor,
    closePromptSuffixConfigEditor,
    openProjectSettingsEditor,
    closeProjectSettingsEditor,
    openSecretsEditor,
    closeSecretsEditor,
    handleToolbarConfigSave,
    handleTerminalToolbarConfigSave,
    handleGitToolbarConfigSave,
    handlePromptSuffixConfigSave,
    handlePromptSuffixToggle,
    handleSecretsSave,
    applyPromptSuffixConfig,
    updateToolbarActionTracking,
    persistProjectSettings,
    canReloadPromptSuffixConfig,
    resetConfigPersistState
  } = useConfigManagement({
    projectPath,
    reportUiError
  });

  const terminalSelectionCopier = {
    copy: (): Promise<boolean> => Promise.resolve(false)
  };

  const {
    sendTerminalInput,
    attemptSubmitTerminalText,
    sendAltVShortcut,
    markTerminalDataReceived,
    resetTerminalSessionState,
    waitForTerminalQuiet,
    waitForTerminalPattern
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
    sendTextareaToTerminal: sendTextareaToTerminalBase,
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
        notReady: "Терминал не готов к отправке ввода.",
        messages: {
          sendSlash: "Не удалось отправить слеш-команду в терминал.",
          sendText: "Не удалось отправить ввод в терминал.",
          submit: "Не удалось отправить Enter в терминал."
        },
        inputType: "prompt"
      }),
    sendAltVShortcut,
    copyTerminalSelectionIfAny: () => terminalSelectionCopier.copy()
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
    handleProjectDropdownOpenFolderClick,
    handleProjectDropdownOpenFolderInNewWindowClick,
    handleProjectDropdownCreateFolderClick,
    handleProjectDropdownCreateInNewWindowClick,
    handleProjectDropdownCloseProjectClick,
    handleProjectDropdownRecentClick,
    handleProjectDropdownOpenInNewWindowClick,
    handleHiddenPanelOptionClick,
    setActiveTab,
    clearTabNavigationHistory,
    handleHistoryNavigationMouseButton,
    detachAgent,
    dockAgent
  } = useAppNavigation({
    isTodoPanelCollapsed,
    isAgentDetached,
    onOpenProjectFolder: () => {
      void openProjectFolder();
    },
    onOpenProjectFolderInNewWindow: () => {
      void window.projectApi.openFolder().then((selectedPath) => {
        if (selectedPath) {
          void window.projectApi.openInNewWindow(selectedPath);
        }
      });
    },
    onCreateProjectFolder: () => {
      void createProjectFolder();
    },
    onCreateProjectInNewWindow: () => {
      void window.projectApi.createFolder().then((createdPath) => {
        if (createdPath) {
          void window.projectApi.openInNewWindow(createdPath);
        }
      });
    },
    onCloseProject: () => {
      void closeProject();
    },
    onOpenRecentProject: (path) => {
      void openProject(path);
    },
    onOpenProjectInNewWindow: (path) => {
      void window.projectApi.openInNewWindow(path);
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
    resetSelectedFile,
    resetChangesSelectedFile,
    handleChangesPathOpen,
    navigateToFile,
    navigateToDirectory,
    inFileSearchRequestToken,
    requestInFileSearch,
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

  const bellReminderSettings = computed(() => projectSettings.value.bellReminder);

  const { handleBell, acknowledgeBellReminder } = useBellReminder({
    bellReminderSettings,
    flashFrame: () => { void window.projectApi.window.flashFrame(); }
  });

  const {
    startTerminal,
    resizeTerminalBackend,
    focusTerminal,
    handleTerminalCopyEvent,
    copyTerminalSelectionIfAny,
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
    resetTerminalSessionState,
    onBell: triggerTerminalBell
  });

  terminalSelectionCopier.copy = copyTerminalSelectionIfAny;

  const {
    applyProjectSettings,
    startProjectLayoutListeners,
    stopProjectLayout
  } = useProjectLayout({
    projectPath,
    projectSettings,
    terminalContainer,
    resizeTodoTextareas: resizeAllTodoTextareas,
    resizeTerminalInputTextareaElement,
    resizeTerminalBackend,
    syncTerminalFontSize,
    persistProjectSettings,
    reportUiError
  });

  const {
    executeToolbarAction: executeToolbarActionBase,
    sendQuickKey,
    sendTodoEntryToTerminal
  } = useTerminalActions({
    isTerminalReady,
    resetTerminal: resetPrimaryTerminal,
    attemptSubmitTerminalText,
    sendTerminalInput,
    waitForTerminalQuiet,
    waitForTerminalPattern,
    getTodoEntry,
    removeTodoEntry,
    appendTerminalInputHistory
  });

  const executeToolbarAction = (action: ToolbarAction) => {
    executeToolbarActionBase(action);
    void updateToolbarActionTracking(action);
  };

  const {
    openProject,
    openProjectFolder,
    createProjectFolder,
    closeProject,
    openLastProjectOnStartup,
    stopSettingsWatcher
  } = useProjectSession({
    projectPath,
    isOpening,
    isTerminalReady,
    errorMessage,
    toolbarConfig,
    terminalToolbarConfig,
    gitToolbarConfig,
    promptSuffixConfig,
    projectSettings,
    secretsConfig,
    addRecentProject,
    removeRecentProject,
    resetProjectRuntimeState,
    applyProjectSettings,
    canReloadPromptSuffixConfig,
    loadTerminalInputHistoryForProject,
    loadTodoEntriesForProject,
    startTerminal,
    stopTerminal: () => {
      void window.projectApi.terminal.stop();
      disposeTerminalView();
    },
    reportUiError
  });

  watch(isProjectDropdownOpen, (isOpen) => {
    if (isOpen) {
      void validateRecentProjects();
    }
  });

  watch(projectPath, (newPath, oldPath) => {
    if (oldPath && !newPath) {
      void validateRecentProjects();
    }
  });

  useAppRuntime({
    isTodoPanelCollapsed,
    isTerminalReady,
    isStartupReady,
    isDebugTodoPanelVisible,
    persistCurrentProjectOnExit: () => {
      const currentPath = projectPath.value;
      if (currentPath) {
        addRecentProject(currentPath);
      }
    },
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
    findQuickKeyByInput,
    sendQuickKey: (quickKey: QuickKeyBinding) => {
      sendQuickKey(quickKey);
      acknowledgeBellReminder();
    },
    resizeTerminalInputTextareaElement,
    openLastProjectOnStartup,
    handleTodoPanelCollapsedChanged,
    loadDebugTodoEntries: () => debugTodo.loadTodoEntriesForProject(CRIME_PROJECT_PATH, "project-open"),
    resizeDebugTodoTextareas: debugTodo.resizeTodoTextareas,
    stopProjectLayout,
    stopSettingsWatcher,
    stopTerminalRequest: () => window.projectApi.terminal.stop(),
    disposeTerminalView
  });

  useToolbarShortcuts(toolbarConfig, executeToolbarAction);

  provideStatusBarStore();
  provideConfirmDialog();
  providePromptDialog();
  provideSearchDialogStore();
  watch(errorMessage, (message) => {
    if (!message) {
      return;
    }

    toastStore.pushError(message);
    queueMicrotask(() => {
      if (errorMessage.value === message) {
        errorMessage.value = "";
      }
    });
  });

  const gitBranchHighlightRequestToken = ref(0);
  const navigateToBranch = () => {
    setActiveTab("git");
    gitBranchHighlightRequestToken.value += 1;
  };

  provideAppNavigationStore({
    projectPath,
    activeTab,
    isAgentDetached,
    isOpening,
    isProjectDropdownOpen,
    isHiddenPanelsDropdownOpen,
    hiddenPanelOptions,
    recentProjects,
    getProjectNameFromPath,
    setActiveTab,
    detachAgent: handleDetachAgent,
    dockAgent: handleDockAgent,
    toggleProjectDropdown,
    handleProjectDropdownTriggerKeydown,
    setProjectDropdownOpen,
    openProjectFolder: handleProjectDropdownOpenFolderClick,
    openProjectFolderInNewWindow: handleProjectDropdownOpenFolderInNewWindowClick,
    createProjectFolder: handleProjectDropdownCreateFolderClick,
    createProjectInNewWindow: handleProjectDropdownCreateInNewWindowClick,
    closeProject: handleProjectDropdownCloseProjectClick,
    openRecentProject: handleProjectDropdownRecentClick,
    removeRecentProject,
    openProjectInNewWindow: handleProjectDropdownOpenInNewWindowClick,
    toggleHiddenPanelsDropdown,
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
    resetSelectedFile,
    resetChangesSelectedFile,
    handleChangesPathOpen,
    navigateToFile,
    navigateToDirectory,
    inFileSearchRequestToken,
    requestInFileSearch,
    gitBranchHighlightRequestToken,
    navigateToBranch
  });
  provideAppConfigStore({
    settingsDirectoryName,
    toolbarConfigFilename: TOOLBAR_CONFIG_FILENAME,
    terminalToolbarConfigFilename: TERMINAL_TOOLBAR_CONFIG_FILENAME,
    gitToolbarConfigFilename: GIT_TOOLBAR_CONFIG_FILENAME,
    promptSuffixConfigFilename: PROMPT_SUFFIX_CONFIG_FILENAME,
    projectSettingsFilename: PROJECT_SETTINGS_FILENAME,
    secretsFilename: SECRETS_FILENAME,
    errorMessage,
    toolbarConfig,
    terminalToolbarConfig,
    gitToolbarConfig,
    promptSuffixConfig,
    projectSettings,
    secretsConfig,
    isToolbarConfigEditorOpen,
    isTerminalToolbarConfigEditorOpen,
    isGitToolbarConfigEditorOpen,
    isPromptSuffixConfigEditorOpen,
    isProjectSettingsEditorOpen,
    isSecretsEditorOpen,
    handleToolbarConfigSave,
    handleTerminalToolbarConfigSave,
    handleGitToolbarConfigSave,
    handlePromptSuffixConfigSave,
    handleProjectSettingsSave,
    handleSecretsSave,
    openToolbarConfigEditor,
    openTerminalToolbarConfigEditor,
    openGitToolbarConfigEditor,
    openPromptSuffixConfigEditor,
    openProjectSettingsEditor,
    openSecretsEditor,
    closeToolbarConfigEditor,
    closeTerminalToolbarConfigEditor,
    closeGitToolbarConfigEditor,
    closePromptSuffixConfigEditor,
    closeProjectSettingsEditor,
    closeSecretsEditor,
    handlePromptSuffixToggle
  });
  const sendTextareaToTerminal = () => {
    void sendTextareaToTerminalBase();
    acknowledgeBellReminder();
  };

  provideAppTerminalStore({
    isTerminalReady,
    terminalInputText,
    quickKeyGridSlots,
    lastPrompt,
    setTerminalContainer: setTerminalContainerElement,
    setTerminalInputTextarea: setTerminalInputTextareaElement,
    executeToolbarAction,
    focusTerminal,
    handleTerminalCopyEvent,
    setTerminalInputText,
    handleTextareaKeydown,
    handleTextareaInput,
    handleTextareaPaste,
    sendTextareaToTerminal,
    sendQuickKey: (quickKey: QuickKeyBinding) => {
      sendQuickKey(quickKey);
      acknowledgeBellReminder();
    },
    focusTextarea: () => terminalInputTextarea.value?.focus()
  });

  provideAppTodoStore({
    isTodoPanelCollapsed,
    todoDraftViewItems,
    todoDragSourceIndex,
    todoDragOverIndex,
    toggleTodoPanelCollapse,
    canDragTodoDraft,
    shouldShowTodoDragHandle,
    handleTodoGripMouseDown,
    handleTodoTextareaInput,
    handleTodoTextareaKeydown,
    handleTodoTextareaBlur,
    confirmTodoEntry,
    removeTodoEntry,
    forcePersistTodoEntries,
    sendTodoEntryToTerminal,
    isDebugTodoPanelVisible,
    toggleDebugTodoPanel
  });
  provideDebugTodoStore({
    todoDraftViewItems: debugTodo.todoDraftViewItems,
    todoDragSourceIndex: debugTodo.todoDragSourceIndex,
    todoDragOverIndex: debugTodo.todoDragOverIndex,
    canDragTodoDraft: debugTodo.canDragTodoDraft,
    shouldShowTodoDragHandle: debugTodo.shouldShowTodoDragHandle,
    handleTodoGripMouseDown: debugTodo.handleTodoGripMouseDown,
    handleTodoTextareaInput: debugTodo.handleTodoTextareaInput,
    handleTodoTextareaKeydown: debugTodo.handleTodoTextareaKeydown,
    handleTodoTextareaBlur: debugTodo.handleTodoTextareaBlur,
    confirmTodoEntry: debugTodo.confirmTodoEntry,
    removeTodoEntry: debugTodo.removeTodoEntry,
    forcePersistTodoEntries: debugTodo.forcePersistTodoEntries,
    hidePanel: () => { setDebugTodoPanelVisible(false); }
  });

  return {
    errorMessage,
    isOpening,
    isStartupReady,
    isTodoPanelCollapsed,
    isDebugTodoPanelVisible,
    projectSettings,
    recentProjects,
    getProjectNameFromPath,
    removeRecentProject,
    openProject,
    openProjectFolder,
    createProjectFolder,
    projectPath,
    acknowledgeBellReminder
  };

  function triggerTerminalBell() {
    void window.projectApi.window.flashFrame();
    handleBell();
  }

  function handleDetachAgent() {
    detachAgent();
    localStorage.setItem(AGENT_DETACHED_STORAGE_KEY, "true");
    void nextTick(() => {
      void resizeTerminalBackend();
    });
  }

  function handleDockAgent() {
    dockAgent();
    localStorage.removeItem(AGENT_DETACHED_STORAGE_KEY);
    void nextTick(() => {
      void resizeTerminalBackend();
    });
  }

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

  function resetProjectRuntimeState() {
    clearTabNavigationHistory();
    resetFileNavigationState();
    resetTerminalInputRuntimeState();
    resetTodoRuntimeState();
    resetConfigPersistState();
  }

  async function resetPrimaryTerminal() {
    const currentProjectPath = projectPath.value;
    if (!currentProjectPath) {
      return false;
    }

    errorMessage.value = "";
    try {
      await startTerminal(currentProjectPath);
      return true;
    } catch (error) {
      reportUiError("Terminal reset", error, "Не удалось сбросить терминал.");
      return false;
    }
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

  function setDebugTodoPanelVisible(visible: boolean) {
    isDebugTodoPanelVisible.value = visible;
    localStorage.setItem(DEBUG_TODO_PANEL_VISIBLE_STORAGE_KEY, visible ? "1" : "0");
  }

  function toggleDebugTodoPanel() {
    setDebugTodoPanelVisible(!isDebugTodoPanelVisible.value);
  }

}
