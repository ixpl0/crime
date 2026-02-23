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

      <div v-if="projectPath" class="card bg-base-100 shadow-xl">
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
            </div>

            <button
              class="btn btn-sm btn-ghost"
              title="Project settings"
              @click="isProjectSettingsEditorOpen = true"
            >
              <Settings :size="16" />
            </button>
          </div>

          <ToolbarPanel
            :toolbar-config="toolbarConfig"
            :is-terminal-ready="isTerminalReady"
            @execute-action="executeToolbarAction"
            @open-config-editor="isToolbarConfigEditorOpen = true"
          />

          <ToolbarConfigEditor
            :current-config="toolbarConfig"
            :config-file-path="`${projectPath}/.dream/${TOOLBAR_CONFIG_FILENAME}`"
            :open="isToolbarConfigEditorOpen"
            @save="handleToolbarConfigSave"
            @close="isToolbarConfigEditorOpen = false"
          />

          <ProjectSettingsEditor
            :current-settings="projectSettings"
            :config-file-path="`${projectPath}/.dream/${PROJECT_SETTINGS_FILENAME}`"
            :open="isProjectSettingsEditorOpen"
            @save="handleProjectSettingsSave"
            @close="isProjectSettingsEditorOpen = false"
          />

          <div v-show="activeTab === 'agent'">
            <div class="space-y-4">
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
                    class="textarea textarea-bordered h-24 w-full resize-y"
                    :disabled="!isTerminalReady"
                    placeholder="Введите текст для отправки в терминал"
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
                      Отправить
                    </button>
                  </div>
                </div>

                <div class="grid shrink-0 grid-cols-4 gap-1 self-start">
                  <button v-for="n in 4" :key="`num-${String(n)}`" type="button" class="btn btn-sm min-w-0 px-2" :disabled="!isTerminalReady" @click="sendQuickKey(String(n))">{{ n }}</button>
                  <span />
                  <button type="button" class="btn btn-sm min-w-0 px-2" :disabled="!isTerminalReady" @click="sendQuickKey('\x1b[A')"><ArrowUp :size="14" /></button>
                  <span />
                  <button type="button" class="btn btn-sm min-w-0 px-2" :disabled="!isTerminalReady" @click="sendQuickKey('\x1b')">Esc</button>
                  <button type="button" class="btn btn-sm min-w-0 px-2" :disabled="!isTerminalReady" @click="sendQuickKey('\x1b[D')"><ArrowLeft :size="14" /></button>
                  <button type="button" class="btn btn-sm min-w-0 px-2" :disabled="!isTerminalReady" @click="sendQuickKey('\x1b[B')"><ArrowDown :size="14" /></button>
                  <button type="button" class="btn btn-sm min-w-0 px-2" :disabled="!isTerminalReady" @click="sendQuickKey('\x1b[C')"><ArrowRight :size="14" /></button>
                  <button type="button" class="btn btn-sm min-w-0 px-2" :disabled="!isTerminalReady" @click="sendQuickKey('\r')"><CornerDownLeft :size="14" /></button>
                </div>
              </form>
            </div>
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
    </section>
  </main>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { Terminal } from "xterm";
import { FitAddon } from "@xterm/addon-fit";
import "xterm/css/xterm.css";
import { type ToolbarAction, type ToolbarConfig } from "./types/toolbar";
import {
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
import { useToolbarShortcuts } from "./composables/use-toolbar-shortcuts";
import ToolbarPanel from "./components/ToolbarPanel.vue";
import ToolbarConfigEditor from "./components/ToolbarConfigEditor.vue";
import ProjectSettingsEditor from "./components/ProjectSettingsEditor.vue";
import FileManagerPanel from "./components/FileManagerPanel.vue";
import FileContentViewer from "./components/FileContentViewer.vue";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, CornerDownLeft, Settings } from "lucide-vue-next";

const isOpening = ref(false);
const isTerminalReady = ref(false);
const projectPath = ref<string | null>(null);
const errorMessage = ref("");
const terminalInputText = ref("");
const terminalInputTextarea = ref<HTMLTextAreaElement | null>(null);
const terminalContainer = ref<HTMLElement | null>(null);
const TERMINAL_INPUT_HISTORY_STORAGE_KEY = "dream-ide:terminal-input-history:v1";
const TERMINAL_INPUT_HISTORY_LIMIT = 200;
const PASTE_ENTER_DELAY_MS = 100;
const SETTINGS_WATCH_ALL = "*";
const terminalInputHistory = ref<string[]>(loadTerminalInputHistory());
const terminalInputHistoryIndex = ref<number | null>(null);
const terminalInputDraft = ref("");
const toolbarConfig = ref<ToolbarConfig>(defaultToolbarConfig);
const projectSettings = ref<ProjectSettings>(defaultProjectSettings);
const isToolbarConfigEditorOpen = ref(false);
const isProjectSettingsEditorOpen = ref(false);
const activeTab = ref<"agent" | "files">("agent");
const selectedFilePath = ref<string | null>(null);

let terminal: Terminal | null = null;
let fitAddon: FitAddon | null = null;
let unsubscribeTerminalData: (() => void) | null = null;
let unsubscribeTerminalExit: (() => void) | null = null;
let removeWindowResizeListener: (() => void) | null = null;
let unsubscribeGlobalQuickKey: (() => void) | null = null;
let unsubscribeSettingsFileChanged: (() => void) | null = null;
let terminalDataVersion = 0;
let terminalInputQueue: Promise<void> = Promise.resolve();

useToolbarShortcuts(toolbarConfig, executeToolbarAction);

function loadTerminalInputHistory() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedHistory = window.localStorage.getItem(TERMINAL_INPUT_HISTORY_STORAGE_KEY);
    if (!storedHistory) {
      return [];
    }

    const parsedHistory: unknown = JSON.parse(storedHistory);
    if (!Array.isArray(parsedHistory)) {
      return [];
    }

    return parsedHistory
      .filter((entry): entry is string => typeof entry === "string")
      .slice(-TERMINAL_INPUT_HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function persistTerminalInputHistory() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      TERMINAL_INPUT_HISTORY_STORAGE_KEY,
      JSON.stringify(terminalInputHistory.value)
    );
  } catch (error) {
    console.error("Failed to persist terminal input history.", error);
  }
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
  persistTerminalInputHistory();
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

function getEmptyTextareaPassthroughInput(
  event: KeyboardEvent,
  textarea: HTMLTextAreaElement
) {
  if (textarea.value.trim().length > 0 || event.isComposing || event.metaKey) {
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

function handleTextareaInput() {
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

function isSlashCommandInput(text: string) {
  return getSlashCommandText(text) !== null;
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

async function waitForSlashCommandReadiness(versionAfterSlashSend: number) {
  const timings = projectSettings.value.slashCommand;
  const sawActivity = await waitForTerminalDataAfter(
    versionAfterSlashSend,
    timings.activityTimeoutMs
  );
  if (!sawActivity) {
    await delay(timings.afterSlashDelayMs);
    return;
  }

  await waitForTerminalQuiet(timings.enterDelayMs, timings.quietTimeoutMs);
}

async function sendSlashCommand(slashCommandText: string) {
  const timings = projectSettings.value.slashCommand;
  for (let index = 0; index < slashCommandText.length; index += 1) {
    const char = slashCommandText[index];
    const ok = await sendTerminalInput(char, "Failed to send slash command character to terminal.");
    if (!ok) {
      return false;
    }

    if (char === "/") {
      await waitForSlashCommandReadiness(terminalDataVersion);
      continue;
    }

    await delay(timings.charDelayMs);
  }

  await waitForTerminalQuiet(timings.enterDelayMs, timings.quietTimeoutMs);
  return sendTerminalInput("\r", "Failed to send Enter to terminal.");
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

async function openProjectFolder() {
  isOpening.value = true;
  errorMessage.value = "";

  try {
    const selectedPath = await window.projectApi.openFolder();
    if (selectedPath) {
      projectPath.value = selectedPath;
      selectedFilePath.value = null;
      toolbarConfig.value = await loadToolbarConfig(selectedPath);
      projectSettings.value = await loadProjectSettings(selectedPath);
      await startSettingsWatcher(selectedPath);
      await nextTick();
      await startTerminal(selectedPath);
    }
  } catch (error) {
    isTerminalReady.value = false;
    errorMessage.value = "Не удалось открыть проект или запустить терминал.";
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

  if (isSlashCommandInput(command)) {
    const slashCommandText = getSlashCommandText(command);
    if (!slashCommandText) {
      errorMessage.value = "Failed to normalize slash command.";
      return;
    }

    const sent = await sendSlashCommand(slashCommandText);
    if (!sent) {
      errorMessage.value ||= "Failed to send slash command to terminal.";
      return;
    }

    focusTerminal();
    return;
  }

  try {
    const response = await enqueueTerminalOperation(() =>
      window.projectApi.terminal.runCommand(command)
    );
    if (!response.ok) {
      errorMessage.value = response.error ?? "Failed to run command in terminal.";
      return;
    }

    focusTerminal();
  } catch (error) {
    errorMessage.value = "Failed to send command to terminal.";
    console.error(error);
  }
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

  if (normalizedFilename === TOOLBAR_CONFIG_FILENAME) {
    toolbarConfig.value = await loadToolbarConfig(projectPath.value);
  }

  if (normalizedFilename === PROJECT_SETTINGS_FILENAME) {
    projectSettings.value = await loadProjectSettings(projectPath.value);
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

  const slashCommandText = getSlashCommandText(text);
  if (slashCommandText) {
    const ok = await sendSlashCommand(slashCommandText);
    if (!ok) {
      return;
    }
  } else {
    const cleanedText = text.replace(/[\r\n]+$/, "");
    const ok = await sendTerminalInput(cleanedText, "Failed to send input to terminal.");
    if (!ok) {
      return;
    }

    await delay(PASTE_ENTER_DELAY_MS);
    const enterOk = await sendTerminalInput("\r", "Failed to send Enter to terminal.");
    if (!enterOk) {
      return;
    }
  }

  appendTerminalInputHistory(text);
  terminalInputText.value = "";
  focusTerminalInput();
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
    void resizeTerminalBackend();
  };

  window.addEventListener("resize", handleWindowResize);
  removeWindowResizeListener = () => {
    window.removeEventListener("resize", handleWindowResize);
  };

  unsubscribeGlobalQuickKey = window.projectApi.onGlobalQuickKey((input) => {
    sendQuickKey(input);
  });
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
