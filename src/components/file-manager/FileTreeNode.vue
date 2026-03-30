<template>
  <div
    @dragover="handleNodeDragOver"
    @drop="handleNodeDrop"
  >
    <button
      class="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left text-sm transition-colors duration-150 hover:border-base-300 hover:bg-base-300/65"
      tabindex="-1"
      :draggable="isDraggable"
      :class="buttonClasses"
      :style="{ paddingLeft: `${NODE_BASE_PADDING_REM + depth * NODE_INDENT_REM}rem` }"
      @click="handleClick"
      @contextmenu="handleContextMenu"
      @dragstart="handleDragStart"
      @dragend="handleDragEnd"
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
      class="py-0.5 text-sm text-base-content/50"
      :style="{ paddingLeft: `${NODE_BASE_PADDING_REM + (depth + 1) * NODE_INDENT_REM}rem` }"
    >
      Содержимое папки недоступно.
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
import { useAppToastStore } from "../../toast/toast-store";
import { toErrorMessage } from "../../utils/fail-fast";
import { useFileTreeNodeDrag } from "./use-file-tree-node-drag";
import { useFileTreeNodeClasses } from "./file-tree-node-classes";

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
const { pushError } = useAppToastStore();
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

const isDraggable = computed(() => !props.entry.isVirtual && !isDeletedEntry.value);

const {
  isDragSource,
  isDropTarget,
  handleDragStart,
  handleDragEnd,
  handleNodeDragOver,
  handleNodeDrop
} = useFileTreeNodeDrag({
  getPath: () => props.entry.path,
  getIsDirectory: () => props.entry.isDirectory,
  getIsVirtual: () => props.entry.isVirtual === true,
  getIsDraggable: () => isDraggable.value
});

const {
  buttonClasses,
  nameClasses,
  folderIconClasses,
  fileIconClasses
} = useFileTreeNodeClasses({
  entryStatus,
  isIgnoredEntry,
  isDeletedEntry,
  isSelectedEntry,
  isDragSource,
  isDropTarget
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
    const message = toErrorMessage(error, "Не удалось прочитать папку.");
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
    loadError.value = response.error ?? "Не удалось прочитать папку.";
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

watch(loadError, (message) => {
  if (message) {
    pushError(message);
  }
});

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
