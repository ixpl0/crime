<template>
  <main class="min-h-screen bg-base-200 p-6 text-base-content">
    <section class="mx-auto max-w-5xl space-y-6">
      <template v-if="!projectPath">
        <div class="card bg-base-100 shadow-xl">
          <div class="card-body">
            <h1 class="card-title text-3xl">Dream IDE</h1>
            <p class="opacity-80">Выберите папку, чтобы открыть её как проект.</p>
            <div class="card-actions justify-end">
              <button
                class="btn btn-primary"
                :class="{ loading: isOpening }"
                :disabled="isOpening"
                @click="openProjectFolder"
              >
                {{ isOpening ? "Открываем..." : "Открыть папку" }}
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
        class="grid gap-4"
        :class="{ 'lg:grid-cols-[17.5rem_minmax(0,1fr)]': !isTodoPanelCollapsed }"
      >
        <aside v-if="!isTodoPanelCollapsed" class="card h-fit bg-base-100 shadow-xl">
          <div class="card-body p-3">
            <div class="flex items-center justify-between gap-2">
              <h2 class="text-sm font-semibold uppercase tracking-wide text-base-content/70">
                &#1047;&#1072;&#1076;&#1072;&#1095;&#1080;
              </h2>
              <button
                class="btn btn-ghost btn-xs"
                type="button"
                title="Скрыть блок задач"
                @click="toggleTodoPanelCollapse"
              >
                <EyeOff :size="14" />
              </button>
            </div>
            <div class="mt-2 flex flex-col gap-2">
              <div
                v-for="(todoDraft, index) in todoDrafts"
                :key="`todo-draft-${index}`"
                class="space-y-1"
              >
                <textarea
                  :value="todoDraft"
                  data-todo-textarea="true"
                  :data-todo-index="index"
                  class="textarea textarea-bordered h-auto min-h-0 w-full resize-none overflow-y-hidden text-sm leading-relaxed"
                  rows="1"
                  placeholder="&#1055;&#1088;&#1086;&#1084;&#1087;&#1090;"
                  @input="handleTodoTextareaInput(index, $event)"
                  @blur="handleTodoTextareaBlur"
                />
                <div class="flex justify-end">
                  <button
                    class="btn btn-ghost btn-xs normal-case text-base-content/70"
                    type="button"
                    :disabled="!isTerminalReady || !todoDraft.trim()"
                    @click="sendTodoEntryToTerminal(index)"
                  >
                    &#1054;&#1090;&#1087;&#1088;&#1072;&#1074;&#1080;&#1090;&#1100;
                  </button>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <div class="card bg-base-100 shadow-xl">
          <div class="card-body gap-4">
          <div v-if="errorMessage" class="alert alert-error">
            <span>{{ errorMessage }}</span>
          </div>

          <div class="flex items-center gap-2">
            <div role="tablist" class="tabs tabs-bordered">
            <button
              role="tab"
              class="tab"
              :class="{ 'tab-active': activeTab === 'agent' }"
              @click="activeTab = 'agent'"
            >
              Агент
            </button>
            <button
              role="tab"
              class="tab"
              :class="{ 'tab-active': activeTab === 'files' }"
              @click="activeTab = 'files'"
            >
              Файлы
            </button>
              <div class="dropdown dropdown-bottom">
                <div tabindex="0" role="tab" class="tab">
                  &#1055;&#1088;&#1086;&#1077;&#1082;&#1090;
                  <ChevronDown :size="14" class="ml-1" />
                </div>
                <ul
                  tabindex="0"
                  class="dropdown-content menu bg-base-100 rounded-box z-10 w-40 p-0 shadow"
                >
                  <li>
                    <button :disabled="isOpening" @click="openProjectFolder">
                      &#1054;&#1090;&#1082;&#1088;&#1099;&#1090;&#1100;
                    </button>
                  </li>
                </ul>
              </div>
            </div>

            <div v-if="hiddenPanelOptions.length > 0" class="dropdown dropdown-end">
              <button
                tabindex="0"
                type="button"
                class="btn btn-sm btn-ghost"
                title="Показать скрытые панели"
              >
                <Eye :size="16" />
                <ChevronDown :size="14" />
              </button>
              <ul
                tabindex="0"
                class="dropdown-content menu bg-base-100 rounded-box z-10 mt-1 w-56 p-1 shadow"
              >
                <li v-for="panelOption in hiddenPanelOptions" :key="panelOption.id">
                  <button type="button" @click="showHiddenPanel(panelOption.id)">
                    {{ panelOption.title }}
                  </button>
                </li>
              </ul>
            </div>

            <button
              class="btn btn-sm btn-ghost"
              title="Project settings"
              @click="isProjectSettingsEditorOpen = true"
            >
              <Settings :size="16" />
            </button>
          </div>

          <ToolbarConfigEditor
            :current-config="toolbarConfig"
            :config-file-path="`${projectPath}/${settingsDirectoryName}/${TOOLBAR_CONFIG_FILENAME}`"
            :open="isToolbarConfigEditorOpen"
            @save="handleToolbarConfigSave"
            @close="isToolbarConfigEditorOpen = false"
          />

          <ProjectSettingsEditor
            :current-settings="projectSettings"
            :config-file-path="`${projectPath}/${settingsDirectoryName}/${PROJECT_SETTINGS_FILENAME}`"
            :open="isProjectSettingsEditorOpen"
            @save="handleProjectSettingsSave"
            @close="isProjectSettingsEditorOpen = false"
          />

          <div v-show="activeTab === 'agent'" class="space-y-4">
            <ToolbarPanel
              :toolbar-config="toolbarConfig"
              :is-terminal-ready="isTerminalReady"
              @execute-action="executeToolbarAction"
              @open-config-editor="isToolbarConfigEditorOpen = true"
            />

            <div
              ref="terminalContainer"
              class="terminal-host h-96 w-full rounded-box border border-base-300 bg-[#05070d]"
              @click="focusTerminal"
            />

            <form class="flex gap-3" @submit.prevent="sendTextareaToTerminal">
              <div class="flex flex-1 flex-col gap-2">
                <textarea
                  ref="terminalInputTextarea"
                  v-model="terminalInputText"
                  class="textarea textarea-bordered h-auto min-h-0 w-full resize-none overflow-y-hidden"
                  rows="1"
                  :disabled="!isTerminalReady"
                  placeholder="&#1042;&#1074;&#1077;&#1076;&#1080;&#1090;&#1077; &#1090;&#1077;&#1082;&#1089;&#1090; &#1076;&#1083;&#1103; &#1086;&#1090;&#1087;&#1088;&#1072;&#1074;&#1082;&#1080; &#1074; &#1090;&#1077;&#1088;&#1084;&#1080;&#1085;&#1072;&#1083;"
                  @keydown="handleTextareaKeydown"
                  @input="handleTextareaInput"
                  @paste="handleTextareaPaste"
                />
                <div class="flex justify-end">
                  <button
                    class="btn btn-sm"
                    type="submit"
                    :disabled="!isTerminalReady || !terminalInputText.trim()"
                  >
                    &#1054;&#1090;&#1087;&#1088;&#1072;&#1074;&#1080;&#1090;&#1100;
                  </button>
                </div>
              </div>

              <div class="grid shrink-0 grid-cols-4 gap-1 self-start">
                <template v-for="(quickKey, index) in quickKeyGridSlots" :key="`quick-key-${index}`">
                  <button
                    v-if="quickKey"
                    type="button"
                    class="btn btn-sm min-w-0 px-2"
                    :disabled="!isTerminalReady"
                    :title="quickKey.accelerator"
                    @click="sendQuickKey(quickKey.input)"
                  >
                    <ArrowUp v-if="quickKey.icon === 'arrow-up'" :size="14" />
                    <ArrowDown v-else-if="quickKey.icon === 'arrow-down'" :size="14" />
                    <ArrowLeft v-else-if="quickKey.icon === 'arrow-left'" :size="14" />
                    <ArrowRight v-else-if="quickKey.icon === 'arrow-right'" :size="14" />
                    <CornerDownLeft v-else-if="quickKey.icon === 'enter'" :size="14" />
                    <template v-else>{{ quickKey.label }}</template>
                  </button>
                  <span v-else />
                </template>
              </div>
            </form>
          </div>
          <div v-show="activeTab === 'files'">
            <div class="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
              <FileManagerPanel
                v-if="projectPath"
                :project-path="projectPath"
                @select-file="handleFileSelect"
              />

              <FileContentViewer
                v-if="projectPath"
                :project-path="projectPath"
                :file-path="selectedFilePath"
                :is-active="activeTab === 'files'"
              />
            </div>
          </div>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Terminal } from "xterm";
import { FitAddon } from "@xterm/addon-fit";
import "xterm/css/xterm.css";
import { type ToolbarAction, type ToolbarConfig } from "./types/toolbar";
import {
  LEGACY_TOOLBAR_CONFIG_FILENAME,
  loadToolbarConfig,
  saveToolbarConfig,
  TOOLBAR_CONFIG_FILENAME
} from "./toolbar/toolbar-storage";
import { defaultToolbarConfig } from "./toolbar/default-toolbar-config";
import { type ProjectSettings } from "./types/project-settings";
import {
  defaultProjectSettings,
  loadProjectSettings,
  PROJECT_SETTINGS_FILENAME,
  saveProjectSettings
} from "./settings/project-settings-storage";
import {
  loadTerminalInputHistory as loadTerminalInputHistoryFromProject,
  saveTerminalInputHistory
} from "./settings/terminal-input-history-storage";
import { loadTodoEntries, saveTodoEntries, TODO_FILENAME } from "./settings/todo-storage";
import { useToolbarShortcuts } from "./composables/use-toolbar-shortcuts";
import ToolbarPanel from "./components/ToolbarPanel.vue";
import ToolbarConfigEditor from "./components/ToolbarConfigEditor.vue";
import ProjectSettingsEditor from "./components/ProjectSettingsEditor.vue";
import FileManagerPanel from "./components/FileManagerPanel.vue";
import FileContentViewer from "./components/FileContentViewer.vue";
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  CornerDownLeft,
  Settings,
  ChevronDown,
  Eye,
  EyeOff
} from "lucide-vue-next";

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
const terminalInputText = ref("");
const terminalInputTextarea = ref<HTMLTextAreaElement | null>(null);
const terminalContainer = ref<HTMLElement | null>(null);
const TERMINAL_INPUT_HISTORY_LIMIT = 200;
const TERMINAL_INPUT_CHUNK_SIZE = 2048;
const TEXTAREA_SUBMIT_ACTIVITY_TIMEOUT_CAP_MS = 400;
const TEXTAREA_SUBMIT_QUIET_TIMEOUT_CAP_MS = 1200;
const SETTINGS_WATCH_ALL = "*";
const LAST_PROJECT_PATH_STORAGE_KEY = "dream-ide:last-project-path";
const TODO_PANEL_COLLAPSED_STORAGE_KEY = "dream-ide:todo-panel-collapsed";
const terminalInputHistory = ref<string[]>([]);
const todoDrafts = ref<string[]>([""]);
const isTodoPanelCollapsed = ref(
  window.localStorage.getItem(TODO_PANEL_COLLAPSED_STORAGE_KEY) === "1"
);
const terminalInputHistoryIndex = ref<number | null>(null);
const terminalInputDraft = ref("");
const toolbarConfig = ref<ToolbarConfig>(defaultToolbarConfig);
const projectSettings = ref<ProjectSettings>(defaultProjectSettings);
const isToolbarConfigEditorOpen = ref(false);
const isProjectSettingsEditorOpen = ref(false);
const activeTab = ref<"agent" | "files">("agent");
const selectedFilePath = ref<string | null>(null);
type HiddenPanelId = "todo";

interface HiddenPanelOption {
  id: HiddenPanelId;
  title: string;
}

const hiddenPanelOptions = computed<HiddenPanelOption[]>(() => {
  const options: HiddenPanelOption[] = [];

  if (isTodoPanelCollapsed.value) {
    options.push({
      id: "todo",
      title: "\u0417\u0430\u0434\u0430\u0447\u0438"
    });
  }

  return options;
});

let terminal: Terminal | null = null;
let fitAddon: FitAddon | null = null;
let unsubscribeTerminalData: (() => void) | null = null;
let unsubscribeTerminalExit: (() => void) | null = null;
let removeWindowResizeListener: (() => void) | null = null;
let unsubscribeGlobalQuickKey: (() => void) | null = null;
let unsubscribeSettingsFileChanged: (() => void) | null = null;
let terminalDataVersion = 0;
let terminalInputQueue: Promise<void> = Promise.resolve();
let terminalInputHistoryLoadToken = 0;
let todoEntriesLoadToken = 0;
let todoDraftEditVersion = 0;
let todoPersistedVersion = 0;
let todoPersistQueue: Promise<void> = Promise.resolve();

useToolbarShortcuts(toolbarConfig, executeToolbarAction);

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

function persistTodoPanelCollapsedState(isCollapsed: boolean) {
  window.localStorage.setItem(TODO_PANEL_COLLAPSED_STORAGE_KEY, isCollapsed ? "1" : "0");
}

function toggleTodoPanelCollapse() {
  isTodoPanelCollapsed.value = !isTodoPanelCollapsed.value;
}

const showHiddenPanelHandlers: Record<HiddenPanelId, () => void> = {
  todo: () => {
    isTodoPanelCollapsed.value = false;
  }
};

function showHiddenPanel(panelId: HiddenPanelId) {
  showHiddenPanelHandlers[panelId]();
}

async function loadTerminalInputHistoryForProject(path: string) {
  const loadToken = terminalInputHistoryLoadToken + 1;
  terminalInputHistoryLoadToken = loadToken;
  const history = await loadTerminalInputHistoryFromProject(path, TERMINAL_INPUT_HISTORY_LIMIT);

  if (projectPath.value !== path || terminalInputHistoryLoadToken !== loadToken) {
    return;
  }

  terminalInputHistory.value = history;
  resetTerminalInputHistoryNavigation();
}

function getNormalizedTodoDrafts(entries: string[]) {
  const nextEntries = entries.length > 0 ? entries : [""];
  let visibleCount = 1;
  while (
    visibleCount < nextEntries.length &&
    nextEntries[visibleCount - 1].trim().length > 0
  ) {
    visibleCount += 1;
  }

  const visibleEntries = nextEntries.slice(0, visibleCount);
  if (visibleEntries[visibleEntries.length - 1].trim().length > 0) {
    visibleEntries.push("");
  }

  return visibleEntries;
}

function getPersistedTodoEntries(entries: string[]) {
  return entries.filter((entry) => entry.trim().length > 0);
}

function areStringArraysEqual(first: string[], second: string[]) {
  if (first.length !== second.length) {
    return false;
  }

  for (let index = 0; index < first.length; index += 1) {
    if (first[index] !== second[index]) {
      return false;
    }
  }

  return true;
}

function getTextareaMinHeight(textarea: HTMLTextAreaElement, boxFrameHeight: number) {
  const computedStyles = window.getComputedStyle(textarea);
  const lineHeight = Number.parseFloat(computedStyles.lineHeight) || 20;
  const paddingTop = Number.parseFloat(computedStyles.paddingTop) || 0;
  const paddingBottom = Number.parseFloat(computedStyles.paddingBottom) || 0;

  return Math.max(Math.ceil(lineHeight + paddingTop + paddingBottom + boxFrameHeight), 1);
}

function resizeAutoHeightTextareaElement(textarea: HTMLTextAreaElement) {
  textarea.style.height = "auto";
  const boxFrameHeight = textarea.offsetHeight - textarea.clientHeight;
  const minHeight = getTextareaMinHeight(textarea, boxFrameHeight);
  const nextHeight = Math.max(
    Math.ceil(textarea.scrollHeight + boxFrameHeight),
    minHeight
  );
  textarea.style.height = `${String(nextHeight)}px`;
}

function resizeTodoTextareaElement(textarea: HTMLTextAreaElement) {
  resizeAutoHeightTextareaElement(textarea);
}

function resizeTerminalInputTextareaElement() {
  const textarea = terminalInputTextarea.value;
  if (!textarea) {
    return;
  }

  resizeAutoHeightTextareaElement(textarea);
}

function resizeTodoTextareas() {
  const textareas = document.querySelectorAll<HTMLTextAreaElement>(
    'textarea[data-todo-textarea="true"]'
  );

  for (const textarea of textareas) {
    resizeTodoTextareaElement(textarea);
  }
}

interface TodoFocusSnapshot {
  index: number;
  selectionStart: number;
  selectionEnd: number;
  scrollTop: number;
}

function getFocusedTodoSnapshot() {
  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLTextAreaElement)) {
    return null;
  }

  if (activeElement.dataset.todoTextarea !== "true") {
    return null;
  }

  const index = Number.parseInt(activeElement.dataset.todoIndex ?? "", 10);
  if (!Number.isInteger(index) || index < 0) {
    return null;
  }

  return {
    index,
    selectionStart: activeElement.selectionStart,
    selectionEnd: activeElement.selectionEnd,
    scrollTop: activeElement.scrollTop
  } satisfies TodoFocusSnapshot;
}

function restoreTodoFocus(snapshot: TodoFocusSnapshot | null) {
  if (!snapshot) {
    return;
  }

  const selector = `textarea[data-todo-textarea="true"][data-todo-index="${String(snapshot.index)}"]`;
  const textarea = document.querySelector<HTMLTextAreaElement>(selector);
  if (!textarea) {
    return;
  }

  textarea.focus();

  const maxSelectionIndex = textarea.value.length;
  const selectionStart = Math.min(snapshot.selectionStart, maxSelectionIndex);
  const selectionEnd = Math.min(snapshot.selectionEnd, maxSelectionIndex);
  textarea.setSelectionRange(selectionStart, selectionEnd);
  textarea.scrollTop = snapshot.scrollTop;
}

function persistTodoEntries(entries: string[], version: number) {
  if (!projectPath.value) {
    return;
  }

  const path = projectPath.value;
  const operation = async () => {
    await saveTodoEntries(path, entries);

    if (projectPath.value === path && version > todoPersistedVersion) {
      todoPersistedVersion = version;
    }
  };

  todoPersistQueue = todoPersistQueue.then(operation, operation);
}

async function loadTodoEntriesForProject(path: string, source: "project-open" | "settings-watch") {
  const loadToken = todoEntriesLoadToken + 1;
  todoEntriesLoadToken = loadToken;
  const entries = await loadTodoEntries(path);

  if (projectPath.value !== path || todoEntriesLoadToken !== loadToken) {
    return;
  }

  // Ignore watcher reloads while there are newer local edits in-flight.
  if (source === "settings-watch" && todoDraftEditVersion > todoPersistedVersion) {
    return;
  }

  const focusedTodoSnapshot = getFocusedTodoSnapshot();
  const nextDrafts = getNormalizedTodoDrafts(entries);
  if (areStringArraysEqual(todoDrafts.value, nextDrafts)) {
    void nextTick(() => {
      resizeTodoTextareas();
      restoreTodoFocus(focusedTodoSnapshot);
    });
    return;
  }

  todoDrafts.value = nextDrafts;
  void nextTick(() => {
    resizeTodoTextareas();
    restoreTodoFocus(focusedTodoSnapshot);
  });
}

function handleTodoTextareaInput(index: number, event: Event) {
  const textarea = event.target;
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return;
  }

  if (index < 0 || index >= todoDrafts.value.length) {
    return;
  }

  const nextDrafts = [...todoDrafts.value];
  nextDrafts[index] = textarea.value;
  todoDraftEditVersion += 1;
  todoDrafts.value = getNormalizedTodoDrafts(nextDrafts);
  resizeTodoTextareaElement(textarea);
  void nextTick(() => {
    resizeTodoTextareas();
  });
}

function handleTodoTextareaBlur() {
  if (todoDraftEditVersion <= todoPersistedVersion) {
    return;
  }

  persistTodoEntries(getPersistedTodoEntries(todoDrafts.value), todoDraftEditVersion);
}

async function persistTerminalInputHistory() {
  if (!projectPath.value) {
    return;
  }

  await saveTerminalInputHistory(
    projectPath.value,
    terminalInputHistory.value,
    TERMINAL_INPUT_HISTORY_LIMIT
  );
}

function moveTextareaCursorToEnd() {
  void nextTick(() => {
    const textarea = terminalInputTextarea.value;
    if (!textarea) {
      return;
    }

    const cursorPosition = textarea.value.length;
    textarea.focus();
    textarea.setSelectionRange(cursorPosition, cursorPosition);
  });
}

function setTerminalInputText(text: string) {
  terminalInputText.value = text;
  moveTextareaCursorToEnd();
}

function resetTerminalInputHistoryNavigation() {
  terminalInputHistoryIndex.value = null;
  terminalInputDraft.value = "";
}

function appendTerminalInputHistory(text: string) {
  const lastEntry = terminalInputHistory.value[terminalInputHistory.value.length - 1];
  if (lastEntry === text) {
    resetTerminalInputHistoryNavigation();
    return;
  }

  terminalInputHistory.value = [...terminalInputHistory.value, text].slice(
    -TERMINAL_INPUT_HISTORY_LIMIT
  );
  void persistTerminalInputHistory();
  resetTerminalInputHistoryNavigation();
}

function isCursorOnFirstLine(textarea: HTMLTextAreaElement) {
  return !textarea.value.slice(0, textarea.selectionStart).includes("\n");
}

function isCursorOnLastLine(textarea: HTMLTextAreaElement) {
  return !textarea.value.slice(textarea.selectionEnd).includes("\n");
}

function navigateTerminalInputHistory(direction: -1 | 1) {
  if (terminalInputHistory.value.length === 0) {
    return;
  }

  if (terminalInputHistoryIndex.value === null) {
    if (direction === 1) {
      return;
    }

    terminalInputDraft.value = terminalInputText.value;
    terminalInputHistoryIndex.value = terminalInputHistory.value.length - 1;
    setTerminalInputText(terminalInputHistory.value[terminalInputHistoryIndex.value]);
    return;
  }

  const nextIndex = terminalInputHistoryIndex.value + direction;
  if (nextIndex < 0) {
    terminalInputHistoryIndex.value = 0;
    setTerminalInputText(terminalInputHistory.value[0]);
    return;
  }

  if (nextIndex >= terminalInputHistory.value.length) {
    terminalInputHistoryIndex.value = null;
    setTerminalInputText(terminalInputDraft.value);
    return;
  }

  terminalInputHistoryIndex.value = nextIndex;
  setTerminalInputText(terminalInputHistory.value[nextIndex]);
}

function getCsiModifierValue(event: KeyboardEvent) {
  let modifier = 1;
  if (event.shiftKey) {
    modifier += 1;
  }
  if (event.altKey) {
    modifier += 2;
  }
  if (event.ctrlKey) {
    modifier += 4;
  }
  return modifier;
}

const nativeTextareaCtrlEditingCodes = new Set([
  "KeyA",
  "KeyC",
  "KeyV",
  "KeyX",
  "KeyY",
  "KeyZ",
  "Insert",
]);

function getCtrlCharacterInput(event: KeyboardEvent) {
  if (/^Key[A-Z]$/.test(event.code)) {
    const code = event.code.charCodeAt(3) - 64;
    return String.fromCharCode(code);
  }

  switch (event.code) {
    case "Digit2":
    case "Backquote":
    case "Space":
      return "\u0000";
    case "Digit3":
    case "BracketLeft":
      return "\u001b";
    case "Digit4":
    case "Backslash":
      return "\u001c";
    case "Digit5":
    case "BracketRight":
      return "\u001d";
    case "Digit6":
      return "\u001e";
    case "Digit7":
    case "Minus":
    case "Slash":
      return "\u001f";
    case "Digit8":
      return "\u007f";
    default:
      return null;
  }
}

function getCtrlSpecialKeyInput(event: KeyboardEvent) {
  const modifier = getCsiModifierValue(event);
  switch (event.key) {
    case "ArrowUp":
      return `\u001b[1;${String(modifier)}A`;
    case "ArrowDown":
      return `\u001b[1;${String(modifier)}B`;
    case "ArrowRight":
      return `\u001b[1;${String(modifier)}C`;
    case "ArrowLeft":
      return `\u001b[1;${String(modifier)}D`;
    case "Home":
      return `\u001b[1;${String(modifier)}H`;
    case "End":
      return `\u001b[1;${String(modifier)}F`;
    case "Insert":
      return `\u001b[2;${String(modifier)}~`;
    case "Delete":
      return `\u001b[3;${String(modifier)}~`;
    case "PageUp":
      return `\u001b[5;${String(modifier)}~`;
    case "PageDown":
      return `\u001b[6;${String(modifier)}~`;
    case "F1":
      return `\u001b[1;${String(modifier)}P`;
    case "F2":
      return `\u001b[1;${String(modifier)}Q`;
    case "F3":
      return `\u001b[1;${String(modifier)}R`;
    case "F4":
      return `\u001b[1;${String(modifier)}S`;
    case "F5":
      return `\u001b[15;${String(modifier)}~`;
    case "F6":
      return `\u001b[17;${String(modifier)}~`;
    case "F7":
      return `\u001b[18;${String(modifier)}~`;
    case "F8":
      return `\u001b[19;${String(modifier)}~`;
    case "F9":
      return `\u001b[20;${String(modifier)}~`;
    case "F10":
      return `\u001b[21;${String(modifier)}~`;
    case "F11":
      return `\u001b[23;${String(modifier)}~`;
    case "F12":
      return `\u001b[24;${String(modifier)}~`;
    case "Enter":
      return "\r";
    case "Backspace":
      return "\u007f";
    case "Escape":
    case "Esc":
      return "\u001b";
    default:
      return null;
  }
}

function getCtrlKeyInput(event: KeyboardEvent) {
  const controlCharacter = getCtrlCharacterInput(event);
  if (controlCharacter !== null) {
    return event.altKey ? `\u001b${controlCharacter}` : controlCharacter;
  }

  return getCtrlSpecialKeyInput(event);
}

function isTextareaNativeEditingShortcut(event: KeyboardEvent) {
  if (event.metaKey) {
    return true;
  }

  if (event.altKey) {
    return false;
  }

  if (event.ctrlKey) {
    return nativeTextareaCtrlEditingCodes.has(event.code);
  }

  return (
    event.shiftKey &&
    (event.code === "Insert" || event.code === "Delete")
  );
}

function getEmptyTextareaPassthroughInput(
  event: KeyboardEvent,
  textarea: HTMLTextAreaElement
) {
  if (textarea.value.trim().length > 0 || event.isComposing) {
    return null;
  }

  if (isTextareaNativeEditingShortcut(event)) {
    return null;
  }

  if (event.ctrlKey) {
    return getCtrlKeyInput(event);
  }

  if (event.altKey || event.shiftKey) {
    return null;
  }

  switch (event.key) {
    case "Escape":
    case "Esc":
      return "\u001b";
    case "Enter":
      return "\r";
    case "Backspace":
      return "\u007f";
    case "Delete":
      return "\u001b[3~";
    default:
      return null;
  }
}

function handleTextareaKeydown(event: KeyboardEvent) {
  const textarea =
    event.currentTarget instanceof HTMLTextAreaElement ? event.currentTarget : null;

  if (textarea && !event.isComposing && (event.key === "Escape" || event.key === "Esc")) {
    event.preventDefault();
    void sendTerminalInput("\u001b", "Failed to send Esc to terminal.");
    return;
  }

  if (
    textarea &&
    !event.isComposing &&
    event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    event.code === "KeyC" &&
    textarea.selectionStart === textarea.selectionEnd
  ) {
    const ctrlCInput = getCtrlKeyInput(event) ?? "\u0003";
    event.preventDefault();
    void sendTerminalInput(ctrlCInput, "Failed to send Ctrl+C to terminal.");
    return;
  }

  if (textarea) {
    const passthroughInput = getEmptyTextareaPassthroughInput(event, textarea);
    if (passthroughInput !== null) {
      event.preventDefault();
      void sendTerminalInput(passthroughInput, "Failed to send keyboard input to terminal.");
      return;
    }
  }

  if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
    event.preventDefault();
    void sendTextareaToTerminal();
    return;
  }

  if (
    !textarea ||
    event.isComposing ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    textarea.selectionStart !== textarea.selectionEnd
  ) {
    return;
  }

  if (event.key === "ArrowUp" && isCursorOnFirstLine(textarea)) {
    event.preventDefault();
    navigateTerminalInputHistory(-1);
    return;
  }

  if (event.key === "ArrowDown" && isCursorOnLastLine(textarea)) {
    event.preventDefault();
    navigateTerminalInputHistory(1);
  }
}

function handleTextareaInput(event: Event) {
  const textarea =
    event.currentTarget instanceof HTMLTextAreaElement ? event.currentTarget : null;
  if (textarea) {
    resizeAutoHeightTextareaElement(textarea);
  }

  if (terminalInputHistoryIndex.value === null) {
    return;
  }

  terminalInputHistoryIndex.value = null;
  terminalInputDraft.value = terminalInputText.value;
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getSlashCommandText(text: string) {
  const withoutTrailingLineBreaks = text.replace(/[\r\n]+$/, "");
  const trimmedStart = withoutTrailingLineBreaks.trimStart();
  if (!trimmedStart.startsWith("/") || /[\r\n]/.test(trimmedStart)) {
    return null;
  }

  return trimmedStart;
}

function enqueueTerminalOperation<T>(operation: () => Promise<T>) {
  const queuedOperation = terminalInputQueue.then(operation, operation);
  terminalInputQueue = queuedOperation.then(
    () => undefined,
    () => undefined
  );
  return queuedOperation;
}

async function sendTerminalInput(data: string, fallbackErrorMessage: string) {
  return enqueueTerminalOperation(async () => {
    try {
      const response = await window.projectApi.terminal.input(data);
      if (!response.ok) {
        errorMessage.value = response.error ?? fallbackErrorMessage;
        return false;
      }
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : fallbackErrorMessage;
      return false;
    }

    return true;
  });
}

async function sendTextareaTextInput(text: string) {
  for (let index = 0; index < text.length; index += TERMINAL_INPUT_CHUNK_SIZE) {
    const chunk = text.slice(index, index + TERMINAL_INPUT_CHUNK_SIZE);
    const ok = await sendTerminalInput(chunk, "Failed to send input to terminal.");
    if (!ok) {
      return false;
    }
  }

  return true;
}

async function waitForTextareaSubmitReadiness(versionBeforeTextSend: number) {
  const timings = projectSettings.value.slashCommand;
  const activityTimeoutMs = Math.min(
    timings.activityTimeoutMs,
    TEXTAREA_SUBMIT_ACTIVITY_TIMEOUT_CAP_MS
  );
  const quietTimeoutMs = Math.min(
    timings.quietTimeoutMs,
    TEXTAREA_SUBMIT_QUIET_TIMEOUT_CAP_MS
  );

  const sawActivity = await waitForTerminalDataAfter(versionBeforeTextSend, activityTimeoutMs);
  if (!sawActivity) {
    await delay(timings.enterDelayMs);
    return;
  }

  await waitForTerminalQuiet(timings.enterDelayMs, quietTimeoutMs);
}

async function waitForTerminalDataAfter(version: number, timeoutMs: number) {
  const startedAt = Date.now();
  const pollIntervalMs = Math.max(projectSettings.value.slashCommand.dataPollIntervalMs, 1);
  while (Date.now() - startedAt < timeoutMs) {
    if (terminalDataVersion > version) {
      return true;
    }

    await delay(pollIntervalMs);
  }

  return terminalDataVersion > version;
}

async function waitForTerminalQuiet(idleMs: number, timeoutMs: number) {
  const startedAt = Date.now();
  let observedVersion = terminalDataVersion;
  while (Date.now() - startedAt < timeoutMs) {
    await delay(idleMs);
    if (terminalDataVersion === observedVersion) {
      return;
    }
    observedVersion = terminalDataVersion;
  }
}

async function waitForSlashCommandReadiness(versionBeforeSlashSend: number) {
  const timings = projectSettings.value.slashCommand;
  const readinessStartedAt = Date.now();
  const sawActivity = await waitForTerminalDataAfter(
    versionBeforeSlashSend,
    timings.activityTimeoutMs
  );
  const elapsedMs = Date.now() - readinessStartedAt;
  const remainingAfterSlashDelayMs = timings.afterSlashDelayMs - elapsedMs;
  if (remainingAfterSlashDelayMs > 0) {
    await delay(remainingAfterSlashDelayMs);
  }

  if (!sawActivity) {
    return;
  }

  await waitForTerminalQuiet(timings.enterDelayMs, timings.quietTimeoutMs);
}

async function sendSlashCommand(slashCommandText: string) {
  const timings = projectSettings.value.slashCommand;
  for (let index = 0; index < slashCommandText.length; index += 1) {
    const char = slashCommandText[index];
    const versionBeforeSend = terminalDataVersion;
    const ok = await sendTerminalInput(char, "Failed to send slash command character to terminal.");
    if (!ok) {
      return false;
    }

    if (char === "/") {
      await waitForSlashCommandReadiness(versionBeforeSend);
      continue;
    }

    await delay(timings.charDelayMs);
  }

  await waitForTerminalQuiet(timings.enterDelayMs, timings.quietTimeoutMs);
  return sendTerminalInput("\r", "Failed to send Enter to terminal.");
}

type SubmitTerminalTextResult = "submitted" | "empty" | "failed";

interface SubmitTerminalTextMessages {
  sendSlash: string;
  sendText: string;
  submit: string;
}

async function submitTerminalText(
  rawText: string,
  messages: SubmitTerminalTextMessages
): Promise<SubmitTerminalTextResult> {
  const slashCommandText = getSlashCommandText(rawText);
  if (slashCommandText) {
    const ok = await sendSlashCommand(slashCommandText);
    if (!ok) {
      errorMessage.value ||= messages.sendSlash;
      return "failed";
    }

    return "submitted";
  }

  const cleanedText = rawText.replace(/[\r\n]+$/, "");
  if (!cleanedText.trim()) {
    return "empty";
  }

  const versionBeforeTextSend = terminalDataVersion;
  const inputOk = await sendTextareaTextInput(cleanedText);
  if (!inputOk) {
    errorMessage.value ||= messages.sendText;
    return "failed";
  }

  await waitForTextareaSubmitReadiness(versionBeforeTextSend);

  const enterOk = await sendTerminalInput("\r", messages.submit);
  if (!enterOk) {
    return "failed";
  }

  return "submitted";
}

function initializeTerminalView() {
  if (terminal || !terminalContainer.value) {
    return;
  }

  terminal = new Terminal({
    convertEol: true,
    cursorBlink: true,
    fontFamily: "Cascadia Mono, Consolas, monospace",
    fontSize: 14,
    theme: {
      background: "#05070d",
      foreground: "#e5e7eb",
      cursor: "#e5e7eb"
    }
  });

  fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.open(terminalContainer.value);
  fitAddon.fit();
  terminal.writeln("Терминал готов. Выберите папку проекта.");

  terminal.onData((data) => {
    if (!isTerminalReady.value) {
      return;
    }

    void sendTerminalInput(data, "Failed to send input to terminal.");
  });
}

function focusTerminal() {
  terminal?.focus();
}

function focusTerminalInput() {
  void nextTick(() => {
    terminalInputTextarea.value?.focus();
  });
}

async function resizeTerminalBackend() {
  if (!terminal || !fitAddon) {
    return;
  }

  fitAddon.fit();

  if (!isTerminalReady.value) {
    return;
  }

  const response = await window.projectApi.terminal.resize({
    cols: terminal.cols,
    rows: terminal.rows
  });

  if (!response.ok) {
    console.error(response.error ?? "Не удалось изменить размер терминала.");
  }
}

async function startTerminal(cwd: string) {
  isTerminalReady.value = false;
  initializeTerminalView();

  if (!terminal || !fitAddon) {
    throw new Error("Не удалось подготовить окно терминала.");
  }

  fitAddon.fit();
  terminal.clear();
  terminalDataVersion = 0;
  terminalInputQueue = Promise.resolve();

  const response = await window.projectApi.terminal.start(cwd, {
    cols: terminal.cols,
    rows: terminal.rows
  });
  if (!response.ok) {
    throw new Error(response.error ?? "Не удалось запустить терминал.");
  }

  isTerminalReady.value = true;
  focusTerminal();
}

async function openProject(path: string) {
  projectPath.value = path;
  selectedFilePath.value = null;
  terminalInputText.value = "";
  terminalInputHistory.value = [];
  todoDrafts.value = [""];
  todoDraftEditVersion = 0;
  todoPersistedVersion = 0;
  todoPersistQueue = Promise.resolve();
  resetTerminalInputHistoryNavigation();
  toolbarConfig.value = await loadToolbarConfig(path);
  projectSettings.value = await loadProjectSettings(path);
  await loadTerminalInputHistoryForProject(path);
  await loadTodoEntriesForProject(path, "project-open");
  await startSettingsWatcher(path);
  await nextTick();
  await startTerminal(path);
  setLastProjectPathInStorage(path);
}

async function openProjectFolder() {
  isOpening.value = true;
  errorMessage.value = "";

  try {
    const selectedPath = await window.projectApi.openFolder();
    if (!selectedPath) {
      return;
    }

    await openProject(selectedPath);
  } catch (error) {
    isTerminalReady.value = false;
    errorMessage.value = "Не удалось открыть проект или запустить терминал.";
    console.error(error);
  } finally {
    isOpening.value = false;
  }
}

async function openLastProjectOnStartup() {
  const lastProjectPath = getLastProjectPathFromStorage();
  if (!lastProjectPath) {
    return;
  }

  isOpening.value = true;
  errorMessage.value = "";

  try {
    await openProject(lastProjectPath);
  } catch (error) {
    clearLastProjectPathInStorage();
    projectPath.value = null;
    selectedFilePath.value = null;
    terminalInputText.value = "";
    terminalInputHistory.value = [];
    todoDrafts.value = [""];
    todoDraftEditVersion = 0;
    todoPersistedVersion = 0;
    todoPersistQueue = Promise.resolve();
    resetTerminalInputHistoryNavigation();
    toolbarConfig.value = defaultToolbarConfig;
    projectSettings.value = defaultProjectSettings;
    isTerminalReady.value = false;
    await window.projectApi.settings.unwatch();
    errorMessage.value = "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0442\u043a\u0440\u044b\u0442\u044c \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0439 \u043f\u0440\u043e\u0435\u043a\u0442. \u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043f\u0430\u043f\u043a\u0443 \u0432\u0440\u0443\u0447\u043d\u0443\u044e.";
    console.error(error);
  } finally {
    isOpening.value = false;
  }
}

async function runTerminalCommand(command: string) {
  if (!isTerminalReady.value) {
    errorMessage.value = "Terminal is not ready to run commands.";
    return;
  }

  errorMessage.value = "";
  const result = await submitTerminalText(command, {
    sendSlash: "Failed to send slash command to terminal.",
    sendText: "Failed to send command text to terminal.",
    submit: "Failed to submit command in terminal."
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

  if (action.type === "run-command") {
    void runTerminalCommand(action.command);
    return;
  }

  void sendTerminalInput(action.input, "Failed to send input to terminal.");
}

function handleFileSelect(path: string) {
  selectedFilePath.value = path;
}

function sendQuickKey(data: string) {
  if (!isTerminalReady.value) {
    return;
  }

  void sendTerminalInput(data, "Failed to send quick key to terminal.");
}

function handleToolbarConfigSave(config: ToolbarConfig) {
  toolbarConfig.value = config;
  if (projectPath.value) {
    void saveToolbarConfig(projectPath.value, config);
  }
  isToolbarConfigEditorOpen.value = false;
}

function handleProjectSettingsSave(settings: ProjectSettings) {
  projectSettings.value = settings;
  if (projectPath.value) {
    void saveProjectSettings(projectPath.value, settings);
  }
  isProjectSettingsEditorOpen.value = false;
}

async function handleSettingsFileChanged(filename: string) {
  if (!projectPath.value) {
    return;
  }

  const normalizedFilename = filename.split(/[\\/]/).pop() ?? filename;

  if (
    normalizedFilename === TOOLBAR_CONFIG_FILENAME ||
    normalizedFilename === LEGACY_TOOLBAR_CONFIG_FILENAME
  ) {
    toolbarConfig.value = await loadToolbarConfig(projectPath.value);
  }

  if (normalizedFilename === PROJECT_SETTINGS_FILENAME) {
    projectSettings.value = await loadProjectSettings(projectPath.value);
  }

  if (normalizedFilename === TODO_FILENAME) {
    await loadTodoEntriesForProject(projectPath.value, "settings-watch");
  }
}

async function startSettingsWatcher(path: string) {
  unsubscribeSettingsFileChanged?.();
  await window.projectApi.settings.unwatch();

  unsubscribeSettingsFileChanged = window.projectApi.settings.onFileChanged(
    (filename) => void handleSettingsFileChanged(filename)
  );

  await window.projectApi.settings.watch(path, SETTINGS_WATCH_ALL);
}

async function sendAltVToTerminal(shouldFocusTerminal = true) {
  if (!isTerminalReady.value) {
    errorMessage.value = "Terminal is not ready.";
    return;
  }

  errorMessage.value = "";
  const ok = await sendTerminalInput("\u001bv", "Failed to send Alt+V to terminal.");
  if (!ok) {
    return;
  }

  if (shouldFocusTerminal) {
    focusTerminal();
  }
}

async function sendTextareaToTerminal() {
  if (!isTerminalReady.value) {
    errorMessage.value = "Terminal is not ready to send input.";
    return;
  }

  const text = terminalInputText.value;
  if (!text.trim()) {
    return;
  }

  errorMessage.value = "";
  const result = await submitTerminalText(text, {
    sendSlash: "Failed to send slash command to terminal.",
    sendText: "Failed to send input to terminal.",
    submit: "Failed to send Enter to terminal."
  });
  if (result !== "submitted") {
    return;
  }

  appendTerminalInputHistory(text);
  terminalInputText.value = "";
  focusTerminalInput();
}

async function sendTodoEntryToTerminal(index: number) {
  if (!isTerminalReady.value) {
    errorMessage.value = "Terminal is not ready to send input.";
    return;
  }

  const text = todoDrafts.value[index];
  if (typeof text !== "string" || !text.trim()) {
    return;
  }

  errorMessage.value = "";
  const result = await submitTerminalText(text, {
    sendSlash: "Failed to send slash command from todo to terminal.",
    sendText: "Failed to send todo prompt to terminal.",
    submit: "Failed to send Enter to terminal."
  });
  if (result !== "submitted") {
    return;
  }

  appendTerminalInputHistory(text);
}

async function handleTextareaPaste(event: ClipboardEvent) {
  const textarea =
    event.currentTarget instanceof HTMLTextAreaElement ? event.currentTarget : null;
  const clipboardData = event.clipboardData;
  if (!clipboardData) {
    return;
  }

  const hasImageItem = Array.from(clipboardData.items).some((item) =>
    item.type.startsWith("image/")
  );
  const hasImageFile = Array.from(clipboardData.files).some((file) =>
    file.type.startsWith("image/")
  );

  if (!hasImageItem && !hasImageFile) {
    return;
  }

  event.preventDefault();
  terminalInputText.value = "";
  try {
    await sendAltVToTerminal(false);
  } finally {
    textarea?.focus();
  }
}

onMounted(() => {
  unsubscribeTerminalData = window.projectApi.terminal.onData((data) => {
    terminalDataVersion += 1;
    terminal?.write(data);
  });

  unsubscribeTerminalExit = window.projectApi.terminal.onExit((code) => {
    isTerminalReady.value = false;
    terminal?.writeln(`\r\n[terminal exited: ${String(code ?? "unknown")}]`);
  });

  const handleWindowResize = () => {
    resizeTodoTextareas();
    resizeTerminalInputTextareaElement();
    void resizeTerminalBackend();
  };

  window.addEventListener("resize", handleWindowResize);
  removeWindowResizeListener = () => {
    window.removeEventListener("resize", handleWindowResize);
  };

  unsubscribeGlobalQuickKey = window.projectApi.onGlobalQuickKey((input) => {
    sendQuickKey(input);
  });

  void nextTick(() => {
    resizeTerminalInputTextareaElement();
  });

  void openLastProjectOnStartup();
});

watch(terminalInputText, () => {
  void nextTick(() => {
    resizeTerminalInputTextareaElement();
  });
});

watch(isTodoPanelCollapsed, (isCollapsed) => {
  persistTodoPanelCollapsedState(isCollapsed);

  if (!isCollapsed) {
    void nextTick(() => {
      resizeTodoTextareas();
    });
  }
});

onBeforeUnmount(() => {
  unsubscribeTerminalData?.();
  unsubscribeTerminalExit?.();
  unsubscribeGlobalQuickKey?.();
  unsubscribeSettingsFileChanged?.();
  removeWindowResizeListener?.();
  void window.projectApi.settings.unwatch();
  void window.projectApi.terminal.stop();
  terminal?.dispose();
  terminal = null;
  fitAddon = null;
});

</script>

<style scoped>
.terminal-host :deep(.xterm) {
  height: 100%;
  padding: 0.4rem;
}

.terminal-host :deep(.xterm-viewport) {
  overflow-y: auto;
}
</style>
