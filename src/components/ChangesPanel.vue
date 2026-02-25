<template>
  <div class="flex h-96 flex-col rounded-box border border-base-300 bg-base-200">
    <div class="min-h-0 flex-1 overflow-y-auto p-2">
      <div v-if="isLoading" class="flex items-center justify-center py-8">
        <span class="loading loading-spinner loading-md" />
      </div>

      <div v-else-if="loadError" class="py-4 text-center text-sm text-error">
        {{ loadError }}
      </div>

      <div v-else-if="changeEntries.length === 0" class="py-4 text-center text-sm text-base-content/50">
        No changes detected
      </div>

      <div v-else>
        <button
          v-for="entry in changeEntries"
          :key="entry.path"
          class="flex w-full items-center gap-1.5 rounded px-1.5 py-0.5 text-left text-sm hover:bg-base-300"
          :class="entry.path === selectedPath ? 'bg-base-300' : ''"
          @click="emit('select-file', entry.path)"
        >
          <FilePlus v-if="entry.status === 'added'" :size="16" class="shrink-0 text-green-500" />
          <FilePen v-else-if="entry.status === 'modified'" :size="16" class="shrink-0 text-blue-500" />
          <FileX v-else-if="entry.status === 'deleted'" :size="16" class="shrink-0 text-red-500" />
          <File v-else :size="16" class="shrink-0 text-base-content/50" />
          <span class="truncate" :class="nameClasses(entry.status)">{{ entryDisplayName(entry.path) }}</span>
          <span class="ml-auto shrink-0 text-xs text-base-content/40">{{ entryDirectory(entry.path) }}</span>
        </button>
      </div>
    </div>

    <div
      v-if="infoMessage"
      class="border-t border-base-300 px-3 py-2 text-xs text-base-content/60"
    >
      {{ infoMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { File, FilePen, FilePlus, FileX } from "lucide-vue-next";
import { toErrorMessage } from "../utils/fail-fast";

const props = defineProps<{
  projectPath: string;
  selectedPath?: string | null;
}>();

const emit = defineEmits<{
  "select-file": [path: string];
}>();

const isLoading = ref(false);
const loadError = ref("");
const changeEntries = ref<GitStatusEntry[]>([]);
const infoMessage = ref("");
const REFRESH_INTERVAL_MS = 3000;
let loadRequestId = 0;
let refreshIntervalId: ReturnType<typeof setInterval> | null = null;
let isAutoRefreshInFlight = false;
let lastSnapshot = "";

const STATUS_PRIORITY: Record<GitFileStatus, number> = {
  modified: 0,
  added: 1,
  deleted: 2
};

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

function entryDisplayName(path: string) {
  const segments = path.replace(/\\/g, "/").split("/");
  return segments[segments.length - 1] ?? path;
}

function entryDirectory(path: string) {
  const normalizedProjectPath = props.projectPath.replace(/\\/g, "/").replace(/\/$/, "");
  const normalizedPath = path.replace(/\\/g, "/");
  const relative = normalizedPath.startsWith(`${normalizedProjectPath}/`)
    ? normalizedPath.slice(normalizedProjectPath.length + 1)
    : normalizedPath;

  const lastSlash = relative.lastIndexOf("/");
  if (lastSlash === -1) {
    return "";
  }

  return relative.slice(0, lastSlash);
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
    if (isLoading.value || isAutoRefreshInFlight) {
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
});

onBeforeUnmount(() => {
  stopAutoRefresh();
});

watch(() => props.projectPath, () => {
  lastSnapshot = "";
  void loadChanges();
  startAutoRefresh();
});
</script>
