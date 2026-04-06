<template>
  <div class="flex h-full min-h-0 flex-col gap-3">
    <div class="relative flex min-h-0 flex-1 flex-col rounded-box border border-base-300 bg-base-200/70 shadow-sm">
      <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-b border-base-300/80 px-3 py-2">
        <span class="text-xs font-semibold uppercase tracking-wide text-base-content/60">
          Изменения
        </span>
        <div v-if="hasChanges" class="ml-auto flex items-center gap-1 whitespace-nowrap text-[10px] font-semibold tracking-wide">
          <span
            v-if="statusCounts.conflict > 0"
            class="rounded-full bg-amber-400/10 px-2 py-0.5 text-amber-400"
          >
            C {{ statusCounts.conflict }}
          </span>
          <span
            v-if="statusCounts.modified > 0"
            class="rounded-full bg-sky-400/10 px-2 py-0.5 text-sky-400"
          >
            M {{ statusCounts.modified }}
          </span>
          <span
            v-if="statusCounts.added > 0"
            class="rounded-full bg-emerald-400/10 px-2 py-0.5 text-emerald-400"
          >
            A {{ statusCounts.added }}
          </span>
          <span
            v-if="statusCounts.deleted > 0"
            class="rounded-full bg-rose-400/10 px-2 py-0.5 text-rose-400"
          >
            D {{ statusCounts.deleted }}
          </span>
        </div>
        <span v-else class="ml-auto whitespace-nowrap text-[11px] text-base-content/45">
          Нет изменений
        </span>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto p-1">
        <div v-if="isLoading" class="flex items-center justify-center py-8">
          <span class="loading loading-spinner loading-md" />
        </div>

        <div v-else-if="loadError" class="py-4 text-center text-sm text-base-content/50">
          Изменения недоступны
        </div>

        <div v-else-if="changeEntries.length === 0" class="py-4 text-center text-sm text-base-content/50">
          Изменений не найдено
        </div>

        <div v-else>
          <button
            v-for="entry in changeEntries"
            :key="entry.path"
            tabindex="-1"
            class="list-item-hover flex w-full cursor-pointer items-center gap-2 px-2 py-1.5 text-left text-sm"
            :class="{
              'border-base-content/15 bg-base-300': entry.path === selectedPath,
              'opacity-70': isRevertingAll || isPathReverting(entry.path)
            }"
            :disabled="isRevertingAll || isPathReverting(entry.path)"
            @click="emit('select-file', entry.path)"
            @contextmenu="openContextMenu($event, entry)"
          >
            <span
              class="shrink-0 w-4 text-center text-[11px] font-bold leading-none"
              :class="nameClasses(entry.status)"
            >
              {{ statusLabel(entry.status) }}
            </span>
            <div class="min-w-0 flex-1">
              <div class="truncate font-medium" :class="nameClasses(entry.status)">
                {{ entryDisplayName(entry.path) }}
              </div>
              <div class="truncate text-[11px] text-base-content/45">
                {{ entryPathDisplay(entry.path) }}
              </div>
            </div>
            <button
              type="button"
              tabindex="-1"
              class="shrink-0 cursor-pointer rounded p-0.5 text-base-content/30 hover:text-base-content/70"
              title="Открыть в дереве файлов"
              @click.stop="handleEntryPathClick(entry.path)"
            >
              <ExternalLink :size="14" />
            </button>
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
        class="fixed z-50 flex flex-col rounded-box border border-base-300 bg-base-100 p-1 shadow-xl"
        :style="{ left: `${String(contextMenu.x)}px`, top: `${String(contextMenu.y)}px` }"
        @contextmenu.prevent
      >
        <template v-if="contextMenu.status === 'conflict'">
          <button
            type="button"
            class="context-menu-item"
            tabindex="-1"
            :disabled="isActionInProgress"
            @click="handleResolveConflict"
          >
            <Check :size="14" />
            Пометить как разрешённый
          </button>
          <button
            type="button"
            class="context-menu-item"
            tabindex="-1"
            :disabled="isActionInProgress"
            @click="handleAcceptOurs"
          >
            <ArrowLeft :size="14" />
            Принять текущую (ours)
          </button>
          <button
            type="button"
            class="context-menu-item"
            tabindex="-1"
            :disabled="isActionInProgress"
            @click="handleAcceptTheirs"
          >
            <ArrowRight :size="14" />
            Принять входящую (theirs)
          </button>
          <div class="my-0.5 border-t border-base-300/60" />
        </template>
        <button
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
import { toRef, watch } from "vue";
import { ArrowLeft, ArrowRight, Check, ExternalLink, FolderOpen, RotateCcw } from "lucide-vue-next";
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
  entryDisplayName,
  entryPathDisplay,
  openContextMenu,
  isPathReverting,
  handleContextMenuRevertClick,
  handleContextMenuShowInFolder,
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

const handleConflictAction = async (
  action: () => Promise<GitMutateResponse>
) => {
  try {
    const response = await action();
    if (!response.ok) {
      pushError(response.error ?? "Не удалось выполнить действие.");
    } else {
      await props.refreshGitStatus();
    }
  } catch {
    pushError("Не удалось выполнить действие.");
  }
};

const handleResolveConflict = () => {
  const path = contextMenu.value?.path;
  if (path) {
    void handleConflictAction(() =>
      window.projectApi.git.resolveFile(props.projectPath, path)
    );
  }
};

const handleAcceptOurs = () => {
  const path = contextMenu.value?.path;
  if (path) {
    void handleConflictAction(() =>
      window.projectApi.git.acceptConflictVersion(props.projectPath, path, "ours")
    );
  }
};

const handleAcceptTheirs = () => {
  const path = contextMenu.value?.path;
  if (path) {
    void handleConflictAction(() =>
      window.projectApi.git.acceptConflictVersion(props.projectPath, path, "theirs")
    );
  }
};

function handleEntryPathClick(path: string) {
  emit("open-path", path);
}
</script>

