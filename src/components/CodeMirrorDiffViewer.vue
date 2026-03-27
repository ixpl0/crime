<template>
  <div ref="container" class="h-full min-h-0" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { EditorView, lineNumbers } from "@codemirror/view";
import { EditorState, type Extension } from "@codemirror/state";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";
import { loadLanguageExtension, LARGE_FILE_LINE_THRESHOLD } from "../codemirror/language-detection";
import {
  createDiffLineDecorations,
  createDiffLineNumbers,
  createDiffPrefixGutter,
  setTargetLineEffect,
  targetLineHighlightField,
  diffViewerTheme,
} from "../codemirror/diff-decorations";

const props = defineProps<{
  filePath: string;
  displayLines: readonly GitDiffLine[];
  targetLine?: number | null;
  targetRequestToken?: number;
}>();

const container = ref<HTMLElement | null>(null);
let editorView: EditorView | null = null;
let clearHighlightTimeoutId: number | null = null;

const hasDiffContent = (lines: readonly GitDiffLine[]): boolean =>
  lines.some((line) => line.type !== "context");

const clearHighlightTimer = () => {
  if (clearHighlightTimeoutId !== null) {
    window.clearTimeout(clearHighlightTimeoutId);
    clearHighlightTimeoutId = null;
  }
};

const destroyEditor = () => {
  if (editorView) {
    editorView.destroy();
    editorView = null;
  }
};

const buildDocument = (lines: readonly GitDiffLine[]): string =>
  lines.map((line) => line.text).join("\n");

const buildDiffExtensions = (lines: readonly GitDiffLine[]): Extension[] => {
  if (!hasDiffContent(lines)) { return []; }
  return [
    EditorView.decorations.of(createDiffLineDecorations(lines)),
    createDiffLineNumbers(lines),
    createDiffPrefixGutter(lines),
  ];
};

const createEditor = async () => {
  const element = container.value;
  if (!element) { return; }

  destroyEditor();

  const document = buildDocument(props.displayLines);
  const isLargeFile = props.displayLines.length > LARGE_FILE_LINE_THRESHOLD;
  const languageExtensions = isLargeFile ? [] : await loadLanguageExtension(props.filePath);
  const isDiff = hasDiffContent(props.displayLines);
  const diffExtensions = isDiff ? buildDiffExtensions(props.displayLines) : [];

  const state = EditorState.create({
    doc: document,
    extensions: [
      ...(isDiff ? [] : [lineNumbers()]),
      EditorView.editable.of(false),
      EditorState.readOnly.of(true),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      oneDark,
      ...languageExtensions,
      ...diffExtensions,
      targetLineHighlightField,
      diffViewerTheme,
    ],
  });

  editorView = new EditorView({ state, parent: element });
};

const scrollToLineWithHighlight = (lineNumber: number) => {
  if (!editorView) { return; }
  const lineCount = editorView.state.doc.lines;
  const clamped = Math.max(1, Math.min(lineNumber, lineCount));

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

const focusTargetLine = () => {
  if (!editorView) { return; }

  const targetLine = props.targetLine ?? null;
  if (targetLine === null || targetLine <= 0) {
    editorView.dispatch({ effects: setTargetLineEffect.of(null) });
    clearHighlightTimer();
    return;
  }

  const lineCount = editorView.state.doc.lines;
  const clampedLine = Math.min(targetLine, lineCount);
  if (clampedLine < 1) { return; }

  scrollToLineWithHighlight(clampedLine);
};

defineExpose({ scrollToLine: scrollToLineWithHighlight });

watch(
  () => [props.displayLines, props.filePath] as const,
  () => { void createEditor(); },
);

watch(
  () => [props.targetLine ?? null, props.targetRequestToken ?? 0] as const,
  () => { focusTargetLine(); },
);

onMounted(() => {
  void createEditor();
});

onBeforeUnmount(() => {
  clearHighlightTimer();
  destroyEditor();
});
</script>
