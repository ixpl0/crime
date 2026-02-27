<template>
  <main class="h-screen overflow-hidden bg-base-200 p-6 text-base-content">
    <section
      class="flex h-full min-h-0 flex-col gap-6"
      :class="projectPath ? 'w-full' : 'mx-auto w-full max-w-5xl'"
    >
      <template v-if="!projectPath">
        <div class="card bg-base-100 shadow-xl">
          <div class="card-body">
            <h1 class="card-title text-3xl">Dream IDE</h1>
            <p class="opacity-80">Choose a folder to open it as a project.</p>
            <div class="card-actions justify-end">
              <button
                class="btn btn-primary"
                :class="{ loading: isOpening }"
                :disabled="isOpening"
                @click="openProjectFolder"
              >
                {{ isOpening ? "Opening..." : "Open Folder" }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="errorMessage" class="alert alert-error">
          <span>{{ errorMessage }}</span>
        </div>
      </template>

      <div
        v-if="projectPath"
        class="grid min-h-0 flex-1 gap-4"
        :class="{ 'lg:grid-cols-[18rem_minmax(0,1fr)]': !isTodoPanelCollapsed }"
      >
        <TasksPanel
          v-if="!isTodoPanelCollapsed"
          :todo-draft-view-items="todoDraftViewItems"
          :todo-drag-source-index="todoDragSourceIndex"
          :todo-drag-over-index="todoDragOverIndex"
          :is-terminal-ready="isTerminalReady"
          :last-prompt="lastPrompt"
          :toggle-collapse="toggleTodoPanelCollapse"
          :can-drag-todo-draft="canDragTodoDraft"
          :should-show-todo-drag-handle="shouldShowTodoDragHandle"
          :handle-todo-drag-start="handleTodoDragStart"
          :handle-todo-drag-enter="handleTodoDragEnter"
          :handle-todo-drag-over="handleTodoDragOver"
          :handle-todo-drag-end="handleTodoDragEnd"
          :handle-todo-drop="handleTodoDrop"
          :handle-todo-textarea-input="handleTodoTextareaInput"
          :handle-todo-textarea-keydown="handleTodoTextareaKeydown"
          :handle-todo-textarea-blur="handleTodoTextareaBlur"
          :send-todo-entry-to-terminal="sendTodoEntryToTerminal"
        />

        <MainPanel
          :project-path="projectPath"
          :settings-directory-name="settingsDirectoryName"
          :toolbar-config-filename="TOOLBAR_CONFIG_FILENAME"
          :prompt-suffix-config-filename="PROMPT_SUFFIX_CONFIG_FILENAME"
          :project-settings-filename="PROJECT_SETTINGS_FILENAME"
          :error-message="errorMessage"
          :active-tab="activeTab"
          :is-opening="isOpening"
          :is-project-dropdown-open="isProjectDropdownOpen"
          :is-hidden-panels-dropdown-open="isHiddenPanelsDropdownOpen"
          :hidden-panel-options="hiddenPanelOptions"
          :recent-projects="recentProjects"
          :get-project-name-from-path="getProjectNameFromPath"
          :set-active-tab="setActiveTab"
          :toggle-project-dropdown="toggleProjectDropdown"
          :handle-project-dropdown-focus-out="handleProjectDropdownFocusOut"
          :handle-project-dropdown-trigger-keydown="handleProjectDropdownTriggerKeydown"
          :set-project-dropdown-open="setProjectDropdownOpen"
          :open-project-folder="handleProjectDropdownOpenFolderClick"
          :open-recent-project="handleProjectDropdownRecentClick"
          :toggle-hidden-panels-dropdown="toggleHiddenPanelsDropdown"
          :handle-hidden-panels-dropdown-focus-out="handleHiddenPanelsDropdownFocusOut"
          :handle-hidden-panels-dropdown-trigger-keydown="handleHiddenPanelsDropdownTriggerKeydown"
          :set-hidden-panels-dropdown-open="setHiddenPanelsDropdownOpen"
          :show-hidden-panel="handleHiddenPanelOptionClick"
          :open-project-settings="openProjectSettingsEditor"
          :toolbar-config="toolbarConfig"
          :prompt-suffix-config="promptSuffixConfig"
          :project-settings="projectSettings"
          :is-toolbar-config-editor-open="isToolbarConfigEditorOpen"
          :is-prompt-suffix-config-editor-open="isPromptSuffixConfigEditorOpen"
          :is-project-settings-editor-open="isProjectSettingsEditorOpen"
          :handle-toolbar-config-save="handleToolbarConfigSave"
          :handle-prompt-suffix-config-save="handlePromptSuffixConfigSave"
          :handle-project-settings-save="handleProjectSettingsSave"
          :close-toolbar-config-editor="closeToolbarConfigEditor"
          :close-prompt-suffix-config-editor="closePromptSuffixConfigEditor"
          :close-project-settings-editor="closeProjectSettingsEditor"
          :is-terminal-ready="isTerminalReady"
          :terminal-panel-height="terminalPanelHeight"
          :is-terminal-panel-resize-active="isTerminalPanelResizeActive"
          :terminal-input-text="terminalInputText"
          :quick-key-grid-slots="quickKeyGridSlots"
          :last-prompt="lastPrompt"
          :set-terminal-container="setTerminalContainerElement"
          :set-terminal-input-textarea="setTerminalInputTextareaElement"
          :execute-toolbar-action="executeToolbarAction"
          :open-toolbar-config-editor="openToolbarConfigEditor"
          :focus-terminal="focusTerminal"
          :handle-terminal-context-menu="handleTerminalContextMenu"
          :handle-terminal-aux-click="handleTerminalAuxClick"
          :handle-terminal-panel-resize-pointer-down="handleTerminalPanelResizePointerDown"
          :set-terminal-input-text="setTerminalInputText"
          :handle-textarea-keydown="handleTextareaKeydown"
          :handle-textarea-input="handleTextareaInput"
          :handle-textarea-paste="handleTextareaPaste"
          :send-textarea-to-terminal="sendTextareaToTerminal"
          :handle-prompt-suffix-toggle="handlePromptSuffixToggle"
          :open-prompt-suffix-config-editor="openPromptSuffixConfigEditor"
          :send-quick-key="sendQuickKey"
          :files-display-path="filesDisplayPath"
          :file-tree-reveal-path="fileTreeRevealPath"
          :file-tree-reveal-request-token="fileTreeRevealRequestToken"
          :handle-file-select="handleFileSelect"
          :selected-file-path="selectedFilePath"
          :selected-file-target-line="selectedFileTargetLine"
          :selected-file-target-request-token="selectedFileTargetRequestToken"
          :changes-selected-file-path="changesSelectedFilePath"
          :handle-changes-file-select="handleChangesFileSelect"
          :handle-changes-path-open="handleChangesPathOpen"
        />
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref, type ComponentPublicInstance } from "vue";
import "@xterm/xterm/css/xterm.css";
import { type ToolbarAction, type ToolbarConfig } from "./types/toolbar";
import { type PromptSuffixConfig } from "./types/prompt-suffix";
import {
  saveToolbarConfig,
  TOOLBAR_CONFIG_FILENAME
} from "./toolbar/toolbar-storage";
import { defaultToolbarConfig } from "./toolbar/default-toolbar-config";
import {
  PROMPT_SUFFIX_CONFIG_FILENAME,
  savePromptSuffixConfig
} from "./prompt-suffix/prompt-suffix-storage";
import { defaultPromptSuffixConfig } from "./prompt-suffix/default-prompt-suffix-config";
import { type ProjectSettings } from "./types/project-settings";
import {
  defaultProjectSettings,
  PROJECT_SETTINGS_FILENAME,
  saveProjectSettings
} from "./settings/project-settings-storage";
import {
  loadTerminalInputHistory as loadTerminalInputHistoryFromProject,
  saveTerminalInputHistory
} from "./settings/terminal-input-history-storage";
import { useToolbarShortcuts } from "./composables/use-toolbar-shortcuts";
import { toContextualErrorMessage } from "./utils/fail-fast";
import { useRecentProjects } from "./app/use-recent-projects";
import { useAppNavigation } from "./app/use-app-navigation";
import { useAppRuntime } from "./app/use-app-runtime";
import { useFileNavigation } from "./app/use-file-navigation";
import {
  normalizeProjectZoomSettings,
  normalizeTerminalFontSize
} from "./app/project-layout-utils";
import { useProjectLayout } from "./app/use-project-layout";
import { useProjectSession } from "./app/use-project-session";
import { useTodoPanel } from "./app/use-todo-panel";
import { useTerminalInputHistory } from "./app/use-terminal-input-history";
import { useTerminalSubmit } from "./app/use-terminal-submit";
import { useTerminalView } from "./app/use-terminal-view";
import MainPanel from "./components/MainPanel.vue";
import TasksPanel from "./components/TasksPanel.vue";

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
  startTerminalBackendRequest: (cwd, size) => window.projectApi.terminal.start(cwd, size),
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

function reportUiError(context: string, error: unknown, fallbackMessage: string) {
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

  projectSettingsPersistQueue = projectSettingsPersistQueue.then(operation, operation);
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
  terminalInputTextarea.value = element instanceof HTMLTextAreaElement ? element : null;
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
    void sendTerminalInput(action.value, "Failed to send raw input to terminal.");
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

function persistPromptSuffixSettings(config: PromptSuffixConfig, version: number) {
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

  promptSuffixConfigPersistQueue = promptSuffixConfigPersistQueue.then(operation, operation);
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

</script>

<style scoped>
</style>
