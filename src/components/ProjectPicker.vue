<template>
  <div class="flex h-full flex-col items-center overflow-y-auto">
    <div class="my-auto flex w-full max-w-sm flex-col items-center gap-3 py-12">
      <h1 class="mb-7 select-none text-4xl font-bold tracking-[0.25em] text-base-content/80">
        CRIME
      </h1>

      <button
        class="btn btn-primary w-full gap-2"
        tabindex="-1"
        :disabled="isOpening"
        @click="$emit('openFolder')"
      >
        <span v-if="isOpening" class="loading loading-spinner loading-sm" />
        <FolderOpen v-else :size="18" />
        {{ isOpening ? "Opening…" : "Open Folder" }}
      </button>

      <button
        class="btn btn-outline btn-primary w-full gap-2"
        tabindex="-1"
        :disabled="isOpening"
        @click="$emit('createFolder')"
      >
        <FolderPlus :size="18" />
        Create Folder
      </button>

      <div v-if="recentProjects.length > 0" class="mt-4 flex w-full flex-col gap-2">
        <p class="px-1 text-xs uppercase tracking-wider text-base-content/30">
          Recent
        </p>
        <div class="flex flex-col overflow-hidden rounded-box border border-base-300 bg-base-100">
          <div
            v-for="(projectPath, index) in recentProjects"
            :key="projectPath"
            class="group relative"
            :class="{ 'border-t border-base-300': index > 0 }"
          >
            <button
              class="flex w-full cursor-pointer items-center gap-3 px-4 py-3 pr-10 text-left transition-colors hover:bg-primary/10"
              tabindex="-1"
              :disabled="isOpening"
              @click="$emit('openProject', projectPath)"
            >
              <Folder
                :size="16"
                class="shrink-0 text-base-content/25 transition-colors group-hover:text-primary/70"
              />
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-medium text-base-content/70 transition-colors group-hover:text-base-content">
                  {{ getProjectNameFromPath(projectPath) }}
                </div>
                <div class="truncate text-xs text-base-content/25">
                  {{ projectPath }}
                </div>
              </div>
            </button>
            <button
              class="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer p-1 text-base-content/0 transition-colors group-hover:text-base-content/30 hover:!text-error"
              tabindex="-1"
              title="Убрать из списка"
              @click="$emit('removeProject', projectPath)"
            >
              <X :size="14" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Folder, FolderOpen, FolderPlus, X } from "lucide-vue-next";

defineProps<{
  recentProjects: readonly string[];
  isOpening: boolean;
  getProjectNameFromPath: (path: string) => string;
}>();

defineEmits<{
  openFolder: [];
  createFolder: [];
  openProject: [path: string];
  removeProject: [path: string];
}>();
</script>
