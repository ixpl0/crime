<template>
  <div>
    <button
      class="flex w-full items-center gap-1.5 rounded px-1.5 py-0.5 text-sm hover:bg-base-300"
      :style="{ paddingLeft: `${depth * 1}rem` }"
      @click="handleClick"
    >
      <template v-if="entry.isDirectory">
        <FolderOpen v-if="isExpanded" :size="16" class="shrink-0 text-warning" />
        <Folder v-else :size="16" class="shrink-0 text-warning" />
      </template>
      <FileIcon v-else :size="16" class="shrink-0 text-base-content/50" />
      <span class="truncate">{{ entry.name }}</span>
    </button>

    <div v-if="isExpanded && children.length > 0">
      <FileTreeNode
        v-for="child in children"
        :key="child.path"
        :entry="child"
        :depth="depth + 1"
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
import { ref } from "vue";
import { Folder, FolderOpen, File as FileIcon } from "lucide-vue-next";

const props = defineProps<{
  entry: FileEntry;
  depth: number;
}>();

const emit = defineEmits<{
  "select-file": [path: string];
}>();

const isExpanded = ref(false);
const isLoading = ref(false);
const loadError = ref("");
const children = ref<FileEntry[]>([]);
let hasLoaded = false;

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

  isLoading.value = true;
  loadError.value = "";

  const response = await window.projectApi.filesystem.readDirectory(props.entry.path);

  isLoading.value = false;

  if (!response.ok) {
    loadError.value = response.error ?? "Ошибка чтения";
    return;
  }

  children.value = response.entries ?? [];
  hasLoaded = true;
};
</script>
