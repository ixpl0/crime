<template>
  <div>
    <button
      class="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left text-sm hover:border-base-300 hover:bg-base-300/65"
      tabindex="-1"
      :class="buttonClasses"
      :style="{ paddingLeft: `${NODE_BASE_PADDING_REM + depth * NODE_INDENT_REM}rem` }"
      @click="handleClick"
      @contextmenu="handleContextMenu"
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
        :selected-path="selectedPath"
        :reveal-path="revealPath"
        :reveal-request-token="revealRequestToken"
        :git-statuses="gitStatuses"
        :deleted-children-by-parent="deletedChildrenByParent"
        @select-file="(path) => emit('select-file', path)"
        @context-menu="(payload) => emit('context-menu', payload)"
      />
    </div>

    <div
      v-if="isExpanded && isLoading"
      class="flex items-center gap-1.5 py-0.5 text-sm text-base-content/50"
      :style="{ paddingLeft: `${NODE_BASE_PADDING_REM + (depth + 1) * NODE_INDENT_REM}rem` }"
    >
      <span class="loading loading-spinner loading-xs" />
    </div>

    <div
      v-if="isExpanded && loadError"
      class="py-0.5 text-sm text-error"
      :style="{ paddingLeft: `${NODE_BASE_PADDING_REM + (depth + 1) * NODE_INDENT_REM}rem` }"
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
import { isPathInsideBase, isSamePath } from "../../utils/path-utils";
import { toErrorMessage } from "../../utils/fail-fast";

const props = withDefaults(
  defineProps<{
    entry: FileEntry;
    depth: number;
    refreshToken: number;
    selectedPath?: string | null;
    revealPath?: string | null;
    revealRequestToken?: number;
    gitStatuses: Record<string, GitFileStatus>;
    deletedChildrenByParent: DeletedChildrenByParent;
  }>(),
  {
    selectedPath: null,
    revealPath: null,
    revealRequestToken: 0
  }
);

const emit = defineEmits<{
  "select-file": [path: string];
  "context-menu": [payload: { event: MouseEvent; path: string; status: GitFileStatus | null; isDirectory: boolean }];
}>();

const isExpanded = ref(false);
const isLoading = ref(false);
const loadError = ref("");
const children = ref<FileEntry[]>([]);
const NODE_BASE_PADDING_REM = 0.5;
const NODE_INDENT_REM = 1;
let hasLoaded = false;
let lastChildrenSnapshot = "";

const entryStatus = computed<GitFileStatus | null>(() => {
  if (props.entry.isVirtual) {
    return "deleted";
  }

  return props.gitStatuses[props.entry.path] ?? null;
});

const isDeletedEntry = computed(() => entryStatus.value === "deleted");
const isIgnoredEntry = computed(() => props.entry.isIgnored === true);
const isSelectedEntry = computed(() => {
  if (!props.selectedPath) {
    return false;
  }

  return isSamePath(props.entry.path, props.selectedPath);
});

const buttonClasses = computed(() => {
  const classes: string[] = [];

  if (isSelectedEntry.value) {
    classes.push("border-primary/40 bg-primary/10");
  }

  if (isIgnoredEntry.value) {
    classes.push("opacity-[0.55]");
    return classes.join(" ");
  }

  if (isDeletedEntry.value) {
    classes.push("opacity-90");
  }

  return classes.join(" ");
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

function setChildrenIfChanged(nextChildren: FileEntry[]) {
  const nextSnapshot = buildEntryListSnapshot(nextChildren);
  if (nextSnapshot !== lastChildrenSnapshot) {
    lastChildrenSnapshot = nextSnapshot;
    children.value = nextChildren;
  }
}

function applyVirtualChildren(virtualChildren: FileEntry[]) {
  const nextChildren = mergeDirectoryEntries([], virtualChildren);
  setChildrenIfChanged(nextChildren);
  hasLoaded = true;
}

async function readChildrenDirectory(
  silent: boolean
): Promise<FilesystemReadResponse | null> {
  try {
    return await window.projectApi.filesystem.readDirectory(props.entry.path);
  } catch (error) {
    const message = toErrorMessage(error, "Failed to read directory.");
    if (!silent) {
      isLoading.value = false;
    }
    loadError.value = message;
    return null;
  }
}

function applyChildrenFromResponse(
  response: FilesystemReadResponse,
  virtualChildren: FileEntry[],
  silent: boolean
) {
  if (response.ok) {
    setChildrenIfChanged(mergeDirectoryEntries(response.entries ?? [], virtualChildren));
    hasLoaded = true;
    return;
  }

  if (virtualChildren.length > 0) {
    applyVirtualChildren(virtualChildren);
    return;
  }

  if (!silent) {
    loadError.value = response.error ?? "Failed to read directory.";
  }
}

async function loadChildren(options: { forceReload?: boolean; silent?: boolean } = {}) {
  if (!props.entry.isDirectory) {
    return;
  }

  const { forceReload = false, silent = false } = options;
  const virtualChildren = props.deletedChildrenByParent[props.entry.path] ?? [];

  if (props.entry.isVirtual) {
    applyVirtualChildren(virtualChildren);
    return;
  }

  if (!forceReload && hasLoaded) {
    return;
  }

  if (!silent) {
    isLoading.value = true;
    loadError.value = "";
  }

  const response = await readChildrenDirectory(silent);
  if (!response) {
    return;
  }

  if (!silent) {
    isLoading.value = false;
  }

  applyChildrenFromResponse(response, virtualChildren, silent);
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

function handleContextMenu(event: MouseEvent) {
  event.preventDefault();
  emit("context-menu", {
    event,
    path: props.entry.path,
    status: entryStatus.value,
    isDirectory: props.entry.isDirectory
  });
}

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
