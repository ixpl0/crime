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

          <ToolbarPanel
            :toolbar-config="toolbarConfig"
            :is-terminal-ready="isTerminalReady"
            @execute-action="executeToolbarAction"
            @open-config-editor="isConfigEditorOpen = true"
          />

          <ToolbarConfigEditor
            :current-config="toolbarConfig"
            :open="isConfigEditorOpen"
            @save="handleConfigSave"
            @close="isConfigEditorOpen = false"
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
              <button type="button" class="btn btn-sm min-w-0 px-2" :disabled="!isTerminalReady" @click="sendQuickKey('\x1b[A')">▲</button>
              <span />
              <button type="button" class="btn btn-sm min-w-0 px-2" :disabled="!isTerminalReady" @click="sendQuickKey('\x1b')">Esc</button>
              <button type="button" class="btn btn-sm min-w-0 px-2" :disabled="!isTerminalReady" @click="sendQuickKey('\x1b[D')">◀</button>
              <button type="button" class="btn btn-sm min-w-0 px-2" :disabled="!isTerminalReady" @click="sendQuickKey('\x1b[B')">▼</button>
              <button type="button" class="btn btn-sm min-w-0 px-2" :disabled="!isTerminalReady" @click="sendQuickKey('\x1b[C')">▶</button>
              <button type="button" class="btn btn-sm min-w-0 px-2" :disabled="!isTerminalReady" @click="sendQuickKey('\r')">↵</button>
            </div>
          </form>
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
import { useToolbarShortcuts } from "./composables/use-toolbar-shortcuts";
import ToolbarPanel from "./components/ToolbarPanel.vue";
import ToolbarConfigEditor from "./components/ToolbarConfigEditor.vue";

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
const SLASH_COMMAND_AFTER_PREFIX_DELAY_MS = 60;
const SLASH_COMMAND_ENTER_DELAY_MS = 60;
const PASTE_ENTER_DELAY_MS = 100;
const terminalInputHistory = ref<string[]>(loadTerminalInputHistory());
const terminalInputHistoryIndex = ref<number | null>(null);
const terminalInputDraft = ref("");
const toolbarConfig = ref<ToolbarConfig>(loadToolbarConfig());
const isConfigEditorOpen = ref(false);

let terminal: Terminal | null = null;
let fitAddon: FitAddon | null = null;
let unsubscribeTerminalData: (() => void) | null = null;
let unsubscribeTerminalExit: (() => void) | null = null;
let removeWindowResizeListener: (() => void) | null = null;

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

  if (event.key === "Enter" && event.ctrlKey && !event.altKey && !event.metaKey) {
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

function handleConfigSave(config: ToolbarConfig) {
  toolbarConfig.value = config;
  saveToolbarConfig(config);
  isConfigEditorOpen.value = false;
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

      await delay(index === 0 ? SLASH_COMMAND_AFTER_PREFIX_DELAY_MS : SLASH_COMMAND_CHAR_DELAY_MS);
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
});

onBeforeUnmount(() => {
  unsubscribeTerminalData?.();
  unsubscribeTerminalExit?.();
  removeWindowResizeListener?.();
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
