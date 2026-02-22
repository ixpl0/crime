<template>
  <div class="h-96 overflow-y-auto rounded-box border border-base-300 bg-base-200 p-2">
    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <span class="loading loading-spinner loading-md" />
    </div>

    <div v-else-if="loadError" class="py-4 text-center text-sm text-error">
      {{ loadError }}
    </div>

    <div v-else-if="entries.length === 0" class="py-4 text-center text-sm text-base-content/50">
      Пустая директория
    </div>

    <div v-else>
      <FileTreeNode
        v-for="entry in entries"
        :key="entry.path"
        :entry="entry"
        :depth="0"
        @select-file="(path) => emit('select-file', path)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import FileTreeNode from "./FileTreeNode.vue";

const props = defineProps<{
  projectPath: string;
}>();

const emit = defineEmits<{
  "select-file": [path: string];
}>();

const isLoading = ref(false);
const loadError = ref("");
const entries = ref<FileEntry[]>([]);

const loadRootDirectory = async () => {
  isLoading.value = true;
  loadError.value = "";

  const response = await window.projectApi.filesystem.readDirectory(props.projectPath);

  isLoading.value = false;

  if (!response.ok) {
    loadError.value = response.error ?? "Не удалось прочитать директорию проекта";
    return;
  }

  entries.value = response.entries ?? [];
};

onMounted(() => {
  void loadRootDirectory();
});

watch(() => props.projectPath, () => {
  void loadRootDirectory();
});
</script>
