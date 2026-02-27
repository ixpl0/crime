<template>
  <div class="flex h-full min-h-0 flex-col gap-3">
    <div class="relative flex min-h-0 flex-1 flex-col rounded-box border border-base-300 bg-base-200/70 shadow-sm">
      <div class="flex items-center gap-2 border-b border-base-300/80 px-3 py-2">
        <span class="text-xs font-semibold uppercase tracking-wide text-base-content/60">
          Changes
        </span>
        <div v-if="hasChanges" class="ml-auto flex items-center gap-1 text-[10px] font-semibold tracking-wide">
          <span
            v-if="statusCounts.modified > 0"
            class="rounded-full bg-blue-500/15 px-2 py-0.5 text-blue-600"
          >
            M {{ statusCounts.modified }}
          </span>
          <span
            v-if="statusCounts.added > 0"
            class="rounded-full bg-green-500/15 px-2 py-0.5 text-green-600"
          >
            A {{ statusCounts.added }}
          </span>
          <span
            v-if="statusCounts.deleted > 0"
            class="rounded-full bg-red-500/15 px-2 py-0.5 text-red-600"
          >
            D {{ statusCounts.deleted }}
          </span>
        </div>
        <span v-else class="ml-auto text-[11px] text-base-content/45">
          Working tree clean
        </span>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        <div v-if="isLoading" class="flex items-center justify-center py-8">
          <span class="loading loading-spinner loading-md" />
        </div>

        <div v-else-if="loadError" class="py-4 text-center text-sm text-error">
          {{ loadError }}
        </div>

        <div v-else-if="changeEntries.length === 0" class="py-4 text-center text-sm text-base-content/50">
          No changes detected
        </div>

        <div v-else class="space-y-1">
          <button
            v-for="entry in changeEntries"
            :key="entry.path"
            class="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left text-sm hover:border-base-300 hover:bg-base-300/65"
            :class="{
              'border-primary/40 bg-primary/10': entry.path === selectedPath,
              'opacity-70': isRevertingAll || isPathReverting(entry.path)
            }"
            :disabled="isRevertingAll || isPathReverting(entry.path)"
            @click="emit('select-file', entry.path)"
            @contextmenu="openContextMenu($event, entry)"
          >
            <FilePlus v-if="entry.status === 'added'" :size="16" class="shrink-0 text-green-500" />
            <FilePen v-else-if="entry.status === 'modified'" :size="16" class="shrink-0 text-blue-500" />
            <FileX v-else-if="entry.status === 'deleted'" :size="16" class="shrink-0 text-red-500" />
            <File v-else :size="16" class="shrink-0 text-base-content/50" />
            <div class="min-w-0">
              <div class="truncate font-medium" :class="nameClasses(entry.status)">
                {{ entryDisplayName(entry.path) }}
              </div>
              <span
                class="inline-block max-w-full cursor-pointer truncate text-[11px] text-base-content/45 hover:underline"
                @click.stop="handleEntryPathClick(entry.path)"
              >
                {{ entryPathDisplay(entry.path) }}
              </span>
            </div>
            <span
              class="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              :class="statusBadgeClasses(entry.status)"
            >
              {{ statusLabel(entry.status) }}
            </span>
          </button>
        </div>
      </div>

      <div
        v-if="infoMessage"
        class="border-t border-base-300/80 bg-base-100/40 px-3 py-2 text-xs text-base-content/60"
      >
        {{ infoMessage }}
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

    <div class="flex items-center justify-end">
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
import { File, FilePen, FilePlus, FileX, RotateCcw } from "lucide-vue-next";
import { toErrorMessage } from "../utils/fail-fast";

const props = defineProps<{
  projectPath: string;
  selectedPath?: string | null;
}>();

const emit = defineEmits<{
  "select-file": [path: string];
  "open-path": [path: string];
}>();

interface ContextMenuState {
  x: number;
  y: number;
  path: string;
  status: GitFileStatus;
}

const isLoading = ref(false);
const loadError = ref("");
const changeEntries = ref<GitStatusEntry[]>([]);
const infoMessage = ref("");
const contextMenu = ref<ContextMenuState | null>(null);
const contextMenuElement = ref<HTMLElement | null>(null);
const isRevertingAll = ref(false);
const revertingPath = ref<string | null>(null);
const REFRESH_INTERVAL_MS = 3000;
const CONTEXT_MENU_WIDTH = 220;
const CONTEXT_MENU_HEIGHT = 44;
let loadRequestId = 0;
let refreshIntervalId: ReturnType<typeof setInterval> | null = null;
let isAutoRefreshInFlight = false;
let lastSnapshot = "";

const STATUS_PRIORITY: Record<GitFileStatus, number> = {
  modified: 0,
  added: 1,
  deleted: 2
};

const hasChanges = computed(() => changeEntries.value.length > 0);
const statusCounts = computed<Record<GitFileStatus, number>>(() => {
  const counts: Record<GitFileStatus, number> = {
    modified: 0,
    added: 0,
    deleted: 0
  };

  for (const entry of changeEntries.value) {
    counts[entry.status] += 1;
  }

  return counts;
});
const isActionInProgress = computed(() => isRevertingAll.value || revertingPath.value !== null);

function getGitUnavailableMessage(reason?: GitMutateResponse["reason"]) {
  return reason === "git-not-installed"
    ? "Git is not installed."
    : "The selected folder is not a Git repository.";
}

function buildSnapshot(entries: GitStatusEntry[], info: string, error: string) {
  const sorted = entries.map((entry) => `${entry.path}:${entry.status}`).join("\n");
  return `${info}\n${error}\n${sorted}`;
}

function nameClasses(status: GitFileStatus) {
  if (status === "added") {
    return "text-green-600";
  }

  if (status === "modified") {
    return "text-blue-600";
  }

  return "text-red-600";
}

function statusLabel(status: GitFileStatus) {
  if (status === "added") {
    return "added";
  }

  if (status === "modified") {
    return "modified";
  }

  return "deleted";
}

function statusBadgeClasses(status: GitFileStatus) {
  if (status === "added") {
    return "bg-green-500/15 text-green-600";
  }

  if (status === "modified") {
    return "bg-blue-500/15 text-blue-600";
  }

  return "bg-red-500/15 text-red-600";
}

function entryDisplayName(path: string) {
  const segments = path.replace(/\\/g, "/").split("/");
  return segments[segments.length - 1] ?? path;
}

function toRelativeEntryPath(path: string) {
  const normalizedProjectPath = props.projectPath.replace(/\\/g, "/").replace(/\/$/, "");
  const normalizedPath = path.replace(/\\/g, "/");
  return normalizedPath.startsWith(`${normalizedProjectPath}/`)
    ? normalizedPath.slice(normalizedProjectPath.length + 1)
    : normalizedPath;
}

function entryPathDisplay(path: string) {
  const relative = toRelativeEntryPath(path);
  return relative.startsWith("/") ? relative : `/${relative}`;
}

function handleEntryPathClick(path: string) {
  emit("open-path", path);
}

function sortEntries(entries: GitStatusEntry[]) {
  return [...entries].sort((a, b) => {
    const priorityDiff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return a.path.localeCompare(b.path);
  });
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

function isPathReverting(path: string) {
  return revertingPath.value === path;
}

function openContextMenu(event: MouseEvent, entry: GitStatusEntry) {
  if (isActionInProgress.value) {
    return;
  }

  event.preventDefault();
  contextMenu.value = {
    x: clampContextMenuX(event.clientX),
    y: clampContextMenuY(event.clientY),
    path: entry.path,
    status: entry.status
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

    await loadChanges();
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

    await loadChanges();
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

const loadChanges = async (isBackgroundRefresh = false) => {
  const requestId = ++loadRequestId;
  if (!isBackgroundRefresh) {
    isLoading.value = true;
    loadError.value = "";
  }

  let response: GitStatusResponse;
  try {
    response = await window.projectApi.git.getStatus(props.projectPath);
  } catch (error) {
    if (requestId !== loadRequestId) {
      return;
    }

    const message = toErrorMessage(error, "Failed to load git status.");
    if (!isBackgroundRefresh) {
      isLoading.value = false;
      loadError.value = message;
    } else {
      infoMessage.value = `Auto-refresh failed: ${message}`;
    }
    return;
  }

  if (requestId !== loadRequestId) {
    return;
  }

  if (!isBackgroundRefresh) {
    isLoading.value = false;
  }

  if (!response.ok) {
    const nextError = response.error ?? "Git status unavailable.";
    const nextInfo = "";
    const nextSnapshot = buildSnapshot([], nextInfo, nextError);
    if (nextSnapshot !== lastSnapshot) {
      lastSnapshot = nextSnapshot;
      loadError.value = nextError;
      infoMessage.value = nextInfo;
      changeEntries.value = [];
    }
    closeContextMenu();
    return;
  }

  if (!response.available) {
    const nextInfo = response.reason === "git-not-installed"
      ? "Git is not installed."
      : "The selected folder is not a Git repository.";
    const nextSnapshot = buildSnapshot([], nextInfo, "");
    if (nextSnapshot !== lastSnapshot) {
      lastSnapshot = nextSnapshot;
      loadError.value = "";
      infoMessage.value = nextInfo;
      changeEntries.value = [];
    }
    closeContextMenu();
    return;
  }

  const nextEntries = sortEntries(response.entries ?? []);
  const nextInfo = nextEntries.length > 0 ? `${String(nextEntries.length)} changed` : "";
  const nextSnapshot = buildSnapshot(nextEntries, nextInfo, "");
  if (nextSnapshot !== lastSnapshot) {
    lastSnapshot = nextSnapshot;
    loadError.value = "";
    infoMessage.value = nextInfo;
    changeEntries.value = nextEntries;
  }

  if (contextMenu.value && !nextEntries.some((entry) => entry.path === contextMenu.value?.path)) {
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
    void loadChanges(true).finally(() => {
      isAutoRefreshInFlight = false;
    });
  }, REFRESH_INTERVAL_MS);
};

onMounted(() => {
  void loadChanges();
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
  lastSnapshot = "";
  closeContextMenu();
  void loadChanges();
  startAutoRefresh();
});
</script>
