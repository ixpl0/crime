<template>
  <div class="relative flex h-full min-h-0 flex-col">
    <div ref="editorContainer" class="min-h-0 flex-1" />
    <div class="flex items-center gap-2 border-t border-base-300/80 bg-base-100/40 px-3 py-1.5">
      <span class="text-xs" :class="saveStatusClasses">{{ saveStatusText }}</span>
      <span class="ml-auto text-[11px] text-base-content/45">Ctrl+S to save</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { oneDark } from "@codemirror/theme-one-dark";
import { toErrorMessage } from "../utils/fail-fast";
import { useAppToastStore } from "../toast/toast-store";
import { loadLanguageExtension } from "../codemirror/language-detection";

type SaveStatus = "idle" | "saving" | "saved" | "error";

const props = defineProps<{
  projectPath: string;
  filePath: string;
  isActive: boolean;
}>();

const emit = defineEmits<{ saved: [] }>();

const editorContainer = ref<HTMLElement | null>(null);
const saveStatus = ref<SaveStatus>("idle");
const saveError = ref("");
const { pushError } = useAppToastStore();
let editorView: EditorView | null = null;
let savedResetTimeoutId: number | null = null;

const saveStatusText = computed(() => {
  if (saveStatus.value === "saving") { return "Saving..."; }
  if (saveStatus.value === "saved") { return "Saved"; }
  if (saveStatus.value === "error") { return "Action failed"; }
  return "";
});

const saveStatusClasses = computed(() => {
  if (saveStatus.value === "saved") { return "text-success"; }
  if (saveStatus.value === "error") { return "text-error"; }
  if (saveStatus.value === "saving") { return "text-base-content/60"; }
  return "text-base-content/40";
});

const clearSavedResetTimeout = () => {
  if (savedResetTimeoutId !== null) {
    window.clearTimeout(savedResetTimeoutId);
    savedResetTimeoutId = null;
  }
};

const saveFile = async () => {
  if (!editorView) { return; }
  const content = editorView.state.doc.toString();
  saveStatus.value = "saving";
  clearSavedResetTimeout();
  try {
    const response = await window.projectApi.filesystem.writeFile(props.projectPath, props.filePath, content);
    if (!response.ok) {
      saveStatus.value = "error";
      saveError.value = response.error ?? "Failed to save file.";
      return;
    }
    saveStatus.value = "saved";
    emit("saved");
    savedResetTimeoutId = window.setTimeout(() => {
      if (saveStatus.value === "saved") { saveStatus.value = "idle"; }
      savedResetTimeoutId = null;
    }, 2000);
  } catch (error) {
    saveStatus.value = "error";
    saveError.value = toErrorMessage(error, "Failed to save file.");
  }
};

const createEditor = async (container: HTMLElement, content: string) => {
  const languageExtensions = await loadLanguageExtension(props.filePath);

  const saveKeymap = keymap.of([{
    key: "Mod-s",
    run: () => { void saveFile(); return true; },
  }]);

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
      ...languageExtensions,
      EditorView.theme({
        "&": { height: "100%", fontSize: "13px" },
        ".cm-scroller": { overflow: "auto", fontFamily: "monospace" },
        ".cm-content": { padding: "4px 0" },
      }),
    ],
  });

  return new EditorView({ state, parent: container });
};

const loadAndCreateEditor = async () => {
  const container = editorContainer.value;
  if (!container) { return; }

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
      saveError.value = response.error ?? "Failed to read file.";
      return;
    }
    editorView = await createEditor(container, response.content);
  } catch (error) {
    saveStatus.value = "error";
    saveError.value = toErrorMessage(error, "Failed to load file.");
  }
};

watch(saveError, (message) => {
  if (message) {
    pushError(message);
  }
});

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
  clearSavedResetTimeout();
  if (editorView) {
    editorView.destroy();
    editorView = null;
  }
});
</script>
