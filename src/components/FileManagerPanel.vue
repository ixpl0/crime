<template>
  <div class="flex h-96 flex-col rounded-box border border-base-300 bg-base-200">
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
          :git-statuses="gitStatuses"
          :deleted-children-by-parent="deletedChildrenByParent"
          @select-file="(path) => emit('select-file', path)"
        />
      </div>
    </div>

    <div
      v-if="gitInfoMessage"
      class="border-t border-base-300 px-3 py-2 text-xs text-base-content/60"
    >
      {{ gitInfoMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import FileTreeNode from "./FileTreeNode.vue";
import {
  buildEntryListSnapshot,
  buildDeletedChildrenByParent,
  mergeDirectoryEntries,
  toGitStatusMap,
  type DeletedChildrenByParent
} from "./file-tree-status-utils";
import { toErrorMessage } from "../utils/fail-fast";

const props = defineProps<{
  projectPath: string;
}>();

const emit = defineEmits<{
  "select-file": [path: string];
}>();

const isLoading = ref(false);
const loadError = ref("");
const entries = ref<FileEntry[]>([]);
const gitStatuses = ref<Record<string, GitFileStatus>>({});
const deletedChildrenByParent = ref<DeletedChildrenByParent>({});
const gitInfoMessage = ref("");
const refreshToken = ref(0);
const GIT_STATUS_REFRESH_INTERVAL_MS = 3000;
let loadRequestId = 0;
let refreshIntervalId: ReturnType<typeof setInterval> | null = null;
let isAutoRefreshInFlight = false;
let lastStateSnapshot = "";
let lastStructureSnapshot = "";

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
    void loadRootDirectory(true).finally(() => {
      isAutoRefreshInFlight = false;
    });
  }, GIT_STATUS_REFRESH_INTERVAL_MS);
};

onMounted(() => {
  void loadRootDirectory();
  startAutoRefresh();
});

onBeforeUnmount(() => {
  stopAutoRefresh();
});

watch(() => props.projectPath, () => {
  lastStateSnapshot = "";
  lastStructureSnapshot = "";
  void loadRootDirectory();
  startAutoRefresh();
});
</script>
