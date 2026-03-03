<template>
  <div class="flex h-full min-h-0 flex-col rounded-box border border-base-300 bg-base-200/70 shadow-sm">
    <div class="border-b border-base-300/80 bg-base-100/40 px-3 py-2">
      <div class="flex items-center gap-2">
        <span class="truncate text-sm font-semibold">{{ filePath ? fileName : "File preview" }}</span>
        <span v-if="filePath && !isLoading && !isEditing" class="ml-auto text-[11px] text-base-content/45">
          {{ `${String(displayLines.length)} lines` }}
        </span>
        <button v-if="filePath && canEdit" class="ml-auto btn btn-ghost btn-xs btn-square" :title="isEditing ? 'Switch to viewer' : 'Edit file'" @click="toggleEditMode">
          <component :is="isEditing ? Eye : Pencil" :size="14" />
        </button>
      </div>
      <div v-if="filePath" class="truncate text-xs text-base-content/55">{{ filePath }}</div>
    </div>
    <FileEditor
      v-if="isEditing && filePath"
      :project-path="projectPath"
      :file-path="filePath"
      :is-active="isActive"
      class="min-h-0 flex-1"
      @saved="handleEditorSaved"
    />
    <div v-else ref="scrollContainer" class="min-h-0 flex-1 overflow-auto bg-base-100/35">
      <div v-if="!filePath" class="flex h-full items-center justify-center px-4 text-sm text-base-content/60">
        Select a file in tree to preview it.
      </div>
      <div v-else-if="isLoading" class="flex h-full items-center justify-center"><span class="loading loading-spinner loading-md" /></div>
      <div v-else-if="loadError" class="px-4 py-3 text-sm text-error">{{ loadError }}</div>
      <div v-else-if="displayLines.length === 0" class="flex h-full items-center justify-center px-4 text-sm text-base-content/60">
        File is empty.
      </div>
      <div v-else class="font-mono text-[13px] leading-6">
        <div v-for="(line, index) in displayLines" :key="`${line.type}:${String(index)}:${line.text}`" class="flex transition-colors duration-200 hover:bg-base-300/40" :data-line-number="index + 1" :class="lineRowClasses(line.type, index + 1)">
          <span class="w-14 shrink-0 select-none border-r border-base-300/50 px-2 py-0.5 text-right text-xs text-base-content/50">{{ index + 1 }}</span>
          <span class="flex-1 whitespace-pre px-3 py-0.5"><span class="mr-2 inline-block w-2 select-none opacity-80">{{ linePrefix(line.type) }}</span>{{ line.text }}</span>
        </div>
      </div>
    </div>
    <div v-if="diffInfoMessage" class="border-t border-base-300/80 bg-base-100/40 px-3 py-2 text-xs text-base-content/60">
      {{ diffInfoMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { Eye, Pencil } from "lucide-vue-next";
import { toErrorMessage } from "../utils/fail-fast";
import { diffLinePrefix as linePrefix, toContextDiffLines } from "./file-content-viewer-utils";
import FileEditor from "./FileEditor.vue";

const props = defineProps<{
  projectPath: string;
  filePath: string | null;
  targetLine?: number | null;
  targetRequestToken?: number;
  isActive: boolean;
}>();

const emit = defineEmits<{ "file-not-found": [filePath: string]; "file-saved": [] }>();

const isEditing = ref(false);

const canEdit = computed(() => {
  if (!props.filePath) { return false; }
  return !isLoading.value && !loadError.value;
});

const toggleEditMode = () => {
  isEditing.value = !isEditing.value;
  if (!isEditing.value) {
    void loadFilePreview();
  }
};

const handleEditorSaved = () => {
  emit("file-saved");
};
type ViewerLine = GitDiffLine;
const isLoading = ref(false);
const loadError = ref("");
const diffInfoMessage = ref("");
const displayLines = ref<ViewerLine[]>([]);
const highlightedLine = ref<number | null>(null);
const scrollContainer = ref<HTMLElement | null>(null);
let loadRequestId = 0;
let clearHighlightTimeoutId: number | null = null;

const fileName = computed(() => {
  if (!props.filePath) return "";
  const segments = props.filePath.split(/[\\/]/);
  return segments[segments.length - 1] ?? props.filePath;
});

function clearHighlightTimer() {
  if (clearHighlightTimeoutId === null) return;
  window.clearTimeout(clearHighlightTimeoutId);
  clearHighlightTimeoutId = null;
}

function resolveHighlightedLine(): number | null {
  if (!props.isActive || !props.filePath) return null;
  const targetLine = props.targetLine ?? null;
  if (targetLine === null || targetLine <= 0) return null;
  const lineCount = displayLines.value.length;
  if (lineCount === 0) return null;
  return Math.min(targetLine, lineCount);
}

function scheduleLineHighlightReset(lineNumber: number) {
  highlightedLine.value = lineNumber;
  clearHighlightTimer();
  clearHighlightTimeoutId = window.setTimeout(() => {
    if (highlightedLine.value === lineNumber) highlightedLine.value = null;
    clearHighlightTimeoutId = null;
  }, 2500);
}

async function scrollLineIntoView(lineNumber: number) {
  await nextTick();
  const container = scrollContainer.value;
  if (!container) return;
  const row = container.querySelector<HTMLElement>(`[data-line-number="${String(lineNumber)}"]`);
  row?.scrollIntoView({ block: "center", inline: "nearest" });
}

async function focusTargetLine() {
  const lineNumber = resolveHighlightedLine();
  if (lineNumber === null) {
    highlightedLine.value = null;
    clearHighlightTimer();
    return;
  }
  scheduleLineHighlightReset(lineNumber);
  await scrollLineIntoView(lineNumber);
}

function lineRowClasses(type: ViewerLine["type"], lineNumber: number) {
  const baseClass = highlightedLine.value === lineNumber ? "bg-warning/30 text-base-content ring-1 ring-warning/50" : "";
  if (type === "added") return baseClass || "bg-green-500/10 text-green-700";
  if (type === "removed") return baseClass || "bg-red-500/10 text-red-700";
  return baseClass || "text-base-content";
}

function clearViewerContentState() {
  isLoading.value = false;
  loadError.value = "";
  diffInfoMessage.value = "";
  displayLines.value = [];
  highlightedLine.value = null;
  clearHighlightTimer();
}

function buildFallbackLines(fileResponse: FilesystemReadFileResponse): ViewerLine[] {
  if (!fileResponse.ok || typeof fileResponse.content !== "string") return [];
  return toContextDiffLines(fileResponse.content);
}

function applyFileReadError(fileResponse: FilesystemReadFileResponse) {
  if (!fileResponse.ok) loadError.value = fileResponse.error ?? "Failed to read file.";
}

function isFileNotFoundError(error: unknown): error is { code: string; message: string } {
  return typeof error === "object" && error !== null && "code" in error && "message" in error && (error as { code: string }).code === "ENOENT";
}

function applyUnavailableDiffState(diffResponse: GitFileDiffResponse, fileResponse: FilesystemReadFileResponse, fallbackLines: ViewerLine[]) {
  displayLines.value = fallbackLines;
  diffInfoMessage.value = diffResponse.error ? `Git diff unavailable: ${diffResponse.error}` : "Git diff unavailable.";
  applyFileReadError(fileResponse);
}

function applyUnavailableGitState(diffResponse: GitFileDiffResponse, fileResponse: FilesystemReadFileResponse, fallbackLines: ViewerLine[]) {
  displayLines.value = fallbackLines;
  diffInfoMessage.value = diffResponse.reason === "git-not-installed" ? "Git is not installed. Showing plain file content." : "Selected folder is not a Git repository.";
  applyFileReadError(fileResponse);
}

function applyLineFocusFallback(fileResponse: FilesystemReadFileResponse, fallbackLines: ViewerLine[]) {
  displayLines.value = fallbackLines;
  if (fileResponse.ok) {
    diffInfoMessage.value = "Showing plain file content for line navigation.";
    return;
  }
  applyFileReadError(fileResponse);
}

function applyDiffResultState(diffResponse: GitFileDiffResponse, fileResponse: FilesystemReadFileResponse, fallbackLines: ViewerLine[]) {
  if (!diffResponse.ok) { applyUnavailableDiffState(diffResponse, fileResponse, fallbackLines); return; }
  if (!diffResponse.available) { applyUnavailableGitState(diffResponse, fileResponse, fallbackLines); return; }
  const diffLines = diffResponse.lines ?? [];
  if (diffLines.length === 0) { displayLines.value = fallbackLines; applyFileReadError(fileResponse); return; }
  const shouldFocusLine = props.targetLine !== null && props.targetLine !== undefined && props.targetLine > 0;
  if (shouldFocusLine) { applyLineFocusFallback(fileResponse, fallbackLines); return; }
  displayLines.value = diffLines;
}

function prepareFilePreviewLoad() {
  isLoading.value = true;
  loadError.value = "";
  diffInfoMessage.value = "";
}

async function requestFilePreviewResponses(requestId: number, filePath: string): Promise<{ fileResponse: FilesystemReadFileResponse; diffResponse: GitFileDiffResponse } | null> {
  try {
    const [fileResponse, diffResponse] = await Promise.all([window.projectApi.filesystem.readFile(props.projectPath, filePath), window.projectApi.git.getFileDiff(props.projectPath, filePath)]);
    return requestId === loadRequestId ? { fileResponse, diffResponse } : null;
  } catch (error) {
    if (requestId === loadRequestId) {
      isLoading.value = false;
      if (isFileNotFoundError(error)) {
        emit("file-not-found", filePath);
        loadError.value = "File was removed or does not exist.";
      } else {
        loadError.value = toErrorMessage(error, "Failed to load file preview.");
      }
      diffInfoMessage.value = "";
      displayLines.value = [];
    }
    return null;
  }
}

async function loadFilePreview() {
  const requestId = ++loadRequestId;
  const filePath = props.filePath;
  if (!filePath) { clearViewerContentState(); return; }
  if (!props.isActive) return;
  prepareFilePreviewLoad();
  const responses = await requestFilePreviewResponses(requestId, filePath);
  if (!responses) return;
  isLoading.value = false;
  const fallbackLines = buildFallbackLines(responses.fileResponse);
  applyDiffResultState(responses.diffResponse, responses.fileResponse, fallbackLines);
}

watch(() => props.filePath, () => { isEditing.value = false; });
watch(() => [props.projectPath, props.filePath, props.isActive], () => { void loadFilePreview(); }, { immediate: true });
watch(() => [props.filePath, props.targetLine ?? null, props.targetRequestToken ?? 0, props.isActive, displayLines.value.length] as const, () => { void focusTargetLine(); }, { immediate: true });
onBeforeUnmount(() => { clearHighlightTimer(); });
</script>
