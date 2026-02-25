<template>
  <div>
    <button
      class="flex w-full items-center gap-1.5 rounded px-1.5 py-0.5 text-left text-sm hover:bg-base-300"
      :class="buttonClasses"
      :style="{ paddingLeft: `${depth * 1}rem` }"
      @click="handleClick"
    >
      <template v-if="entry.isDirectory">
        <FolderOpen v-if="isExpanded" :size="16" class="shrink-0" :class="folderIconClasses" />
        <Folder v-else :size="16" class="shrink-0" :class="folderIconClasses" />
      </template>
      <FileIcon v-else :size="16" class="shrink-0" :class="fileIconClasses" />
      <span class="truncate" :class="nameClasses">{{ entry.name }}</span>
    </button>

    <div v-if="isExpanded && children.length > 0">
      <FileTreeNode
        v-for="child in children"
        :key="child.path"
        :entry="child"
        :depth="depth + 1"
        :refresh-token="refreshToken"
        :reveal-path="revealPath"
        :reveal-request-token="revealRequestToken"
        :git-statuses="gitStatuses"
        :deleted-children-by-parent="deletedChildrenByParent"
        @select-file="(path) => emit('select-file', path)"
      />
    </div>

    <div
      v-if="isExpanded && isLoading"
      class="flex items-center gap-1.5 py-0.5 text-sm text-base-content/50"
      :style="{ paddingLeft: `${(depth + 1) * 1}rem` }"
    >
      <span class="loading loading-spinner loading-xs" />
    </div>

    <div
      v-if="isExpanded && loadError"
      class="py-0.5 text-sm text-error"
      :style="{ paddingLeft: `${(depth + 1) * 1}rem` }"
    >
      {{ loadError }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Folder, FolderOpen, File as FileIcon } from "lucide-vue-next";
import {
  buildEntryListSnapshot,
  mergeDirectoryEntries,
  type DeletedChildrenByParent
} from "./file-tree-status-utils";
import { toErrorMessage } from "../utils/fail-fast";

const props = withDefaults(
  defineProps<{
    entry: FileEntry;
    depth: number;
    refreshToken: number;
    revealPath?: string | null;
    revealRequestToken?: number;
    gitStatuses: Record<string, GitFileStatus>;
    deletedChildrenByParent: DeletedChildrenByParent;
  }>(),
  {
    revealPath: null,
    revealRequestToken: 0
  }
);

const emit = defineEmits<{
  "select-file": [path: string];
}>();

const isExpanded = ref(false);
const isLoading = ref(false);
const loadError = ref("");
const children = ref<FileEntry[]>([]);
let hasLoaded = false;
let lastChildrenSnapshot = "";

function normalizePathForComparison(path: string) {
  const normalizedPath = path.replace(/[\\/]+/g, "/");
  if (normalizedPath === "/") {
    return normalizedPath;
  }

  const withoutTrailingSlash = normalizedPath.replace(/\/+$/, "");
  const stablePath = withoutTrailingSlash.length > 0 ? withoutTrailingSlash : normalizedPath;
  return /^[A-Za-z]:\//.test(stablePath) ? stablePath.toLowerCase() : stablePath;
}

function isPathInsideBase(basePath: string, targetPath: string) {
  const normalizedBasePath = normalizePathForComparison(basePath);
  const normalizedTargetPath = normalizePathForComparison(targetPath);

  if (normalizedTargetPath === normalizedBasePath) {
    return true;
  }

  if (normalizedBasePath === "/") {
    return normalizedTargetPath.startsWith("/");
  }

  return normalizedTargetPath.startsWith(`${normalizedBasePath}/`);
}

function isSamePath(leftPath: string, rightPath: string) {
  return normalizePathForComparison(leftPath) === normalizePathForComparison(rightPath);
}

const entryStatus = computed<GitFileStatus | null>(() => {
  if (props.entry.isVirtual) {
    return "deleted";
  }

  return props.gitStatuses[props.entry.path] ?? null;
});

const isDeletedEntry = computed(() => entryStatus.value === "deleted");
const isIgnoredEntry = computed(() => props.entry.isIgnored === true);

const buttonClasses = computed(() => {
  if (isIgnoredEntry.value) {
    return "opacity-[0.55]";
  }

  return isDeletedEntry.value ? "opacity-90" : "";
});

const nameClasses = computed(() => {
  if (entryStatus.value === "added") {
    return "text-green-600";
  }

  if (entryStatus.value === "modified") {
    return "text-blue-600";
  }

  if (entryStatus.value === "deleted") {
    return "text-red-600";
  }

  return "";
});

const folderIconClasses = computed(() => {
  if (entryStatus.value === "deleted") {
    return "text-red-500";
  }

  return "text-warning";
});

const fileIconClasses = computed(() => {
  if (entryStatus.value === "added") {
    return "text-green-500";
  }

  if (entryStatus.value === "modified") {
    return "text-blue-500";
  }

  if (entryStatus.value === "deleted") {
    return "text-red-500";
  }

  return "text-base-content/50";
});

async function loadChildren(options: { forceReload?: boolean; silent?: boolean } = {}) {
  if (!props.entry.isDirectory) {
    return;
  }

  const { forceReload = false, silent = false } = options;
  const virtualChildren = props.deletedChildrenByParent[props.entry.path] ?? [];

  if (props.entry.isVirtual) {
    const nextChildren = mergeDirectoryEntries([], virtualChildren);
    const nextSnapshot = buildEntryListSnapshot(nextChildren);
    if (nextSnapshot !== lastChildrenSnapshot) {
      lastChildrenSnapshot = nextSnapshot;
      children.value = nextChildren;
    }
    hasLoaded = true;
    return;
  }

  if (!forceReload && hasLoaded) {
    return;
  }

  if (!silent) {
    isLoading.value = true;
    loadError.value = "";
  }

  let response: FilesystemReadResponse;
  try {
    response = await window.projectApi.filesystem.readDirectory(props.entry.path);
  } catch (error) {
    const message = toErrorMessage(error, "Failed to read directory.");
    if (!silent) {
      isLoading.value = false;
    }
    loadError.value = message;
    return;
  }

  if (!silent) {
    isLoading.value = false;
  }

  if (!response.ok) {
    if (virtualChildren.length > 0) {
      const nextChildren = mergeDirectoryEntries([], virtualChildren);
      const nextSnapshot = buildEntryListSnapshot(nextChildren);
      if (nextSnapshot !== lastChildrenSnapshot) {
        lastChildrenSnapshot = nextSnapshot;
        children.value = nextChildren;
      }
      hasLoaded = true;
      return;
    }

    if (!silent) {
      loadError.value = response.error ?? "Failed to read directory.";
    }
    return;
  }

  const nextChildren = mergeDirectoryEntries(response.entries ?? [], virtualChildren);
  const nextSnapshot = buildEntryListSnapshot(nextChildren);
  if (nextSnapshot !== lastChildrenSnapshot) {
    lastChildrenSnapshot = nextSnapshot;
    children.value = nextChildren;
  }
  hasLoaded = true;
}

async function revealRequestedPath(revealPath: string | null) {
  if (!revealPath) {
    return;
  }

  if (!props.entry.isDirectory) {
    if (isSamePath(props.entry.path, revealPath)) {
      emit("select-file", props.entry.path);
    }
    return;
  }

  if (!isPathInsideBase(props.entry.path, revealPath)) {
    return;
  }

  if (!isExpanded.value) {
    isExpanded.value = true;
  }

  await loadChildren({ silent: true });
}

const handleClick = async () => {
  if (!props.entry.isDirectory) {
    emit("select-file", props.entry.path);
    return;
  }

  if (isExpanded.value) {
    isExpanded.value = false;
    return;
  }

  isExpanded.value = true;

  if (hasLoaded) {
    return;
  }

  await loadChildren();
};

watch(
  () => [props.revealPath, props.revealRequestToken] as const,
  ([revealPath]) => {
    void revealRequestedPath(revealPath);
  },
  { immediate: true }
);

watch(
  () => props.refreshToken,
  () => {
    if (!props.entry.isDirectory) {
      return;
    }

    if (props.entry.isVirtual) {
      void loadChildren({ forceReload: true, silent: true });
      return;
    }

    if (isExpanded.value) {
      void loadChildren({ forceReload: true, silent: true });
      return;
    }

    hasLoaded = false;
  }
);
</script>
