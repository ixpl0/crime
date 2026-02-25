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
        class="grid min-h-0 flex-1 gap-4"
        :class="{ 'lg:grid-cols-[14rem_minmax(0,1fr)]': !isTodoPanelCollapsed }"
      >
        <aside v-if="!isTodoPanelCollapsed" class="card min-h-0 bg-base-100 shadow-xl">
          <div class="card-body min-h-0 p-3">
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
                <EyeOff :size="14" class="opacity-60" />
              </button>
            </div>
            <div class="todo-list-scroll mt-2 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
              <div
                v-for="todoDraftView in todoDraftViewItems"
                :key="`todo-draft-${todoDraftView.index}`"
                class="space-y-1 rounded-lg border border-transparent p-1 transition-colors"
                :class="{
                  'border-primary/40 bg-primary/10':
                    todoDragOverIndex === todoDraftView.index &&
                    todoDragSourceIndex !== null &&
                    todoDragSourceIndex !== todoDraftView.index
                }"
                @dragenter.prevent="handleTodoDragEnter(todoDraftView.index, $event)"
                @dragover.prevent="handleTodoDragOver(todoDraftView.index, $event)"
                @drop.prevent="handleTodoDrop(todoDraftView.index, $event)"
              >
                <textarea
                  :value="todoDraftView.value"
                  data-todo-textarea="true"
                  :data-todo-index="todoDraftView.index"
                  class="textarea textarea-autosize-native textarea-bordered h-auto min-h-0 w-full resize-none overflow-y-hidden text-sm leading-relaxed"
                  rows="1"
                  placeholder="&#1055;&#1088;&#1086;&#1084;&#1087;&#1090;"
                  @input="handleTodoTextareaInput(todoDraftView.index, $event)"
                  @keydown="handleTodoTextareaKeydown"
                  @blur="handleTodoTextareaBlur"
                />
                <div class="flex items-center gap-2">
                  <button
                    v-if="shouldShowTodoDragHandle(todoDraftView.index)"
                    class="btn btn-ghost btn-xs btn-square cursor-grab text-base-content/60 active:cursor-grabbing"
                    type="button"
                    :draggable="canDragTodoDraft(todoDraftView.index)"
                    :disabled="!canDragTodoDraft(todoDraftView.index)"
                    title="Drag to reorder"
                    @dragstart="handleTodoDragStart(todoDraftView.index, $event)"
                    @dragend="handleTodoDragEnd"
                  >
                    <GripVertical :size="14" />
                  </button>
                  <button
                    class="btn btn-ghost btn-xs ml-auto normal-case text-base-content/70"
                    type="button"
                    :disabled="!isTerminalReady || !todoDraftView.value.trim()"
                    @click="sendTodoEntryToTerminal(todoDraftView.index)"
                  >
                    &#1054;&#1090;&#1087;&#1088;&#1072;&#1074;&#1080;&#1090;&#1100;
                  </button>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <div class="card min-h-0 bg-base-100 shadow-xl">
          <div class="card-body flex min-h-0 flex-col gap-4">
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

          <div v-show="activeTab === 'agent'" class="min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
            <ToolbarPanel
              :toolbar-config="toolbarConfig"
              :is-terminal-ready="isTerminalReady"
              @execute-action="executeToolbarAction"
              @open-config-editor="isToolbarConfigEditorOpen = true"
            />

            <div
              ref="terminalContainer"
              class="terminal-host h-96 w-full overflow-hidden rounded-box border border-base-300 bg-[#05070d]"
              @click="focusTerminal"
              @contextmenu="handleTerminalContextMenu"
              @auxclick="handleTerminalAuxClick"
            />

            <form class="flex min-w-0 gap-3" @submit.prevent="sendTextareaToTerminal">
              <div class="flex min-w-0 flex-1 flex-col gap-2">
                <textarea
                  ref="terminalInputTextarea"
                  v-model="terminalInputText"
                  class="textarea textarea-autosize-native textarea-bordered h-auto min-h-0 w-full resize-none overflow-y-hidden"
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
          <div v-show="activeTab === 'files'" class="min-h-0 flex-1 overflow-y-auto px-1">
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
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { type ToolbarAction, type ToolbarConfig } from "./types/toolbar";
import {
  loadToolbarConfig,
  saveToolbarConfig,
  TOOLBAR_CONFIG_FILENAME
} from "./toolbar/toolbar-storage";
import { defaultToolbarConfig } from "./toolbar/default-toolbar-config";
import { type ProjectSettings } from "./types/project-settings";
import {
  DEFAULT_IDE_ZOOM_FACTOR,
  DEFAULT_TERMINAL_FONT_SIZE,
  defaultProjectSettings,
  IDE_ZOOM_FACTOR_MAX,
  IDE_ZOOM_FACTOR_MIN,
  IDE_ZOOM_FACTOR_STEP,
  loadProjectSettings,
  PROJECT_SETTINGS_FILENAME,
  saveProjectSettings,
  TERMINAL_FONT_SIZE_MAX,
  TERMINAL_FONT_SIZE_MIN,
  TERMINAL_FONT_SIZE_STEP
} from "./settings/project-settings-storage";
import {
  loadTerminalInputHistory as loadTerminalInputHistoryFromProject,
  saveTerminalInputHistory,
  TERMINAL_INPUT_HISTORY_FILENAME
} from "./settings/terminal-input-history-storage";
import { loadTodoEntries, saveTodoEntries, TODO_FILENAME } from "./settings/todo-storage";
import { useToolbarShortcuts } from "./composables/use-toolbar-shortcuts";
import { toContextualErrorMessage, toErrorMessage } from "./utils/fail-fast";
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
  EyeOff,
  GripVertical
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
const todoDragSourceIndex = ref<number | null>(null);
const todoDragOverIndex = ref<number | null>(null);
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

interface TodoDraftViewItem {
  index: number;
  value: string;
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

const todoDraftViewItems = computed<TodoDraftViewItem[]>(() =>
  todoDrafts.value.map((value, index) => ({ index, value })).reverse()
);

let terminal: Terminal | null = null;
let fitAddon: FitAddon | null = null;
let unsubscribeTerminalData: (() => void) | null = null;
let unsubscribeTerminalExit: (() => void) | null = null;
let removeWindowResizeListener: (() => void) | null = null;
let removeWindowWheelListener: (() => void) | null = null;
let removeWindowKeydownListener: (() => void) | null = null;
let removeWindowErrorListener: (() => void) | null = null;
let removeWindowUnhandledRejectionListener: (() => void) | null = null;
let unsubscribeGlobalQuickKey: (() => void) | null = null;
let unsubscribeSettingsFileChanged: (() => void) | null = null;
let pendingZoomResizeAnimationFrame: number | null = null;
let terminalDataVersion = 0;
let terminalInputQueue: Promise<void> = Promise.resolve();
let terminalInputHistoryLoadToken = 0;
let terminalInputHistoryEditVersion = 0;
let terminalInputHistoryPersistedVersion = 0;
let terminalInputHistoryPersistQueue: Promise<void> = Promise.resolve();
let terminalInputHistoryReloadPending = false;
let todoEntriesLoadToken = 0;
let todoDraftEditVersion = 0;
let todoPersistedVersion = 0;
let todoPersistQueue: Promise<void> = Promise.resolve();
let projectSettingsPersistQueue: Promise<void> = Promise.resolve();

useToolbarShortcuts(toolbarConfig, executeToolbarAction);

function reportUiError(context: string, error: unknown, fallbackMessage: string) {
  const message = toContextualErrorMessage(context, error, fallbackMessage);
  errorMessage.value = message;
  console.error(message, error);
  return message;
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

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeIdeZoomFactor(value: number) {
  const clampedValue = clampNumber(value, IDE_ZOOM_FACTOR_MIN, IDE_ZOOM_FACTOR_MAX);
  return Math.round(clampedValue * 100) / 100;
}

function normalizeTerminalFontSize(value: number) {
  return Math.round(clampNumber(value, TERMINAL_FONT_SIZE_MIN, TERMINAL_FONT_SIZE_MAX));
}

function scheduleTerminalResizeAfterZoom() {
  if (pendingZoomResizeAnimationFrame !== null) {
    window.cancelAnimationFrame(pendingZoomResizeAnimationFrame);
  }

  pendingZoomResizeAnimationFrame = window.requestAnimationFrame(() => {
    pendingZoomResizeAnimationFrame = null;
    void resizeTerminalBackend();

    window.requestAnimationFrame(() => {
      void resizeTerminalBackend();
    });
  });
}

function isWheelEventInsideTerminal(event: WheelEvent) {
  const container = terminalContainer.value;
  const target = event.target;
  if (!container || !(target instanceof Node)) {
    return false;
  }

  return container.contains(target);
}

function isTerminalHoveredOrFocused() {
  const container = terminalContainer.value;
  if (!container) {
    return false;
  }

  if (container.matches(":hover")) {
    return true;
  }

  const activeElement = document.activeElement;
  return activeElement instanceof Node && container.contains(activeElement);
}

function applyProjectZoomSettings(settings: ProjectSettings) {
  const ideZoomFactor = normalizeIdeZoomFactor(settings.zoom.ideZoomFactor);
  const terminalFontSize = normalizeTerminalFontSize(settings.zoom.terminalFontSize);
  const didSetIdeZoom = window.projectApi.zoom.setFactor(ideZoomFactor);
  let shouldResizeTerminal = false;

  if (!didSetIdeZoom) {
    reportUiError("Zoom", null, "Failed to apply IDE zoom factor.");
  }

  if (terminal && terminal.options.fontSize !== terminalFontSize) {
    terminal.options.fontSize = terminalFontSize;
    shouldResizeTerminal = true;
  }

  if (didSetIdeZoom || shouldResizeTerminal) {
    scheduleTerminalResizeAfterZoom();
  }
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

function updateProjectZoomSettings(nextZoom: Partial<ProjectSettings["zoom"]>) {
  const currentSettings = projectSettings.value;
  const currentZoom = currentSettings.zoom;
  const ideZoomFactor = normalizeIdeZoomFactor(nextZoom.ideZoomFactor ?? currentZoom.ideZoomFactor);
  const terminalFontSize = normalizeTerminalFontSize(
    nextZoom.terminalFontSize ?? currentZoom.terminalFontSize
  );

  if (
    ideZoomFactor === currentZoom.ideZoomFactor &&
    terminalFontSize === currentZoom.terminalFontSize
  ) {
    return;
  }

  const updatedSettings: ProjectSettings = {
    ...currentSettings,
    zoom: {
      ideZoomFactor,
      terminalFontSize
    }
  };
  projectSettings.value = updatedSettings;
  applyProjectZoomSettings(updatedSettings);
  persistProjectSettings(updatedSettings);
}

function isTerminalZoomResetShortcut(event: KeyboardEvent) {
  if (event.metaKey || event.altKey || event.shiftKey || !event.ctrlKey) {
    return false;
  }

  return event.code === "Digit0" || event.code === "Numpad0";
}

function handleBrowserZoomKeyboardShortcut(event: KeyboardEvent) {
  if (!isTerminalZoomResetShortcut(event)) {
    return;
  }

  event.preventDefault();
  if (isTerminalHoveredOrFocused()) {
    updateProjectZoomSettings({
      terminalFontSize: DEFAULT_TERMINAL_FONT_SIZE
    });
    return;
  }

  updateProjectZoomSettings({
    ideZoomFactor: DEFAULT_IDE_ZOOM_FACTOR
  });
}

function handleBrowserZoomCtrlWheel(event: WheelEvent) {
  if (!event.ctrlKey || event.metaKey || event.deltaY === 0) {
    return;
  }

  event.preventDefault();
  if (isWheelEventInsideTerminal(event)) {
    const terminalZoomDelta =
      event.deltaY < 0 ? TERMINAL_FONT_SIZE_STEP : -TERMINAL_FONT_SIZE_STEP;
    updateProjectZoomSettings({
      terminalFontSize: projectSettings.value.zoom.terminalFontSize + terminalZoomDelta
    });
    return;
  }

  const ideZoomDelta = event.deltaY < 0 ? IDE_ZOOM_FACTOR_STEP : -IDE_ZOOM_FACTOR_STEP;
  const currentIdeZoomFactor = normalizeIdeZoomFactor(window.projectApi.zoom.getFactor());
  updateProjectZoomSettings({
    ideZoomFactor: currentIdeZoomFactor + ideZoomDelta
  });
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

async function loadTerminalInputHistoryForProject(
  path: string,
  source: "project-open" | "settings-watch"
) {
  const loadToken = terminalInputHistoryLoadToken + 1;
  terminalInputHistoryLoadToken = loadToken;
  const history = await loadTerminalInputHistoryFromProject(path, TERMINAL_INPUT_HISTORY_LIMIT);

  if (projectPath.value !== path || terminalInputHistoryLoadToken !== loadToken) {
    return;
  }

  if (source === "settings-watch") {
    // Do not replace history while local updates are pending persistence.
    if (terminalInputHistoryEditVersion > terminalInputHistoryPersistedVersion) {
      terminalInputHistoryReloadPending = true;
      return;
    }

    // Do not disrupt active Up/Down history navigation state.
    if (terminalInputHistoryIndex.value !== null) {
      terminalInputHistoryReloadPending = true;
      return;
    }
  }

  terminalInputHistoryReloadPending = false;

  if (areStringArraysEqual(terminalInputHistory.value, history)) {
    if (source === "project-open") {
      resetTerminalInputHistoryNavigation();
    }
    return;
  }

  terminalInputHistory.value = history;
  if (source === "project-open") {
    resetTerminalInputHistoryNavigation();
  }
}

async function flushPendingTerminalInputHistoryReload() {
  if (
    !terminalInputHistoryReloadPending ||
    !projectPath.value ||
    terminalInputHistoryIndex.value !== null ||
    terminalInputHistoryEditVersion > terminalInputHistoryPersistedVersion
  ) {
    return;
  }

  terminalInputHistoryReloadPending = false;
  await loadTerminalInputHistoryForProject(projectPath.value, "settings-watch");
}

interface NormalizeTodoDraftsOptions {
  includePlaceholder?: boolean;
}

function getNormalizedTodoDrafts(
  entries: string[],
  options: NormalizeTodoDraftsOptions = {}
) {
  const includePlaceholder = options.includePlaceholder ?? true;
  const nonEmptyEntries = entries.filter((entry) => entry.trim().length > 0);
  if (nonEmptyEntries.length === 0) {
    return [""];
  }

  if (!includePlaceholder) {
    return nonEmptyEntries;
  }

  return [...nonEmptyEntries, ""];
}

function hasTodoDraftPlaceholder(entries: string[]) {
  return entries.some((entry) => entry.trim().length === 0);
}

function getPersistedTodoEntries(entries: string[]) {
  return entries.filter((entry) => entry.trim().length > 0);
}

function isTodoDraftIndexValid(index: number) {
  return index >= 0 && index < todoDrafts.value.length;
}

function canDragTodoDraft(index: number) {
  if (!isTodoDraftIndexValid(index)) {
    return false;
  }

  return todoDrafts.value[index].trim().length > 0;
}

function shouldShowTodoDragHandle(index: number) {
  if (!isTodoDraftIndexValid(index)) {
    return false;
  }

  return todoDrafts.value[index].trim().length > 0;
}

function resetTodoDragState() {
  todoDragSourceIndex.value = null;
  todoDragOverIndex.value = null;
}

function getTodoDragSourceIndex(event: DragEvent) {
  if (todoDragSourceIndex.value !== null) {
    return todoDragSourceIndex.value;
  }

  const rawSourceIndex = event.dataTransfer?.getData("text/plain") ?? "";
  const parsedSourceIndex = Number.parseInt(rawSourceIndex, 10);
  return Number.isInteger(parsedSourceIndex) ? parsedSourceIndex : null;
}

function handleTodoDragStart(index: number, event: DragEvent) {
  if (!canDragTodoDraft(index)) {
    event.preventDefault();
    return;
  }

  todoDragSourceIndex.value = index;
  todoDragOverIndex.value = index;

  if (!event.dataTransfer) {
    return;
  }

  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", String(index));
}

function handleTodoDragEnter(index: number, event: DragEvent) {
  if (todoDragSourceIndex.value === null || !isTodoDraftIndexValid(index)) {
    return;
  }

  event.preventDefault();
  todoDragOverIndex.value = index;
}

function handleTodoDragOver(index: number, event: DragEvent) {
  if (todoDragSourceIndex.value === null || !isTodoDraftIndexValid(index)) {
    return;
  }

  event.preventDefault();
  todoDragOverIndex.value = index;

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
}

function handleTodoDragEnd() {
  resetTodoDragState();
}

function handleTodoDrop(index: number, event: DragEvent) {
  if (!isTodoDraftIndexValid(index)) {
    resetTodoDragState();
    return;
  }

  const sourceIndex = getTodoDragSourceIndex(event);
  if (sourceIndex === null || !canDragTodoDraft(sourceIndex) || sourceIndex === index) {
    resetTodoDragState();
    return;
  }

  const focusedTodoSnapshot = getFocusedTodoSnapshot();
  const shouldIncludePlaceholder = hasTodoDraftPlaceholder(todoDrafts.value);
  const reorderedDrafts = [...todoDrafts.value];
  const [movedDraft] = reorderedDrafts.splice(sourceIndex, 1);
  if (typeof movedDraft !== "string" || movedDraft.trim().length === 0) {
    resetTodoDragState();
    return;
  }

  reorderedDrafts.splice(index, 0, movedDraft);

  todoDraftEditVersion += 1;
  todoDrafts.value = getNormalizedTodoDrafts(
    reorderedDrafts.filter((entry) => entry.trim().length > 0),
    { includePlaceholder: shouldIncludePlaceholder }
  );
  resetTodoDragState();

  const nextVersion = todoDraftEditVersion;
  persistTodoEntries(getPersistedTodoEntries(todoDrafts.value), nextVersion);

  void nextTick(() => {
    resizeTodoTextareas();
    restoreTodoFocus(focusedTodoSnapshot);
  });
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

function resizeTerminalInputTextareaElement() {
  const textarea = terminalInputTextarea.value;
  if (!textarea) {
    return;
  }

  textarea.style.removeProperty("height");
}

function resizeTodoTextareas() {
  const textareas = document.querySelectorAll<HTMLTextAreaElement>(
    'textarea[data-todo-textarea="true"]'
  );
  for (const textarea of textareas) {
    textarea.style.removeProperty("height");
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

function focusTodoTextareaByIndex(index: number) {
  const selector = `textarea[data-todo-textarea="true"][data-todo-index="${String(index)}"]`;
  const textarea = document.querySelector<HTMLTextAreaElement>(selector);
  if (!textarea) {
    return;
  }

  textarea.focus();
  const cursorPosition = textarea.value.length;
  textarea.setSelectionRange(cursorPosition, cursorPosition);
}

function focusTodoComposerTextarea() {
  const composerIndex = todoDrafts.value.length - 1;
  if (composerIndex < 0) {
    return;
  }

  focusTodoTextareaByIndex(composerIndex);
}

function finalizeTodoDraftEditing(options: { focusComposer?: boolean } = {}) {
  const nextDrafts = getNormalizedTodoDrafts(todoDrafts.value, { includePlaceholder: true });
  const didUpdateDrafts = !areStringArraysEqual(todoDrafts.value, nextDrafts);
  if (didUpdateDrafts) {
    todoDraftEditVersion += 1;
    todoDrafts.value = nextDrafts;
  }

  if (todoDraftEditVersion > todoPersistedVersion) {
    persistTodoEntries(getPersistedTodoEntries(todoDrafts.value), todoDraftEditVersion);
  }

  if (!didUpdateDrafts && !options.focusComposer) {
    return;
  }

  void nextTick(() => {
    if (didUpdateDrafts) {
      resizeTodoTextareas();
    }
    if (options.focusComposer) {
      focusTodoComposerTextarea();
    }
  });
}

function persistTodoEntries(entries: string[], version: number) {
  if (!projectPath.value) {
    return;
  }

  const path = projectPath.value;
  const operation = async () => {
    try {
      await saveTodoEntries(path, entries);
    } catch (error) {
      reportUiError("Todo entries", error, "Failed to persist todo entries.");
      return;
    }

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

  if (!isTodoDraftIndexValid(index)) {
    return;
  }

  const nextDrafts = [...todoDrafts.value];
  const previousValue = nextDrafts[index] ?? "";
  const hadPlaceholder = hasTodoDraftPlaceholder(todoDrafts.value);
  nextDrafts[index] = textarea.value;
  const isCompletedPlaceholder =
    previousValue.trim().length === 0 && textarea.value.trim().length > 0;
  const shouldIncludePlaceholder = hadPlaceholder && !isCompletedPlaceholder;
  const normalizedDrafts = getNormalizedTodoDrafts(nextDrafts, {
    includePlaceholder: shouldIncludePlaceholder
  });
  todoDraftEditVersion += 1;
  todoDrafts.value = normalizedDrafts;
}

function handleTodoTextareaKeydown(event: KeyboardEvent) {
  if (event.key !== "Enter" || (!event.ctrlKey && !event.metaKey)) {
    return;
  }

  event.preventDefault();
  finalizeTodoDraftEditing({ focusComposer: true });
}

function handleTodoTextareaBlur() {
  finalizeTodoDraftEditing();
}

function persistTerminalInputHistory(entries: string[], version: number) {
  if (!projectPath.value) {
    return;
  }

  const path = projectPath.value;
  const operation = async () => {
    try {
      await saveTerminalInputHistory(path, entries, TERMINAL_INPUT_HISTORY_LIMIT);
    } catch (error) {
      reportUiError(
        "Terminal history",
        error,
        "Failed to persist terminal input history."
      );
      return;
    }

    if (projectPath.value === path && version > terminalInputHistoryPersistedVersion) {
      terminalInputHistoryPersistedVersion = version;
    }

    if (projectPath.value === path) {
      await flushPendingTerminalInputHistoryReload();
    }
  };

  terminalInputHistoryPersistQueue = terminalInputHistoryPersistQueue.then(operation, operation);
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

  const nextHistory = [...terminalInputHistory.value, text].slice(
    -TERMINAL_INPUT_HISTORY_LIMIT
  );
  terminalInputHistoryEditVersion += 1;
  terminalInputHistory.value = nextHistory;
  persistTerminalInputHistory(nextHistory, terminalInputHistoryEditVersion);
  resetTerminalInputHistoryNavigation();
}

function isCursorOnFirstLine(textarea: HTMLTextAreaElement) {
  return !textarea.value.slice(0, textarea.selectionStart).includes("\n");
}

function parseCssPixelValue(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getComputedLineHeightPixels(style: CSSStyleDeclaration) {
  const parsedLineHeight = Number.parseFloat(style.lineHeight);
  if (Number.isFinite(parsedLineHeight)) {
    return parsedLineHeight;
  }

  const parsedFontSize = Number.parseFloat(style.fontSize);
  if (Number.isFinite(parsedFontSize)) {
    return parsedFontSize * 1.2;
  }

  return 16 * 1.2;
}

function isCursorOnFirstVisualLine(textarea: HTMLTextAreaElement) {
  if (textarea.selectionStart === 0) {
    return true;
  }

  const style = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");
  mirror.setAttribute("aria-hidden", "true");
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.pointerEvents = "none";
  mirror.style.top = "0";
  mirror.style.left = "-9999px";
  mirror.style.boxSizing = "border-box";
  mirror.style.width = `${String(textarea.clientWidth)}px`;
  mirror.style.padding = style.padding;
  mirror.style.font = style.font;
  mirror.style.lineHeight = style.lineHeight;
  mirror.style.letterSpacing = style.letterSpacing;
  mirror.style.wordSpacing = style.wordSpacing;
  mirror.style.textTransform = style.textTransform;
  mirror.style.textIndent = style.textIndent;
  mirror.style.textAlign = style.textAlign;
  mirror.style.tabSize = style.tabSize;
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "break-word";
  mirror.style.wordBreak = "break-word";

  mirror.textContent = textarea.value.slice(0, textarea.selectionStart);
  const caretMarker = document.createElement("span");
  caretMarker.textContent = "\u200b";
  mirror.appendChild(caretMarker);

  document.body.appendChild(mirror);
  try {
    const mirrorRect = mirror.getBoundingClientRect();
    const caretRect = caretMarker.getBoundingClientRect();
    const caretTop = caretRect.top - mirrorRect.top;
    const paddingTop = parseCssPixelValue(style.paddingTop);
    const lineHeightPixels = getComputedLineHeightPixels(style);
    return caretTop <= paddingTop + lineHeightPixels * 0.5;
  } finally {
    mirror.remove();
  }
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

  if (
    event.key === "ArrowUp" &&
    (terminalInputHistoryIndex.value === null
      ? isCursorOnFirstVisualLine(textarea)
      : isCursorOnFirstLine(textarea))
  ) {
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
    textarea.style.removeProperty("height");
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

interface SubmitTerminalTextAttemptOptions {
  notReady: string;
  messages: SubmitTerminalTextMessages;
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

async function attemptSubmitTerminalText(
  rawText: string,
  options: SubmitTerminalTextAttemptOptions
): Promise<SubmitTerminalTextResult> {
  if (!isTerminalReady.value) {
    errorMessage.value = options.notReady;
    return "failed";
  }

  if (!rawText.trim()) {
    return "empty";
  }

  errorMessage.value = "";
  return submitTerminalText(rawText, options.messages);
}

function initializeTerminalView() {
  if (terminal || !terminalContainer.value) {
    return;
  }

  terminal = new Terminal({
    convertEol: true,
    cursorBlink: true,
    cursorStyle: "bar",
    cursorInactiveStyle: "none",
    cursorWidth: 2,
    fontFamily: "Cascadia Mono, Consolas, monospace",
    fontSize: normalizeTerminalFontSize(projectSettings.value.zoom.terminalFontSize),
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

async function copyTerminalSelection(clickType: "right" | "middle") {
  if (!terminal) {
    return;
  }

  const selectedText = terminal.getSelection();
  if (selectedText.length === 0) {
    return;
  }

  try {
    const response = await window.projectApi.clipboard.writeText(selectedText);
    if (!response.ok) {
      reportUiError(
        "Terminal copy",
        response.error,
        `Failed to copy terminal selection with ${clickType} click.`
      );
    }
  } catch (error) {
    reportUiError(
      "Terminal copy",
      error,
      `Failed to copy terminal selection with ${clickType} click.`
    );
  }
}

function handleTerminalContextMenu(event: MouseEvent) {
  event.preventDefault();
  void copyTerminalSelection("right");
}

function handleTerminalAuxClick(event: MouseEvent) {
  if (event.button !== 1) {
    return;
  }

  event.preventDefault();
  void copyTerminalSelection("middle");
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

  try {
    const response = await window.projectApi.terminal.resize({
      cols: terminal.cols,
      rows: terminal.rows
    });

    if (!response.ok) {
      reportUiError("Terminal resize", response.error, "Failed to resize terminal backend.");
    console.error(response.error ?? "Не удалось изменить размер терминала.");
  }
  } catch (error) {
    reportUiError("Terminal resize", error, "Failed to resize terminal backend.");
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

function resetProjectRuntimeState() {
  selectedFilePath.value = null;
  terminalInputText.value = "";
  terminalInputHistory.value = [];
  terminalInputHistoryEditVersion = 0;
  terminalInputHistoryPersistedVersion = 0;
  terminalInputHistoryPersistQueue = Promise.resolve();
  terminalInputHistoryReloadPending = false;
  todoDrafts.value = [""];
  resetTodoDragState();
  todoDraftEditVersion = 0;
  todoPersistedVersion = 0;
  todoPersistQueue = Promise.resolve();
  projectSettingsPersistQueue = Promise.resolve();
  resetTerminalInputHistoryNavigation();
}

async function openProject(path: string) {
  projectPath.value = path;
  resetProjectRuntimeState();
  toolbarConfig.value = await loadToolbarConfig(path);
  projectSettings.value = await loadProjectSettings(path);
  applyProjectZoomSettings(projectSettings.value);
  await loadTerminalInputHistoryForProject(path, "project-open");
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
    reportUiError("Project open", error, "Failed to open project or start terminal.");
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
    resetProjectRuntimeState();
    toolbarConfig.value = defaultToolbarConfig;
    projectSettings.value = defaultProjectSettings;
    applyProjectZoomSettings(defaultProjectSettings);
    isTerminalReady.value = false;
    try {
      const unwatchResponse = await window.projectApi.settings.unwatch();
      if (!unwatchResponse.ok) {
        reportUiError(
          "Settings watcher",
          unwatchResponse.error,
          "Failed to stop settings watcher."
        );
      }
    } catch (unwatchError) {
      reportUiError("Settings watcher", unwatchError, "Failed to stop settings watcher.");
    }
    reportUiError(
      "Startup project restore",
      error,
      "Failed to open the last project. Pick a folder manually."
    );
  } finally {
    isOpening.value = false;
  }
}

async function runTerminalCommand(command: string) {
  const result = await attemptSubmitTerminalText(command, {
    notReady: "Terminal is not ready to run commands.",
    messages: {
      sendSlash: "Failed to send slash command to terminal.",
      sendText: "Failed to send command text to terminal.",
      submit: "Failed to submit command in terminal."
    }
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

  if (typeof action.command === "string") {
    void runTerminalCommand(action.command);
    return;
  }

  void sendTerminalInput(action.rawInput, "Failed to send input to terminal.");
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

function handleProjectSettingsSave(settings: ProjectSettings) {
  const normalizedSettings: ProjectSettings = {
    ...settings,
    zoom: {
      ideZoomFactor: normalizeIdeZoomFactor(settings.zoom.ideZoomFactor),
      terminalFontSize: normalizeTerminalFontSize(settings.zoom.terminalFontSize)
    }
  };
  projectSettings.value = normalizedSettings;
  applyProjectZoomSettings(normalizedSettings);
  persistProjectSettings(normalizedSettings);
  isProjectSettingsEditorOpen.value = false;
}

async function handleSettingsFileChanged(filename: string) {
  if (!projectPath.value) {
    return;
  }

  const normalizedFilename = filename.split(/[\\/]/).pop() ?? filename;
  const normalizedFilenameLower = normalizedFilename.toLowerCase();
  const isWildcardChange = normalizedFilename === SETTINGS_WATCH_ALL;
  const isToolbarConfigChange =
    isWildcardChange || normalizedFilenameLower === TOOLBAR_CONFIG_FILENAME.toLowerCase();
  const isProjectSettingsChange =
    isWildcardChange || normalizedFilenameLower === PROJECT_SETTINGS_FILENAME.toLowerCase();
  const isTodoChange =
    isWildcardChange || normalizedFilenameLower === TODO_FILENAME.toLowerCase();
  const isTerminalHistoryChange =
    isWildcardChange ||
    normalizedFilenameLower === TERMINAL_INPUT_HISTORY_FILENAME.toLowerCase();

  if (isToolbarConfigChange) {
    toolbarConfig.value = await loadToolbarConfig(projectPath.value);
  }

  if (isProjectSettingsChange) {
    projectSettings.value = await loadProjectSettings(projectPath.value);
    applyProjectZoomSettings(projectSettings.value);
  }

  if (isTodoChange) {
    await loadTodoEntriesForProject(projectPath.value, "settings-watch");
  }

  if (isTerminalHistoryChange) {
    await loadTerminalInputHistoryForProject(projectPath.value, "settings-watch");
  }
}

async function startSettingsWatcher(path: string) {
  unsubscribeSettingsFileChanged?.();
  const unwatchResponse = await window.projectApi.settings.unwatch();
  if (!unwatchResponse.ok) {
    throw new Error(
      toErrorMessage(unwatchResponse.error, "Failed to stop previous settings watcher.")
    );
  }

  unsubscribeSettingsFileChanged = window.projectApi.settings.onFileChanged(
    (filename) => {
      void handleSettingsFileChanged(filename).catch((error: unknown) => {
        reportUiError(
          "Settings watcher event",
          error,
          "Failed to reload settings after file change."
        );
      });
    }
  );

  const watchResponse = await window.projectApi.settings.watch(path, SETTINGS_WATCH_ALL);
  if (!watchResponse.ok) {
    unsubscribeSettingsFileChanged();
    unsubscribeSettingsFileChanged = null;
    throw new Error(
      toErrorMessage(watchResponse.error, "Failed to start settings watcher.")
    );
  }
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
  const text = terminalInputText.value;
  const result = await attemptSubmitTerminalText(text, {
    notReady: "Terminal is not ready to send input.",
    messages: {
      sendSlash: "Failed to send slash command to terminal.",
      sendText: "Failed to send input to terminal.",
      submit: "Failed to send Enter to terminal."
    }
  });
  if (result !== "submitted") {
    return;
  }

  appendTerminalInputHistory(text);
  terminalInputText.value = "";
  focusTerminalInput();
}

async function sendTodoEntryToTerminal(index: number) {
  const text = todoDrafts.value[index];
  if (typeof text !== "string") {
    return;
  }

  const result = await attemptSubmitTerminalText(text, {
    notReady: "Terminal is not ready to send input.",
    messages: {
      sendSlash: "Failed to send slash command from todo to terminal.",
      sendText: "Failed to send todo prompt to terminal.",
      submit: "Failed to send Enter to terminal."
    }
  });
  if (result !== "submitted") {
    return;
  }

  appendTerminalInputHistory(text);

  if (!isTodoDraftIndexValid(index)) {
    return;
  }

  const nextDrafts = [...todoDrafts.value];
  nextDrafts.splice(index, 1);
  todoDraftEditVersion += 1;
  todoDrafts.value = getNormalizedTodoDrafts(nextDrafts);
  resetTodoDragState();

  const nextVersion = todoDraftEditVersion;
  persistTodoEntries(getPersistedTodoEntries(todoDrafts.value), nextVersion);

  void nextTick(() => {
    resizeTodoTextareas();
  });
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
  try {
    await sendAltVToTerminal(false);
  } finally {
    textarea?.focus();
  }
}

onMounted(() => {
  unsubscribeTerminalData = window.projectApi.terminal.onData((data) => {
    terminalDataVersion += 1;
    // Keep terminal stream untouched: PTY output must reach xterm as-is.
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

  window.addEventListener("wheel", handleBrowserZoomCtrlWheel, { passive: false, capture: true });
  removeWindowWheelListener = () => {
    window.removeEventListener("wheel", handleBrowserZoomCtrlWheel, true);
  };

  window.addEventListener("keydown", handleBrowserZoomKeyboardShortcut, true);
  removeWindowKeydownListener = () => {
    window.removeEventListener("keydown", handleBrowserZoomKeyboardShortcut, true);
  };

  const handleWindowError = (event: ErrorEvent) => {
    reportUiError(
      "Unhandled runtime error",
      event.error ?? event.message,
      event.message || "Unhandled runtime error."
    );
  };
  window.addEventListener("error", handleWindowError);
  removeWindowErrorListener = () => {
    window.removeEventListener("error", handleWindowError);
  };

  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    reportUiError(
      "Unhandled promise rejection",
      event.reason,
      "Unhandled promise rejection."
    );
  };
  window.addEventListener("unhandledrejection", handleUnhandledRejection);
  removeWindowUnhandledRejectionListener = () => {
    window.removeEventListener("unhandledrejection", handleUnhandledRejection);
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

watch(terminalInputHistoryIndex, (index) => {
  if (index !== null) {
    return;
  }

  void flushPendingTerminalInputHistoryReload();
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
  removeWindowWheelListener?.();
  removeWindowKeydownListener?.();
  removeWindowErrorListener?.();
  removeWindowUnhandledRejectionListener?.();
  if (pendingZoomResizeAnimationFrame !== null) {
    window.cancelAnimationFrame(pendingZoomResizeAnimationFrame);
    pendingZoomResizeAnimationFrame = null;
  }
  void window.projectApi.settings.unwatch()
    .then((response) => {
      if (!response.ok) {
        reportUiError(
          "Settings watcher teardown",
          response.error,
          "Failed to stop settings watcher."
        );
      }
    })
    .catch((error: unknown) => {
      reportUiError("Settings watcher teardown", error, "Failed to stop settings watcher.");
    });
  void window.projectApi.terminal.stop()
    .then((response) => {
      if (!response.ok) {
        reportUiError("Terminal teardown", response.error, "Failed to stop terminal.");
      }
    })
    .catch((error: unknown) => {
      reportUiError("Terminal teardown", error, "Failed to stop terminal.");
    });
  terminal?.dispose();
  terminal = null;
  fitAddon = null;
});

</script>

<style scoped>
.terminal-host {
  overflow: hidden;
}

.todo-list-scroll {
  overflow-anchor: none;
}

.textarea-autosize-native {
  field-sizing: content;
}

.terminal-host :deep(.xterm) {
  height: 100%;
  padding: 0.4rem;
  border-radius: inherit;
}

.terminal-host :deep(.xterm-viewport) {
  overflow-y: auto;
  border-radius: inherit;
}
</style>
