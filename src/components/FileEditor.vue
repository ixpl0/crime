<template>
  <div class="relative flex h-full min-h-0 flex-col">
    <div ref="editorContainer" class="min-h-0 flex-1" />
    <div v-if="saveStatus === 'error'" class="border-t border-base-300/80 bg-base-100/40 px-3 py-1.5">
      <span class="text-xs text-error">Действие не удалось</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from "@codemirror/view";
import { EditorState, type Extension } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { oneDark } from "@codemirror/theme-one-dark";
import { search, openSearchPanel } from "@codemirror/search";
import { toErrorMessage } from "../utils/fail-fast";
import { useAppToastStore } from "../toast/toast-store";
import { loadLanguageExtension, LARGE_FILE_LINE_THRESHOLD } from "../codemirror/language-detection";
import { searchMatchCounter } from "../codemirror/search-match-counter";
import { setTargetLineEffect, targetLineHighlightField } from "../codemirror/diff-decorations";

type SaveStatus = "idle" | "saving" | "error";

const props = defineProps<{
  projectPath: string;
  filePath: string;
  isActive: boolean;
  targetLine?: number | null;
  targetRequestToken?: number;
  searchRequestToken?: number;
}>();

const emit = defineEmits<{ saved: [] }>();

const editorContainer = ref<HTMLElement | null>(null);
const saveStatus = ref<SaveStatus>("idle");
const saveError = ref("");
const { pushError } = useAppToastStore();
let editorView: EditorView | null = null;
let autoSaveTimeoutId: number | null = null;
let clearHighlightTimeoutId: number | null = null;
const AUTO_SAVE_DELAY = 1000;

const clearAutoSaveTimeout = () => {
  if (autoSaveTimeoutId !== null) {
    window.clearTimeout(autoSaveTimeoutId);
    autoSaveTimeoutId = null;
  }
};

const flushPendingSave = () => {
  if (autoSaveTimeoutId === null || !editorView) { return; }
  clearAutoSaveTimeout();
  const content = editorView.state.doc.toString();
  void window.projectApi.filesystem.writeFile(props.projectPath, props.filePath, content)
    .then((response) => {
      if (response.ok) { emit("saved"); }
    });
};

const scheduleAutoSave = () => {
  clearAutoSaveTimeout();
  autoSaveTimeoutId = window.setTimeout(() => {
    autoSaveTimeoutId = null;
    void saveFile();
  }, AUTO_SAVE_DELAY);
};

const clearHighlightTimer = () => {
  if (clearHighlightTimeoutId !== null) {
    window.clearTimeout(clearHighlightTimeoutId);
    clearHighlightTimeoutId = null;
  }
};

const focusTargetLine = () => {
  if (!editorView) { return; }
  const targetLine = props.targetLine ?? null;
  if (targetLine === null || targetLine <= 0) { return; }

  const lineCount = editorView.state.doc.lines;
  const clamped = Math.max(1, Math.min(targetLine, lineCount));

  editorView.dispatch({
    effects: [
      setTargetLineEffect.of(clamped),
      EditorView.scrollIntoView(editorView.state.doc.line(clamped).from, { y: "center" }),
    ],
  });

  clearHighlightTimer();
  clearHighlightTimeoutId = window.setTimeout(() => {
    if (editorView) {
      editorView.dispatch({ effects: setTargetLineEffect.of(null) });
    }
    clearHighlightTimeoutId = null;
  }, 1500);
};

const saveFile = async () => {
  if (!editorView) { return; }
  clearAutoSaveTimeout();
  const content = editorView.state.doc.toString();
  saveStatus.value = "saving";
  try {
    const response = await window.projectApi.filesystem.writeFile(props.projectPath, props.filePath, content);
    if (!response.ok) {
      saveStatus.value = "error";
      saveError.value = response.error ?? "Не удалось сохранить файл.";
      return;
    }
    saveStatus.value = "idle";
    emit("saved");
  } catch (error) {
    saveStatus.value = "error";
    saveError.value = toErrorMessage(error, "Не удалось сохранить файл.");
  }
};

const loadLanguageForContent = async (content: string): Promise<Extension[]> => {
  const lineCount = content.split("\n").length;
  if (lineCount > LARGE_FILE_LINE_THRESHOLD) { return []; }
  return loadLanguageExtension(props.filePath);
};

const saveKeymap = keymap.of([{
  key: "Mod-s",
  run: () => { void saveFile(); return true; },
}]);

const autoSaveListener = EditorView.updateListener.of((update) => {
  if (update.docChanged) {
    scheduleAutoSave();
  }
});

const editorTheme = EditorView.theme({
  "&": { height: "100%", fontSize: "13px" },
  ".cm-scroller": { overflow: "auto", fontFamily: "monospace" },
  ".cm-content": { padding: "4px 0" },
  ".cm-target-line-highlight": { backgroundColor: "rgba(250, 204, 21, 0.25)", outline: "1px solid rgba(250, 204, 21, 0.4)" },
});

const createEditor = async (container: HTMLElement, content: string) => {
  const languageExtensions = await loadLanguageForContent(content);

  const state = EditorState.create({
    doc: content,
    extensions: [
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      history(),
      bracketMatching(),
      closeBrackets(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      oneDark,
      keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap]),
      saveKeymap,
      autoSaveListener,
      search({ top: true }),
      searchMatchCounter,
      targetLineHighlightField,
      ...languageExtensions,
      editorTheme,
    ],
  });

  return new EditorView({ state, parent: container });
};

const loadAndCreateEditor = async () => {
  const container = editorContainer.value;
  if (!container) { return; }

  flushPendingSave();
  if (editorView) {
    editorView.destroy();
    editorView = null;
  }

  saveStatus.value = "idle";
  saveError.value = "";

  try {
    const response = await window.projectApi.filesystem.readFile(props.projectPath, props.filePath);
    if (!response.ok || typeof response.content !== "string") {
      saveStatus.value = "error";
      saveError.value = response.error ?? "Не удалось прочитать файл.";
      return;
    }
    editorView = await createEditor(container, response.content);
    focusTargetLine();
  } catch (error) {
    saveStatus.value = "error";
    saveError.value = toErrorMessage(error, "Не удалось загрузить файл.");
  }
};

watch(saveError, (message) => {
  if (message) {
    pushError(message);
  }
});

watch(
  () => [props.targetLine ?? null, props.targetRequestToken ?? 0] as const,
  () => { focusTargetLine(); },
);

watch(
  () => props.searchRequestToken ?? 0,
  () => {
    if (editorView) {
      openSearchPanel(editorView);
    }
  },
);

watch(() => [props.projectPath, props.filePath], () => {
  void loadAndCreateEditor();
});

watch(() => props.isActive, (active) => {
  if (active && !editorView) {
    void loadAndCreateEditor();
  }
});

onMounted(() => {
  void loadAndCreateEditor();
});

onBeforeUnmount(() => {
  clearHighlightTimer();
  flushPendingSave();
  if (editorView) {
    editorView.destroy();
    editorView = null;
  }
});
</script>
