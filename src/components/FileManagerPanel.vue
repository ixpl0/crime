<template>
  <div class="flex flex-col gap-2">
    <div class="relative flex h-96 flex-col rounded-box border border-base-300 bg-base-200">
      <div class="min-h-0 flex-1 overflow-y-auto p-2">
        <div v-if="isLoading" class="flex items-center justify-center py-8">
          <span class="loading loading-spinner loading-md" />
        </div>

        <div v-else-if="loadError" class="py-4 text-center text-sm text-error">
          {{ loadError }}
        </div>

        <div v-else-if="entries.length === 0" class="py-4 text-center text-sm text-base-content/50">
          Empty directory
        </div>

        <div v-else>
          <FileTreeNode
            v-for="entry in entries"
            :key="entry.path"
            :entry="entry"
            :depth="0"
            :refresh-token="refreshToken"
            :reveal-path="props.revealPath"
            :reveal-request-token="props.revealRequestToken"
            :git-statuses="gitStatuses"
            :deleted-children-by-parent="deletedChildrenByParent"
            @select-file="(path) => emit('select-file', path)"
            @context-menu="openContextMenu"
          />
        </div>
      </div>

      <div
        v-if="gitInfoMessage"
        class="border-t border-base-300 px-3 py-2 text-xs text-base-content/60"
      >
        {{ gitInfoMessage }}
      </div>

      <div
        v-if="contextMenu"
        ref="contextMenuElement"
        class="fixed z-50 min-w-52 rounded-box border border-base-300 bg-base-100 p-1 shadow-xl"
        :style="{ left: `${String(contextMenu.x)}px`, top: `${String(contextMenu.y)}px` }"
        @contextmenu.prevent
      >
        <button
          type="button"
          class="btn btn-ghost btn-sm w-full justify-start"
          :disabled="isActionInProgress"
          @click="handleContextMenuRevertClick"
        >
          <RotateCcw :size="14" />
          Откатить изменения
        </button>
      </div>
    </div>

    <div class="flex justify-end">
      <button
        type="button"
        class="btn btn-error btn-xs btn-outline"
        :disabled="!hasChanges || isLoading || isActionInProgress"
        @click="handleRevertAllClick"
      >
        <span v-if="isRevertingAll" class="loading loading-spinner loading-xs" />
        Откатить ВСЕ изменения
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { RotateCcw } from "lucide-vue-next";
import FileTreeNode from "./FileTreeNode.vue";
import {
  buildEntryListSnapshot,
  buildDeletedChildrenByParent,
  mergeDirectoryEntries,
  toGitStatusMap,
  type DeletedChildrenByParent
} from "./file-tree-status-utils";
import { toErrorMessage } from "../utils/fail-fast";

const props = withDefaults(
  defineProps<{
    projectPath: string;
    revealPath?: string | null;
    revealRequestToken?: number;
  }>(),
  {
    revealPath: null,
    revealRequestToken: 0
  }
);

const emit = defineEmits<{
  "select-file": [path: string];
}>();

interface ContextMenuPayload {
  event: MouseEvent;
  path: string;
  status: GitFileStatus;
}

interface ContextMenuState {
  x: number;
  y: number;
  path: string;
  status: GitFileStatus;
}

const isLoading = ref(false);
const loadError = ref("");
const entries = ref<FileEntry[]>([]);
const gitStatuses = ref<Record<string, GitFileStatus>>({});
const deletedChildrenByParent = ref<DeletedChildrenByParent>({});
const gitInfoMessage = ref("");
const contextMenu = ref<ContextMenuState | null>(null);
const contextMenuElement = ref<HTMLElement | null>(null);
const isRevertingAll = ref(false);
const revertingPath = ref<string | null>(null);
const refreshToken = ref(0);
const GIT_STATUS_REFRESH_INTERVAL_MS = 3000;
const CONTEXT_MENU_WIDTH = 220;
const CONTEXT_MENU_HEIGHT = 44;
let loadRequestId = 0;
let refreshIntervalId: ReturnType<typeof setInterval> | null = null;
let isAutoRefreshInFlight = false;
let lastStateSnapshot = "";
let lastStructureSnapshot = "";

const hasChanges = computed(() => Object.keys(gitStatuses.value).length > 0);
const isActionInProgress = computed(() => isRevertingAll.value || revertingPath.value !== null);

function getGitUnavailableMessage(reason?: GitMutateResponse["reason"]) {
  return reason === "git-not-installed"
    ? "Git is not installed."
    : "The selected folder is not a Git repository.";
}

function normalizeGitState(response: GitStatusResponse) {
  if (!response.ok) {
    return {
      statuses: {} as Record<string, GitFileStatus>,
      deletedChildren: {} as DeletedChildrenByParent,
      infoMessage: response.error
        ? `Git status unavailable: ${response.error}`
        : "Git status unavailable."
    };
  }

  if (!response.available) {
    if (response.reason === "git-not-installed") {
      return {
        statuses: {} as Record<string, GitFileStatus>,
        deletedChildren: {} as DeletedChildrenByParent,
        infoMessage: "Git is not installed. File status colors are disabled."
      };
    }

    return {
      statuses: {} as Record<string, GitFileStatus>,
      deletedChildren: {} as DeletedChildrenByParent,
      infoMessage: "The selected folder is not a Git repository."
    };
  }

  const gitEntries = response.entries ?? [];
  return {
    statuses: toGitStatusMap(gitEntries),
    deletedChildren: buildDeletedChildrenByParent(props.projectPath, gitEntries),
    infoMessage: ""
  };
}

function buildGitStatusesSnapshot(value: Record<string, GitFileStatus>) {
  const paths = Object.keys(value).sort();
  return paths.map((path) => `${path}:${value[path]}`).join("\n");
}

function buildDeletedChildrenSnapshot(value: DeletedChildrenByParent) {
  const parentPaths = Object.keys(value).sort();
  return parentPaths
    .map((parentPath) => {
      const children = value[parentPath] ?? [];
      const childrenSnapshot = children
        .map((entry) =>
          `${entry.path}|${entry.isDirectory ? "d" : "f"}|${entry.isVirtual ? "v" : "r"}`
        )
        .join(",");
      return `${parentPath}>${childrenSnapshot}`;
    })
    .join("\n");
}

function buildTreeSnapshot(payload: {
  entries: FileEntry[];
  statuses: Record<string, GitFileStatus>;
  deletedChildren: DeletedChildrenByParent;
  infoMessage: string;
  loadError: string;
}) {
  return [
    props.projectPath,
    payload.loadError,
    payload.infoMessage,
    buildEntryListSnapshot(payload.entries),
    buildGitStatusesSnapshot(payload.statuses),
    buildDeletedChildrenSnapshot(payload.deletedChildren)
  ].join("\n---\n");
}

function buildStructureSnapshot(payload: {
  entries: FileEntry[];
  deletedChildren: DeletedChildrenByParent;
}) {
  return [
    props.projectPath,
    buildEntryListSnapshot(payload.entries),
    buildDeletedChildrenSnapshot(payload.deletedChildren)
  ].join("\n---\n");
}

function clampContextMenuX(value: number) {
  const maxX = Math.max(8, window.innerWidth - CONTEXT_MENU_WIDTH - 8);
  return Math.min(Math.max(value, 8), maxX);
}

function clampContextMenuY(value: number) {
  const maxY = Math.max(8, window.innerHeight - CONTEXT_MENU_HEIGHT - 8);
  return Math.min(Math.max(value, 8), maxY);
}

function closeContextMenu() {
  contextMenu.value = null;
}

function openContextMenu(payload: ContextMenuPayload) {
  if (isActionInProgress.value) {
    return;
  }

  payload.event.preventDefault();
  contextMenu.value = {
    x: clampContextMenuX(payload.event.clientX),
    y: clampContextMenuY(payload.event.clientY),
    path: payload.path,
    status: payload.status
  };

  void nextTick(() => {
    contextMenuElement.value?.focus();
  });
}

function handleGlobalPointerDown(event: PointerEvent) {
  if (!contextMenu.value) {
    return;
  }

  const target = event.target;
  if (
    contextMenuElement.value &&
    target instanceof Node &&
    contextMenuElement.value.contains(target)
  ) {
    return;
  }

  closeContextMenu();
}

function handleGlobalKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    closeContextMenu();
  }
}

function handleGlobalScroll() {
  closeContextMenu();
}

async function revertPath(path: string) {
  if (isActionInProgress.value) {
    return;
  }

  const isConfirmed = window.confirm(`Откатить изменения файла?\n${path}`);
  if (!isConfirmed) {
    return;
  }

  closeContextMenu();
  revertingPath.value = path;
  loadError.value = "";

  try {
    const response = await window.projectApi.git.revertFile(props.projectPath, path);
    if (!response.ok) {
      loadError.value = response.error ?? "Failed to revert file changes.";
      return;
    }

    if (!response.available) {
      loadError.value = getGitUnavailableMessage(response.reason);
      return;
    }

    await loadRootDirectory();
  } catch (error) {
    loadError.value = toErrorMessage(error, "Failed to revert file changes.");
  } finally {
    revertingPath.value = null;
  }
}

async function revertAllChanges() {
  if (isActionInProgress.value || !hasChanges.value) {
    return;
  }

  const isConfirmed = window.confirm(
    "Откатить ВСЕ изменения в текущем проекте? Это удалит все незакоммиченные правки."
  );
  if (!isConfirmed) {
    return;
  }

  closeContextMenu();
  isRevertingAll.value = true;
  loadError.value = "";

  try {
    const response = await window.projectApi.git.revertAll(props.projectPath);
    if (!response.ok) {
      loadError.value = response.error ?? "Failed to revert all changes.";
      return;
    }

    if (!response.available) {
      loadError.value = getGitUnavailableMessage(response.reason);
      return;
    }

    await loadRootDirectory();
  } catch (error) {
    loadError.value = toErrorMessage(error, "Failed to revert all changes.");
  } finally {
    isRevertingAll.value = false;
  }
}

function handleContextMenuRevertClick() {
  if (!contextMenu.value) {
    return;
  }

  void revertPath(contextMenu.value.path);
}

function handleRevertAllClick() {
  void revertAllChanges();
}

const loadRootDirectory = async (isBackgroundRefresh = false) => {
  const requestId = ++loadRequestId;
  if (!isBackgroundRefresh) {
    isLoading.value = true;
    loadError.value = "";
  }

  let directoryResponse: FilesystemReadResponse;
  let gitResponse: GitStatusResponse;
  try {
    [directoryResponse, gitResponse] = await Promise.all([
      window.projectApi.filesystem.readDirectory(props.projectPath),
      window.projectApi.git.getStatus(props.projectPath)
    ]);
  } catch (error) {
    if (requestId !== loadRequestId) {
      return;
    }

    const message = toErrorMessage(error, "Failed to load project directory.");
    if (!isBackgroundRefresh) {
      isLoading.value = false;
      loadError.value = message;
    } else {
      gitInfoMessage.value = `Auto-refresh failed: ${message}`;
    }
    return;
  }

  if (requestId !== loadRequestId) {
    return;
  }

  if (!isBackgroundRefresh) {
    isLoading.value = false;
  }

  const normalizedGitState = normalizeGitState(gitResponse);
  const nextLoadError = directoryResponse.ok
    ? ""
    : directoryResponse.error ?? "Failed to read project directory.";

  const nextEntries = directoryResponse.ok
    ? mergeDirectoryEntries(
        directoryResponse.entries ?? [],
        normalizedGitState.deletedChildren[props.projectPath] ?? []
      )
    : [];

  const nextStateSnapshot = buildTreeSnapshot({
    entries: nextEntries,
    statuses: normalizedGitState.statuses,
    deletedChildren: normalizedGitState.deletedChildren,
    infoMessage: normalizedGitState.infoMessage,
    loadError: nextLoadError
  });
  const nextStructureSnapshot = buildStructureSnapshot({
    entries: nextEntries,
    deletedChildren: normalizedGitState.deletedChildren
  });

  if (nextStateSnapshot === lastStateSnapshot) {
    return;
  }

  const hasStructureChanged = nextStructureSnapshot !== lastStructureSnapshot;
  lastStateSnapshot = nextStateSnapshot;
  lastStructureSnapshot = nextStructureSnapshot;
  loadError.value = nextLoadError;
  gitStatuses.value = normalizedGitState.statuses;
  deletedChildrenByParent.value = normalizedGitState.deletedChildren;
  gitInfoMessage.value = normalizedGitState.infoMessage;
  entries.value = nextEntries;
  if (hasStructureChanged) {
    refreshToken.value += 1;
  }

  if (contextMenu.value && !(contextMenu.value.path in normalizedGitState.statuses)) {
    closeContextMenu();
  }
};

const stopAutoRefresh = () => {
  if (refreshIntervalId === null) {
    return;
  }

  clearInterval(refreshIntervalId);
  refreshIntervalId = null;
};

const startAutoRefresh = () => {
  stopAutoRefresh();
  refreshIntervalId = setInterval(() => {
    if (isLoading.value || isAutoRefreshInFlight || isActionInProgress.value) {
      return;
    }

    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      return;
    }

    isAutoRefreshInFlight = true;
    void loadRootDirectory(true).finally(() => {
      isAutoRefreshInFlight = false;
    });
  }, GIT_STATUS_REFRESH_INTERVAL_MS);
};

onMounted(() => {
  void loadRootDirectory();
  startAutoRefresh();
  window.addEventListener("pointerdown", handleGlobalPointerDown, true);
  window.addEventListener("keydown", handleGlobalKeydown, true);
  window.addEventListener("scroll", handleGlobalScroll, true);
});

onBeforeUnmount(() => {
  stopAutoRefresh();
  window.removeEventListener("pointerdown", handleGlobalPointerDown, true);
  window.removeEventListener("keydown", handleGlobalKeydown, true);
  window.removeEventListener("scroll", handleGlobalScroll, true);
});

watch(() => props.projectPath, () => {
  lastStateSnapshot = "";
  lastStructureSnapshot = "";
  closeContextMenu();
  void loadRootDirectory();
  startAutoRefresh();
});
</script>
