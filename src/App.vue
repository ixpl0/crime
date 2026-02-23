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
              class="btn btn-sm btn-ghost ml-auto"
              title="Project settings"
              @click="isConfigEditorOpen = true"
            >
              <Settings :size="16" />
            </button>
          </div>

          <ToolbarPanel
            :toolbar-config="toolbarConfig"
            :is-terminal-ready="isTerminalReady"
            @execute-action="executeToolbarAction"
            @open-config-editor="isConfigEditorOpen = true"
          />

          <ToolbarConfigEditor
            :current-config="toolbarConfig"
            :config-file-path="`${projectPath}/.dream/toolbar.json`"
            :open="isConfigEditorOpen"
            @save="handleConfigSave"
            @close="isConfigEditorOpen = false"
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
import { loadToolbarConfig, saveToolbarConfig } from "./toolbar/toolbar-storage";
import { defaultToolbarConfig } from "./toolbar/default-toolbar-config";
import { useToolbarShortcuts } from "./composables/use-toolbar-shortcuts";
import ToolbarPanel from "./components/ToolbarPanel.vue";
import ToolbarConfigEditor from "./components/ToolbarConfigEditor.vue";
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
const SLASH_COMMAND_CHAR_DELAY_MS = 10;
const SLASH_COMMAND_AFTER_SLASH_DELAY_MS = 200;
const SLASH_COMMAND_ENTER_DELAY_MS = 60;
const PASTE_ENTER_DELAY_MS = 100;
const terminalInputHistory = ref<string[]>(loadTerminalInputHistory());
const terminalInputHistoryIndex = ref<number | null>(null);
const terminalInputDraft = ref("");
const toolbarConfig = ref<ToolbarConfig>(defaultToolbarConfig);
const isConfigEditorOpen = ref(false);
const activeTab = ref<"agent" | "files">("agent");
const selectedFilePath = ref<string | null>(null);

let terminal: Terminal | null = null;
let fitAddon: FitAddon | null = null;
let unsubscribeTerminalData: (() => void) | null = null;
let unsubscribeTerminalExit: (() => void) | null = null;
let removeWindowResizeListener: (() => void) | null = null;
let unsubscribeGlobalQuickKey: (() => void) | null = null;
let unsubscribeSettingsFileChanged: (() => void) | null = null;

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

function handleTextareaKeydown(event: KeyboardEvent) {
  const textarea =
    event.currentTarget instanceof HTMLTextAreaElement ? event.currentTarget : null;

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

function isSlashCommandInput(text: string) {
  const trimmedStart = text.trimStart();
  return !trimmedStart.includes("\n") && trimmedStart.startsWith("/");
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function sendTerminalInput(data: string, fallbackErrorMessage: string) {
  const response = await window.projectApi.terminal.input(data);
  if (!response.ok) {
    errorMessage.value = response.error ?? fallbackErrorMessage;
    return false;
  }

  return true;
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

    void window.projectApi.terminal.input(data);
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
    errorMessage.value = "Терминал ещё не готов к запуску команд.";
    return;
  }

  errorMessage.value = "";

  if (isSlashCommandInput(command)) {
    const slashCommandText = command.trimStart();
    for (let index = 0; index < slashCommandText.length; index += 1) {
      const char = slashCommandText[index];
      const ok = await sendTerminalInput(char, "Не удалось отправить символ команды в терминал.");
      if (!ok) {
        return;
      }

      await delay(char === "/" ? SLASH_COMMAND_AFTER_SLASH_DELAY_MS : SLASH_COMMAND_CHAR_DELAY_MS);
    }

    await delay(SLASH_COMMAND_ENTER_DELAY_MS);

    const enterOk = await sendTerminalInput("\r", "Не удалось отправить Enter в терминал.");
    if (!enterOk) {
      return;
    }

    focusTerminal();
    return;
  }

  try {
    const response = await window.projectApi.terminal.runCommand(command);
    if (!response.ok) {
      errorMessage.value = response.error ?? "Не удалось выполнить команду в терминале.";
      return;
    }

    focusTerminal();
  } catch (error) {
    errorMessage.value = "Не удалось отправить команду в терминал.";
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

  void window.projectApi.terminal.input(action.input).then((response) => {
    if (!response.ok) {
      errorMessage.value = response.error ?? "Не удалось отправить данные в терминал.";
    }
  });
}

function handleFileSelect(path: string) {
  selectedFilePath.value = path;
}

function sendQuickKey(data: string) {
  if (!isTerminalReady.value) {
    return;
  }

  void window.projectApi.terminal.input(data).then((response) => {
    if (!response.ok) {
      errorMessage.value = response.error ?? "Не удалось отправить клавишу в терминал.";
    }
  });
}

const TOOLBAR_CONFIG_FILENAME = "toolbar.json";

function handleConfigSave(config: ToolbarConfig) {
  toolbarConfig.value = config;
  if (projectPath.value) {
    void saveToolbarConfig(projectPath.value, config);
  }
  isConfigEditorOpen.value = false;
}

async function handleSettingsFileChanged(filename: string) {
  if (filename !== TOOLBAR_CONFIG_FILENAME || !projectPath.value) {
    return;
  }

  toolbarConfig.value = await loadToolbarConfig(projectPath.value);
}

async function startSettingsWatcher(path: string) {
  unsubscribeSettingsFileChanged?.();
  await window.projectApi.settings.unwatch();

  unsubscribeSettingsFileChanged = window.projectApi.settings.onFileChanged(
    (filename) => void handleSettingsFileChanged(filename)
  );

  await window.projectApi.settings.watch(path, TOOLBAR_CONFIG_FILENAME);
}

async function sendAltVToTerminal(shouldFocusTerminal = true) {
  if (!isTerminalReady.value) {
    errorMessage.value = "Терминал ещё не готов.";
    return;
  }

  errorMessage.value = "";
  const response = await window.projectApi.terminal.input("\u001bv");
  if (!response.ok) {
    errorMessage.value = response.error ?? "Не удалось отправить Alt+V в терминал.";
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

  if (isSlashCommandInput(text)) {
    const normalizedText = text.replace(/\r?\n/g, "\r");
    const slashCommandText = normalizedText.trimStart();
    for (let index = 0; index < slashCommandText.length; index += 1) {
      const char = slashCommandText[index];
      const ok = await sendTerminalInput(char, "Failed to send slash command character to terminal.");
      if (!ok) {
        return;
      }

      await delay(char === "/" ? SLASH_COMMAND_AFTER_SLASH_DELAY_MS : SLASH_COMMAND_CHAR_DELAY_MS);
    }

    await delay(SLASH_COMMAND_ENTER_DELAY_MS);
  } else {
    const cleanedText = text.replace(/[\r\n]+$/, "");
    const ok = await sendTerminalInput(cleanedText, "Failed to send input to terminal.");
    if (!ok) {
      return;
    }

    await delay(PASTE_ENTER_DELAY_MS);
  }

  const enterOk = await sendTerminalInput("\r", "Failed to send Enter to terminal.");
  if (!enterOk) {
    return;
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
