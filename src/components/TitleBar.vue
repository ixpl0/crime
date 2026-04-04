<template>
  <div v-if="projectPath" class="flex items-center gap-3 pl-3 text-xs text-base-content/60">
    <span class="font-medium text-base-content/80">{{ projectName }}</span>
    <span v-if="gitBranch" class="flex items-center gap-1">
      <GitBranch :size="12" />
      {{ gitBranch }}
    </span>
    <span
      v-if="gitChangesCount > 0"
      class="flex items-center gap-1 text-warning"
    >
      <Pencil :size="11" />
      {{ gitChangesCount }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { GitBranch, Pencil } from "lucide-vue-next";
import { useStatusBarStore } from "../composables/status-bar-store";
import { useAppNavigationStore } from "../navigation/navigation-store";

const { projectPath } = useAppNavigationStore();
const { gitBranch, gitChangesCount } = useStatusBarStore();

const projectName = computed(() => {
  const path = projectPath.value;
  if (!path) {
    return "";
  }
  return path.split(/[\\/]/).pop() ?? path;
});
</script>
