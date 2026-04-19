<template>
  <div class="flex h-full min-h-0 flex-col gap-3">
    <div class="relative flex min-h-0 flex-1 flex-col rounded-box border border-base-300 bg-base-200/70 shadow-sm">
      <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-b border-base-300/80 px-3 py-2">
        <span class="text-xs font-semibold uppercase tracking-wide text-base-content/60">
          Файлы
        </span>
        <span class="ml-auto whitespace-nowrap text-[11px] text-base-content/45">
          {{ headerSummary }}
        </span>
      </div>

      <div
        class="min-h-0 flex-1 overflow-y-auto p-1 transition-colors duration-150"
        :class="{ 'bg-base-content/5': fileDragContext.dragOverDirectoryPath.value === props.projectPath }"
        @dragover="handlePanelDragOver"
        @drop="handlePanelDrop"
        @dragleave="handlePanelDragLeave"
        @contextmenu.self="handlePanelContextMenu"
      >
        <div v-if="isLoading" class="flex items-center justify-center py-8">
          <span class="loading loading-spinner loading-md" />
        </div>

        <div v-else-if="loadError" class="py-4 text-center text-sm text-base-content/50">
          Файлы недоступны
        </div>

        <div v-else-if="entries.length === 0" class="py-4 text-center text-sm text-base-content/50">
          Пустая папка
        </div>

        <div v-else>
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
        class="fixed z-50 flex flex-col rounded-box border border-base-300 bg-base-100 p-1 shadow-xl"
        :style="{ left: `${String(contextMenu.x)}px`, top: `${String(contextMenu.y)}px` }"
        @contextmenu.prevent
      >
        <button
          v-if="contextMenu.status !== 'deleted'"
          type="button"
          class="context-menu-item"
          tabindex="-1"
          :disabled="isActionInProgress"
          @click="handleContextMenuNewFileClick"
        >
          <FilePlus :size="14" />
          Новый файл
        </button>
        <button
          v-if="contextMenu.status !== 'deleted'"
          type="button"
          class="context-menu-item"
          tabindex="-1"
          :disabled="isActionInProgress"
          @click="handleContextMenuNewFolderClick"
        >
          <FolderPlus :size="14" />
          Новая папка
        </button>
        <button
          v-if="contextMenu.status !== null"
          type="button"
          class="context-menu-item"
          tabindex="-1"
          :disabled="isActionInProgress"
          @click="handleContextMenuRevertClick"
        >
          <RotateCcw :size="14" />
          Откатить изменения
        </button>
        <button
          v-if="contextMenu.status !== 'deleted'"
          type="button"
          class="context-menu-item"
          tabindex="-1"
          @click="handleContextMenuShowInFolder"
        >
          <FolderOpen :size="14" />
          Показать в папке
        </button>
        <button
          type="button"
          class="context-menu-item"
          tabindex="-1"
          @click="handleContextMenuCopyName"
        >
          <Copy :size="14" />
          {{ contextMenu.isDirectory ? "Копировать имя папки" : "Копировать имя файла" }}
        </button>
        <button
          v-if="contextMenu.path !== props.projectPath"
          type="button"
          class="context-menu-item"
          tabindex="-1"
          @click="handleContextMenuCopyRelativePath"
        >
          <FolderTree :size="14" />
          Копировать путь от корня проекта
        </button>
        <button
          type="button"
          class="context-menu-item"
          tabindex="-1"
          @click="handleContextMenuCopyAbsolutePath"
        >
          <Link2 :size="14" />
          Копировать абсолютный путь
        </button>
        <button
          v-if="contextMenu.status !== 'deleted' && contextMenu.path !== props.projectPath"
          type="button"
          class="context-menu-item text-error"
          tabindex="-1"
          :disabled="isActionInProgress"
          @click="handleContextMenuDeleteClick"
        >
          <Trash2 :size="14" />
          Удалить
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
        Откатить все изменения
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { provide, toRef, watch } from "vue";
import { Copy, FilePlus, FolderOpen, FolderPlus, FolderTree, Link2, RotateCcw, Trash2 } from "lucide-vue-next";
import { useConfirmDialog, usePromptDialog } from "../../utils/dialog-utils";
import { useAppToastStore } from "../../toast/toast-store";
import FileTreeNode from "./FileTreeNode.vue";
import { useFileManagerPanel } from "./use-file-manager-panel";
import { FILE_DRAG_KEY } from "./file-drag-injection";

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

const { requestConfirm } = useConfirmDialog();
const { requestPrompt } = usePromptDialog();
const { pushError } = useAppToastStore();

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
  handleContextMenuNewFileClick,
  handleContextMenuNewFolderClick,
  handleContextMenuShowInFolder,
  handleContextMenuCopyName,
  handleContextMenuCopyRelativePath,
  handleContextMenuCopyAbsolutePath,
  handleRevertAllClick,
  fileDragContext
} = useFileManagerPanel({
  projectPath: toRef(props, "projectPath"),
  gitStatusResponse: toRef(props, "gitStatusResponse"),
  gitRefreshToken: toRef(props, "gitRefreshToken"),
  refreshGitStatus: props.refreshGitStatus,
  requestConfirm,
  requestPrompt
});

provide(FILE_DRAG_KEY, fileDragContext);

const handlePanelContextMenu = (event: MouseEvent) => {
  openContextMenu({
    event,
    path: props.projectPath,
    status: null,
    isDirectory: true
  });
};

const handlePanelDragOver = (event: DragEvent) => {
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = fileDragContext.dragSourcePath.value !== null ? "move" : "copy";
  }
  fileDragContext.onDragOverDirectory(props.projectPath);
};

const handlePanelDrop = (event: DragEvent) => {
  event.preventDefault();
  fileDragContext.onDropOnDirectory(props.projectPath, event);
};

const handlePanelDragLeave = (event: DragEvent) => {
  const relatedTarget = event.relatedTarget as Node | null;
  const target = event.currentTarget as HTMLElement;
  if (!relatedTarget || !target.contains(relatedTarget)) {
    fileDragContext.clearDragOver();
  }
};
watch(loadError, (message) => {
  if (message) {
    pushError(message);
  }
});
</script>

