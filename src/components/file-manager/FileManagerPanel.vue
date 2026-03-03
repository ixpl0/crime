<template>
  <div class="flex h-full min-h-0 flex-col gap-3">
    <div class="relative flex min-h-0 flex-1 flex-col rounded-box border border-base-300 bg-base-200/70 shadow-sm">
      <div class="flex items-center gap-2 border-b border-base-300/80 px-3 py-2">
        <span class="text-xs font-semibold uppercase tracking-wide text-base-content/60">
          Files
        </span>
        <span class="ml-auto text-[11px] text-base-content/45">
          {{ headerSummary }}
        </span>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        <div v-if="isLoading" class="flex items-center justify-center py-8">
          <span class="loading loading-spinner loading-md" />
        </div>

        <div v-else-if="loadError" class="py-4 text-center text-sm text-error">
          {{ loadError }}
        </div>

        <div v-else-if="entries.length === 0" class="py-4 text-center text-sm text-base-content/50">
          Empty directory
        </div>

        <div v-else class="space-y-0.5">
          <FileTreeNode
            v-for="entry in entries"
            :key="entry.path"
            :entry="entry"
            :depth="0"
            :refresh-token="refreshToken"
            :selected-path="props.selectedPath"
            :reveal-path="props.revealPath"
            :reveal-request-token="props.revealRequestToken"
            :git-statuses="gitStatuses"
            :deleted-children-by-parent="deletedChildrenByParent"
            @select-file="(path) => emit('select-file', path)"
            @context-menu="openContextMenu"
          />
        </div>
      </div>

      <div
        v-if="gitInfoMessage"
        class="border-t border-base-300/80 bg-base-100/40 px-3 py-2 text-xs text-base-content/60"
      >
        {{ gitInfoMessage }}
      </div>

      <div
        v-if="contextMenu"
        ref="contextMenuElement"
        class="fixed z-50 min-w-52 rounded-box border border-base-300 bg-base-100 p-1 shadow-xl"
        :style="{ left: `${String(contextMenu.x)}px`, top: `${String(contextMenu.y)}px` }"
        @contextmenu.prevent
      >
        <button
          v-if="contextMenu.status !== null"
          type="button"
          class="btn btn-ghost btn-sm w-full justify-start"
          :disabled="isActionInProgress"
          @click="handleContextMenuRevertClick"
        >
          <RotateCcw :size="14" />
          Revert changes
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-sm w-full justify-start text-error"
          :disabled="isActionInProgress"
          @click="handleContextMenuDeleteClick"
        >
          <Trash2 :size="14" />
          Delete
        </button>
      </div>
    </div>

    <div class="flex items-center justify-end">
      <button
        type="button"
        class="btn btn-error btn-xs btn-outline"
        :disabled="!hasChanges || isLoading || isActionInProgress"
        @click="handleRevertAllClick"
      >
        <span v-if="isRevertingAll" class="loading loading-spinner loading-xs" />
        Revert all changes
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { toRef } from "vue";
import { RotateCcw, Trash2 } from "lucide-vue-next";
import FileTreeNode from "./FileTreeNode.vue";
import { useFileManagerPanel } from "./use-file-manager-panel";

const props = withDefaults(
  defineProps<{
    projectPath: string;
    selectedPath?: string | null;
    revealPath?: string | null;
    revealRequestToken?: number;
    gitStatusResponse: GitStatusResponse | null;
    gitRefreshToken: number;
    refreshGitStatus: () => Promise<void>;
  }>(),
  {
    selectedPath: null,
    revealPath: null,
    revealRequestToken: 0
  }
);

const emit = defineEmits<{
  "select-file": [path: string];
}>();

const {
  isLoading,
  loadError,
  entries,
  gitStatuses,
  deletedChildrenByParent,
  gitInfoMessage,
  contextMenu,
  contextMenuElement,
  isRevertingAll,
  refreshToken,
  hasChanges,
  headerSummary,
  isActionInProgress,
  openContextMenu,
  handleContextMenuRevertClick,
  handleContextMenuDeleteClick,
  handleRevertAllClick
} = useFileManagerPanel({
  projectPath: toRef(props, "projectPath"),
  gitStatusResponse: toRef(props, "gitStatusResponse"),
  gitRefreshToken: toRef(props, "gitRefreshToken"),
  refreshGitStatus: props.refreshGitStatus
});
</script>

