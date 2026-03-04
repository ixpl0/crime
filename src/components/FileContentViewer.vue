<template>
  <div class="flex h-full min-h-0 flex-col rounded-box border border-base-300 bg-base-200/70 shadow-sm">
    <div class="border-b border-base-300/80 bg-base-100/40 px-3 py-2">
      <div class="flex items-center gap-2">
        <span class="truncate text-sm font-semibold">{{ filePath ? fileName : "File preview" }}</span>
        <span v-if="filePath && !isLoading && !isEditing" class="ml-auto text-[11px] text-base-content/45">
          {{ `${String(displayLines.length)} lines` }}
        </span>
        <button v-if="filePath && canEdit" class="ml-auto btn btn-ghost btn-xs btn-square" tabindex="-1" :title="isEditing ? 'Switch to viewer' : 'Edit file'" @click="toggleEditMode">
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
    <div v-else class="min-h-0 flex-1 overflow-hidden bg-base-100/35">
      <div v-if="!filePath" class="flex h-full items-center justify-center px-4 text-sm text-base-content/60">
        Select a file in tree to preview it.
      </div>
      <div v-else-if="isLoading" class="flex h-full items-center justify-center"><span class="loading loading-spinner loading-md" /></div>
      <div v-else-if="loadError" class="px-4 py-3 text-sm text-error">{{ loadError }}</div>
      <div v-else-if="displayLines.length === 0" class="flex h-full items-center justify-center px-4 text-sm text-base-content/60">
        File is empty.
      </div>
      <CodeMirrorDiffViewer
        v-else
        :file-path="filePath"
        :display-lines="displayLines"
        :target-line="targetLine"
        :target-request-token="targetRequestToken"
      />
    </div>
    <div v-if="diffInfoMessage" class="border-t border-base-300/80 bg-base-100/40 px-3 py-2 text-xs text-base-content/60">
      {{ diffInfoMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Eye, Pencil } from "lucide-vue-next";
import { toErrorMessage } from "../utils/fail-fast";
import { toContextDiffLines } from "./file-content-viewer-utils";
import FileEditor from "./FileEditor.vue";
import CodeMirrorDiffViewer from "./CodeMirrorDiffViewer.vue";

const props = defineProps<{
  projectPath: string;
  filePath: string | null;
  targetLine?: number | null;
  targetRequestToken?: number;
  refreshToken?: number;
  isActive: boolean;
}>();

const emit = defineEmits<{ "file-not-found": [filePath: string]; "file-saved": [] }>();

const isEditing = ref(false);

const fileExistsOnDisk = ref(false);

const canEdit = computed(() => {
  if (!props.filePath) { return false; }
  return !isLoading.value && !loadError.value && fileExistsOnDisk.value;
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
let loadRequestId = 0;

const fileName = computed(() => {
  if (!props.filePath) return "";
  const segments = props.filePath.split(/[\\/]/);
  return segments[segments.length - 1] ?? props.filePath;
});

function clearViewerContentState() {
  isLoading.value = false;
  loadError.value = "";
  diffInfoMessage.value = "";
  displayLines.value = [];
  fileExistsOnDisk.value = false;
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
      fileExistsOnDisk.value = false;
      if (isEditing.value) { isEditing.value = false; }
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
  fileExistsOnDisk.value = responses.fileResponse.ok;
  if (!responses.fileResponse.ok && isEditing.value) {
    isEditing.value = false;
  }
  const fallbackLines = buildFallbackLines(responses.fileResponse);
  applyDiffResultState(responses.diffResponse, responses.fileResponse, fallbackLines);
}

watch(() => props.filePath, () => { isEditing.value = false; });
watch(() => [props.projectPath, props.filePath, props.refreshToken ?? 0, props.isActive], () => { void loadFilePreview(); }, { immediate: true });
</script>
