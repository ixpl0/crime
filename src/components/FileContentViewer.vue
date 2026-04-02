<template>
  <div class="flex h-full min-h-0 flex-col rounded-box border border-base-300 bg-base-200/70 shadow-sm">
    <div class="border-b border-base-300/80 bg-base-100/40 px-3 py-2">
      <div class="flex items-center gap-2">
        <span class="truncate text-sm font-semibold">{{ filePath ? fileName : "Просмотр файла" }}</span>
        <div class="ml-auto flex items-center gap-1.5">
          <span v-if="filePath && !isLoading && !isEditing" class="text-[11px] text-base-content/45">
            <span v-if="isTruncated" class="text-warning/70">{{ `первые ${String(LARGE_FILE_LINE_THRESHOLD)} из ${String(displayLines.length)} строк` }}</span>
            <span v-else>{{ `${String(displayLines.length)} строк` }}</span>
          </span>
          <template v-if="changeCount > 0 && !isEditing && !isLoading">
            <button class="icon-btn text-base-content/40 hover:text-primary" tabindex="-1" title="Предыдущее изменение" @click="goToPrevChange">
              <ChevronUp :size="14" />
            </button>
            <span class="min-w-6 text-center text-[11px] text-base-content/55">{{ positionLabel }}</span>
            <button class="icon-btn text-base-content/40 hover:text-primary" tabindex="-1" title="Следующее изменение" @click="goToNextChange">
              <ChevronDown :size="14" />
            </button>
          </template>
          <button v-if="filePath && canEdit" class="icon-btn text-base-content/40 hover:text-warning" tabindex="-1" :title="isEditing ? 'Режим просмотра' : 'Редактировать'" @click="toggleEditMode">
            <component :is="isEditing ? Eye : Pencil" :size="14" />
          </button>
        </div>
      </div>
      <div v-if="filePath" class="truncate text-xs text-base-content/55">{{ filePath }}</div>
    </div>
    <FileEditor
      v-if="isEditing && filePath"
      :project-path="projectPath"
      :file-path="filePath"
      :is-active="isActive"
      :search-request-token="isActive ? searchRequestToken : undefined"
      class="min-h-0 flex-1"
      @saved="handleEditorSaved"
    />
    <div v-else class="min-h-0 flex-1 overflow-hidden bg-base-100/35">
      <div v-if="!filePath" class="flex h-full items-center justify-center px-4 text-sm text-base-content/60">
        Выберите файл для просмотра.
      </div>
      <div v-else-if="isLoading" class="flex h-full items-center justify-center"><span class="loading loading-spinner loading-md" /></div>
      <div v-else-if="loadError" class="flex h-full items-center justify-center px-4 text-sm text-base-content/55">Просмотр недоступен.</div>
      <div v-else-if="isBinaryFile" class="flex h-full flex-col items-center justify-center gap-2 px-4 text-sm text-base-content/60">
        <span>Бинарный файл — просмотр невозможен.</span>
        <button class="btn btn-ghost btn-xs" tabindex="-1" @click="openFileExternally">Показать в папке</button>
      </div>
      <div v-else-if="displayLines.length === 0" class="flex h-full items-center justify-center px-4 text-sm text-base-content/60">
        Файл пуст.
      </div>
      <CodeMirrorDiffViewer
        v-else
        ref="diffViewerRef"
        :file-path="filePath"
        :display-lines="visibleLines"
        :target-line="targetLine"
        :target-request-token="targetRequestToken"
        :search-request-token="isActive ? searchRequestToken : undefined"
      />
    </div>
    <div v-if="isTruncated && !isEditing" class="flex items-center gap-2 border-t border-base-300/80 bg-base-100/40 px-3 py-2 text-xs text-base-content/60">
      <span>Файл слишком большой для просмотра.</span>
      <button class="btn btn-ghost btn-xs" tabindex="-1" @click="openFileExternally">Показать в папке</button>
    </div>
    <div v-else-if="diffInfoMessage" class="border-t border-base-300/80 bg-base-100/40 px-3 py-2 text-xs text-base-content/60">
      {{ diffInfoMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ChevronDown, ChevronUp, Eye, Pencil } from "lucide-vue-next";
import { toErrorMessage } from "../utils/fail-fast";
import { useAppToastStore } from "../toast/toast-store";
import { LARGE_FILE_LINE_THRESHOLD } from "../codemirror/language-detection";
import { toContextDiffLines } from "./file-content-viewer-utils";
import FileEditor from "./FileEditor.vue";
import CodeMirrorDiffViewer from "./CodeMirrorDiffViewer.vue";
import { useDiffChangeNavigation } from "../composables/use-diff-change-navigation";

const props = defineProps<{
  projectPath: string;
  filePath: string | null;
  targetLine?: number | null;
  targetRequestToken?: number;
  refreshToken?: number;
  isActive: boolean;
  searchRequestToken?: number;
}>();

const emit = defineEmits<{ "file-not-found": [filePath: string]; "file-saved": [] }>();

const isEditing = ref(false);
const { pushError } = useAppToastStore();

const fileExistsOnDisk = ref(false);

const canEdit = computed(() => {
  if (!props.filePath) { return false; }
  return !isLoading.value && !loadError.value && !isBinaryFile.value && fileExistsOnDisk.value;
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

const openFileExternally = () => {
  if (props.filePath) {
    void window.projectApi.shell.openPath(props.filePath);
  }
};
type ViewerLine = GitDiffLine;
const isLoading = ref(false);
const loadError = ref("");
const isBinaryFile = ref(false);
const diffInfoMessage = ref("");
const displayLines = ref<ViewerLine[]>([]);
let loadRequestId = 0;

const fileName = computed(() => {
  if (!props.filePath) return "";
  const segments = props.filePath.split(/[\\/]/);
  return segments[segments.length - 1] ?? props.filePath;
});

const isTruncated = computed(() => displayLines.value.length > LARGE_FILE_LINE_THRESHOLD);

const visibleLines = computed(() => {
  if (!isTruncated.value) { return displayLines.value; }
  return displayLines.value.slice(0, LARGE_FILE_LINE_THRESHOLD);
});

function clearViewerContentState() {
  isLoading.value = false;
  loadError.value = "";
  isBinaryFile.value = false;
  diffInfoMessage.value = "";
  displayLines.value = [];
  fileExistsOnDisk.value = false;
}

function buildFallbackLines(fileResponse: FilesystemReadFileResponse): ViewerLine[] {
  if (!fileResponse.ok || typeof fileResponse.content !== "string") return [];
  return toContextDiffLines(fileResponse.content);
}

function applyFileReadError(fileResponse: FilesystemReadFileResponse) {
  if (!fileResponse.ok) loadError.value = fileResponse.error ?? "Не удалось прочитать файл.";
}

function isFileNotFoundError(error: unknown): error is { code: string; message: string } {
  return typeof error === "object" && error !== null && "code" in error && "message" in error && (error as { code: string }).code === "ENOENT";
}

function isFileNotFoundResponse(response: FilesystemReadFileResponse): boolean {
  return !response.ok && typeof response.error === "string" && response.error.includes("ENOENT");
}

function applyUnavailableDiffState(diffResponse: GitFileDiffResponse, fileResponse: FilesystemReadFileResponse, fallbackLines: ViewerLine[]) {
  displayLines.value = fallbackLines;
  diffInfoMessage.value = diffResponse.error ? `Git diff недоступен: ${diffResponse.error}` : "Git diff недоступен.";
  applyFileReadError(fileResponse);
}

function applyUnavailableGitState(diffResponse: GitFileDiffResponse, fileResponse: FilesystemReadFileResponse, fallbackLines: ViewerLine[]) {
  displayLines.value = fallbackLines;
  diffInfoMessage.value = diffResponse.reason === "git-not-installed" ? "Git не установлен. Показано содержимое файла." : "Выбранная папка не является Git-репозиторием.";
  applyFileReadError(fileResponse);
}

function applyLineFocusFallback(fileResponse: FilesystemReadFileResponse, fallbackLines: ViewerLine[]) {
  displayLines.value = fallbackLines;
  if (fileResponse.ok) {
    diffInfoMessage.value = "Показано содержимое файла для навигации по строкам.";
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
  isBinaryFile.value = false;
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
        loadError.value = "Файл удалён или не существует.";
      } else {
        loadError.value = toErrorMessage(error, "Не удалось загрузить превью файла.");
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
  isBinaryFile.value = responses.fileResponse.binary === true;
  if (!responses.fileResponse.ok && isEditing.value) {
    isEditing.value = false;
  }
  if (isFileNotFoundResponse(responses.fileResponse)) {
    emit("file-not-found", filePath);
    clearViewerContentState();
    return;
  }
  if (isBinaryFile.value) {
    displayLines.value = [];
    diffInfoMessage.value = "";
    return;
  }
  const fallbackLines = buildFallbackLines(responses.fileResponse);
  applyDiffResultState(responses.diffResponse, responses.fileResponse, fallbackLines);
}

const diffViewerRef = ref<InstanceType<typeof CodeMirrorDiffViewer> | null>(null);

const { changeCount, positionLabel, goToNext, goToPrevious } = useDiffChangeNavigation(() => visibleLines.value);

const goToNextChange = () => {
  const line = goToNext();
  if (line !== null) { diffViewerRef.value?.scrollToLine(line); }
};

const goToPrevChange = () => {
  const line = goToPrevious();
  if (line !== null) { diffViewerRef.value?.scrollToLine(line); }
};

watch(loadError, (message) => {
  if (message) {
    pushError(message);
  }
});
watch(() => props.filePath, () => { isEditing.value = false; });
watch(() => [props.projectPath, props.filePath, props.refreshToken ?? 0, props.isActive], () => { void loadFilePreview(); }, { immediate: true });
</script>
