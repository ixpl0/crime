<template>
  <div class="flex h-full min-h-0 flex-col gap-3">
    <div class="relative flex min-h-0 flex-1 flex-col rounded-box border border-base-300 bg-base-200/70 shadow-sm">
      <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-b border-base-300/80 px-3 py-2">
        <span class="text-xs font-semibold uppercase tracking-wide text-base-content/60">
          Changes
        </span>
        <div v-if="hasChanges" class="ml-auto flex items-center gap-1 whitespace-nowrap text-[10px] font-semibold tracking-wide">
          <span
            v-if="statusCounts.modified > 0"
            class="rounded-full bg-blue-500/15 px-2 py-0.5 text-blue-600"
          >
            M {{ statusCounts.modified }}
          </span>
          <span
            v-if="statusCounts.added > 0"
            class="rounded-full bg-green-500/15 px-2 py-0.5 text-green-600"
          >
            A {{ statusCounts.added }}
          </span>
          <span
            v-if="statusCounts.deleted > 0"
            class="rounded-full bg-red-500/15 px-2 py-0.5 text-red-600"
          >
            D {{ statusCounts.deleted }}
          </span>
        </div>
        <span v-else class="ml-auto whitespace-nowrap text-[11px] text-base-content/45">
          Working tree clean
        </span>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        <div v-if="isLoading" class="flex items-center justify-center py-8">
          <span class="loading loading-spinner loading-md" />
        </div>

        <div v-else-if="loadError" class="py-4 text-center text-sm text-base-content/50">
          Changes unavailable
        </div>

        <div v-else-if="changeEntries.length === 0" class="py-4 text-center text-sm text-base-content/50">
          No changes detected
        </div>

        <div v-else class="space-y-1">
          <button
            v-for="entry in changeEntries"
            :key="entry.path"
            tabindex="-1"
            class="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left text-sm hover:border-base-300 hover:bg-base-300/65"
            :class="{
              'border-primary/40 bg-primary/10': entry.path === selectedPath,
              'opacity-70': isRevertingAll || isPathReverting(entry.path)
            }"
            :disabled="isRevertingAll || isPathReverting(entry.path)"
            @click="emit('select-file', entry.path)"
            @contextmenu="openContextMenu($event, entry)"
          >
            <FilePlus v-if="entry.status === 'added'" :size="16" class="shrink-0 text-green-500" />
            <FilePen v-else-if="entry.status === 'modified'" :size="16" class="shrink-0 text-blue-500" />
            <FileX v-else-if="entry.status === 'deleted'" :size="16" class="shrink-0 text-red-500" />
            <File v-else :size="16" class="shrink-0 text-base-content/50" />
            <div class="min-w-0">
              <div class="truncate font-medium" :class="nameClasses(entry.status)">
                {{ entryDisplayName(entry.path) }}
              </div>
              <span
                class="inline-block max-w-full cursor-pointer truncate text-[11px] text-base-content/45 hover:underline"
                @click.stop="handleEntryPathClick(entry.path)"
              >
                {{ entryPathDisplay(entry.path) }}
              </span>
            </div>
            <span
              class="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              :class="statusBadgeClasses(entry.status)"
            >
              {{ statusLabel(entry.status) }}
            </span>
          </button>
        </div>
      </div>

      <div
        v-if="infoMessage"
        class="border-t border-base-300/80 bg-base-100/40 px-3 py-2 text-xs text-base-content/60"
      >
        {{ infoMessage }}
      </div>

      <div
        v-if="contextMenu"
        ref="contextMenuElement"
        class="fixed z-50 min-w-52 rounded-box border border-base-300 bg-base-100 p-1 shadow-xl"
        :style="{ left: `${String(contextMenu.x)}px`, top: `${String(contextMenu.y)}px` }"
        @contextmenu.prevent
      >
        <button
          type="button"
          class="btn btn-ghost btn-sm w-full justify-start"
          tabindex="-1"
          :disabled="isActionInProgress"
          @click="handleContextMenuRevertClick"
        >
          <RotateCcw :size="14" />
          Revert changes
        </button>
      </div>
    </div>

    <div class="flex items-center justify-end">
      <button
        type="button"
        class="btn btn-error btn-xs btn-outline"
        tabindex="-1"
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
import { toRef, watch } from "vue";
import { File, FilePen, FilePlus, FileX, RotateCcw } from "lucide-vue-next";
import { useConfirmDialog } from "../../utils/dialog-utils";
import { useAppToastStore } from "../../toast/toast-store";
import { useChangesPanel } from "./use-changes-panel";

const props = defineProps<{
  projectPath: string;
  selectedPath?: string | null;
  gitStatusResponse: GitStatusResponse | null;
  gitRefreshToken: number;
  refreshGitStatus: () => Promise<void>;
}>();

const emit = defineEmits<{
  "select-file": [path: string];
  "open-path": [path: string];
  "reset-selected-file": [];
}>();

const { requestConfirm } = useConfirmDialog();
const { pushError } = useAppToastStore();

const {
  isLoading,
  loadError,
  changeEntries,
  infoMessage,
  contextMenu,
  contextMenuElement,
  isRevertingAll,
  hasChanges,
  statusCounts,
  isActionInProgress,
  nameClasses,
  statusLabel,
  statusBadgeClasses,
  entryDisplayName,
  entryPathDisplay,
  openContextMenu,
  isPathReverting,
  handleContextMenuRevertClick,
  handleRevertAllClick
} = useChangesPanel({
  projectPath: toRef(props, "projectPath"),
  selectedPath: toRef(props, "selectedPath"),
  gitStatusResponse: toRef(props, "gitStatusResponse"),
  gitRefreshToken: toRef(props, "gitRefreshToken"),
  refreshGitStatus: props.refreshGitStatus,
  requestConfirm,
  onResetSelectedFile: () => {
    emit("reset-selected-file");
  }
});

watch(loadError, (message) => {
  if (message) {
    pushError(message);
  }
});

function handleEntryPathClick(path: string) {
  emit("open-path", path);
}
</script>

