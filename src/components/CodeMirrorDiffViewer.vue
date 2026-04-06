<template>
  <div ref="container" class="h-full min-h-0" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { EditorView, lineNumbers } from "@codemirror/view";
import { EditorState, type Extension } from "@codemirror/state";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";
import { search, openSearchPanel } from "@codemirror/search";
import { loadLanguageExtension, LARGE_FILE_LINE_THRESHOLD } from "../codemirror/language-detection";
import {
  createDiffLineDecorations,
  createDiffLineNumbers,
  createDiffPrefixGutter,
  setTargetLineEffect,
  targetLineHighlightField,
  diffViewerTheme,
} from "../codemirror/diff-decorations";
import {
  conflictDecorationsField,
  conflictTheme,
  hasConflictMarkers,
  parseConflictRegions,
  type ConflictRegion
} from "../codemirror/conflict-decorations";
import { searchMatchCounter } from "../codemirror/search-match-counter";

type ConflictActionKind = "accept-current" | "accept-incoming" | "accept-both";

const props = defineProps<{
  filePath: string;
  displayLines: readonly GitDiffLine[];
  targetLine?: number | null;
  targetRequestToken?: number;
  searchRequestToken?: number;
}>();

const emit = defineEmits<{
  "conflict-action": [action: ConflictActionKind, region: ConflictRegion];
}>();

const container = ref<HTMLElement | null>(null);
let editorView: EditorView | null = null;
let clearHighlightTimeoutId: number | null = null;
let currentConflictRegions: readonly ConflictRegion[] = [];

const hasDiffContent = (lines: readonly GitDiffLine[]): boolean =>
  lines.some((line) => line.type !== "context");

const clearHighlightTimer = () => {
  if (clearHighlightTimeoutId !== null) {
    window.clearTimeout(clearHighlightTimeoutId);
    clearHighlightTimeoutId = null;
  }
};

const handleConflictEvent = (event: Event) => {
  const detail = (event as CustomEvent).detail as { action: ConflictActionKind; regionIndex: number } | undefined;
  if (!detail) {
    return;
  }
  const region = currentConflictRegions[detail.regionIndex] as ConflictRegion | undefined;
  if (region) {
    emit("conflict-action", detail.action, region);
  }
};

const destroyEditor = () => {
  if (editorView) {
    editorView.dom.removeEventListener("conflict-action", handleConflictEvent);
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

const buildEditorExtensions = (
  isDiff: boolean,
  diffExtensions: Extension[],
  conflictExtensions: Extension[],
  languageExtensions: Extension[]
): Extension[] => [
  ...(isDiff ? [] : [lineNumbers()]),
  EditorView.editable.of(false),
  EditorState.readOnly.of(true),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  oneDark,
  ...languageExtensions,
  ...diffExtensions,
  ...conflictExtensions,
  targetLineHighlightField,
  search({ top: true }),
  searchMatchCounter,
  diffViewerTheme,
];

const createEditor = async () => {
  const element = container.value;
  if (!element) { return; }

  destroyEditor();

  const document = buildDocument(props.displayLines);
  const isLargeFile = props.displayLines.length > LARGE_FILE_LINE_THRESHOLD;
  const languageExtensions = isLargeFile ? [] : await loadLanguageExtension(props.filePath);
  const isDiff = hasDiffContent(props.displayLines);
  const diffExtensions = isDiff ? buildDiffExtensions(props.displayLines) : [];
  const hasConflicts = hasConflictMarkers(document);
  const conflictExtensions = hasConflicts ? [conflictDecorationsField, conflictTheme] : [];
  currentConflictRegions = hasConflicts ? parseConflictRegions(document) : [];

  const state = EditorState.create({
    doc: document,
    extensions: buildEditorExtensions(isDiff, diffExtensions, conflictExtensions, languageExtensions),
  });

  editorView = new EditorView({ state, parent: element });
  editorView.dom.addEventListener("conflict-action", handleConflictEvent);
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

const openSearch = () => {
  if (editorView) {
    openSearchPanel(editorView);
  }
};

defineExpose({ scrollToLine: scrollToLineWithHighlight });

watch(
  () => [props.displayLines, props.filePath] as const,
  () => { void createEditor().then(focusTargetLine); },
);

watch(
  () => [props.targetLine ?? null, props.targetRequestToken ?? 0] as const,
  () => { focusTargetLine(); },
);

watch(
  () => props.searchRequestToken ?? 0,
  () => { openSearch(); },
);

onMounted(() => {
  void createEditor().then(focusTargetLine);
});

onBeforeUnmount(() => {
  clearHighlightTimer();
  destroyEditor();
});
</script>
