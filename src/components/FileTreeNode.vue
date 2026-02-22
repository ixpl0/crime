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
import { mergeDirectoryEntries, type DeletedChildrenByParent } from "./file-tree-status-utils";

const props = defineProps<{
  entry: FileEntry;
  depth: number;
  refreshToken: number;
  gitStatuses: Record<string, GitFileStatus>;
  deletedChildrenByParent: DeletedChildrenByParent;
}>();

const emit = defineEmits<{
  "select-file": [path: string];
}>();

const isExpanded = ref(false);
const isLoading = ref(false);
const loadError = ref("");
const children = ref<FileEntry[]>([]);
let hasLoaded = false;

const entryStatus = computed<GitFileStatus | null>(() => {
  if (props.entry.isVirtual) {
    return "deleted";
  }

  return props.gitStatuses[props.entry.path] ?? null;
});

const isDeletedEntry = computed(() => entryStatus.value === "deleted");

const buttonClasses = computed(() => {
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

async function loadChildren(forceReload = false) {
  if (!props.entry.isDirectory) {
    return;
  }

  const virtualChildren = props.deletedChildrenByParent[props.entry.path] ?? [];

  if (props.entry.isVirtual) {
    children.value = mergeDirectoryEntries([], virtualChildren);
    hasLoaded = true;
    return;
  }

  if (!forceReload && hasLoaded) {
    return;
  }

  isLoading.value = true;
  loadError.value = "";

  const response = await window.projectApi.filesystem.readDirectory(props.entry.path);

  isLoading.value = false;

  if (!response.ok) {
    if (virtualChildren.length > 0) {
      children.value = mergeDirectoryEntries([], virtualChildren);
      hasLoaded = true;
      return;
    }

    loadError.value = response.error ?? "Failed to read directory.";
    return;
  }

  children.value = mergeDirectoryEntries(response.entries ?? [], virtualChildren);
  hasLoaded = true;
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
  () => props.refreshToken,
  () => {
    if (!props.entry.isDirectory) {
      return;
    }

    if (props.entry.isVirtual) {
      void loadChildren(true);
      return;
    }

    if (isExpanded.value) {
      void loadChildren(true);
      return;
    }

    hasLoaded = false;
  }
);
</script>
