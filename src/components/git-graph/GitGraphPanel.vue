<template>
  <div ref="panelContainer" class="flex h-full min-h-0 flex-col rounded-box border border-base-300 bg-base-200">
    <div
      v-if="conflictFiles.length > 0"
      class="flex flex-col gap-1 border-b border-warning/30 bg-warning/10 px-3 py-2"
    >
      <span class="text-xs font-medium text-warning">Конфликты stash</span>
      <button
        v-for="file in conflictFiles"
        :key="file"
        type="button"
        class="cursor-pointer truncate text-left text-xs text-warning/80 underline decoration-warning/30 hover:text-warning"
        tabindex="-1"
        @click="emit('openFile', file)"
      >{{ file }}</button>
    </div>
    <div
      class="min-h-0 overflow-y-auto"
      :class="selectedCommitDetails ? 'shrink-0' : 'flex-1'"
      :style="selectedCommitDetails ? commitListStyle : undefined"
      ref="scrollContainer"
    >
      <div v-if="isLoading" class="flex items-center justify-center py-8">
        <span class="loading loading-spinner loading-md" />
      </div>

      <div v-else-if="loadError" class="py-4 text-center text-sm text-base-content/50">
        История Git недоступна
      </div>

      <div v-else-if="graphRows.length === 0" class="py-4 text-center text-sm text-base-content/50">
        Коммиты не найдены
      </div>

      <div v-else class="grid" style="grid-template-columns: auto 1fr auto auto auto">
        <div
          v-for="(row, rowIndex) in graphRows"
          :key="row.commit.hash"
          class="group col-span-5 grid cursor-pointer grid-cols-subgrid items-center gap-3 hover:bg-base-300/50"
          :class="rowIndex === selectedRowIndex ? 'bg-base-300' : ''"
          @click="selectCommit(rowIndex)"
          @contextmenu="openContextMenu($event, row.commit.hash)"
        >
          <svg class="shrink-0" :width="graphSvgWidth" :height="ROW_HEIGHT">
            <template v-for="(line, lineIndex) in row.lines" :key="lineIndex">
              <line
                :x1="laneX(line.fromLane)" :y1="line.fromTop ? 0 : ROW_HEIGHT / 2"
                :x2="laneX(line.toLane)" :y2="line.toBottom ? ROW_HEIGHT : ROW_HEIGHT / 2"
                :stroke="laneColor(line.colorLane)" stroke-width="2"
              />
            </template>
            <circle
              :cx="laneX(row.lane)" :cy="ROW_HEIGHT / 2" :r="COMMIT_RADIUS"
              :fill="row.commit.parentHashes.length > 1 ? 'transparent' : laneColor(row.colorLane)"
              :stroke="laneColor(row.colorLane)"
              :stroke-width="row.commit.parentHashes.length > 1 ? 2.5 : 0"
            />
          </svg>
          <div class="flex min-w-0 items-center gap-1">
            <span
              v-for="ref in row.commit.refs" :key="ref"
              class="inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-xs font-medium"
              :class="refClasses(ref)"
              @contextmenu.stop="isBranchRef(ref) ? openContextMenu($event, row.commit.hash, ref) : undefined"
            >{{ formatRef(ref) }}</span>
            <span class="min-w-0 truncate text-sm" :class="row.commit.parentHashes.length > 1 ? 'text-base-content/50' : ''">{{ row.commit.subject }}</span>
          </div>
          <button
            class="-mx-1 shrink-0 cursor-pointer rounded px-1 text-xs font-mono text-base-content/40 transition-colors hover:bg-base-content/10 hover:text-base-content/70"
            tabindex="-1"
            :title="copiedHash === row.commit.hash ? 'Скопировано!' : 'Скопировать хеш'"
            @click.stop="copyHash(row.commit.hash)"
          >{{ copiedHash === row.commit.hash ? "скопировано" : formatShortHash(row.commit.hash) }}</button>
          <span class="whitespace-nowrap text-xs text-base-content/70">{{ formatRelativeDate(row.commit.date) }}</span>
          <span class="max-w-40 truncate pr-3 text-xs" :style="{ color: authorColor(row.commit.author) }">{{ row.commit.author }}</span>
        </div>
      </div>
    </div>

    <PanelHeightResizeHandle
      v-if="selectedCommitDetails"
      :is-active="isDetailsResizeActive"
      @pointerdown="handleDetailsResize"
    />

    <CommitDetailsPanel
      v-if="selectedCommitDetails"
      :details="selectedCommitDetails"
      :copied-hash="copiedHash"
      :is-loading="isDetailsLoading"
      :error="detailsError"
      :file-diff="fileDiff"
      @close="closeDetails"
      @copy-hash="copyHash"
      @select-file="selectFile"
      @close-file-diff="clearFileDiff"
    />

    <div
      v-if="infoMessage"
      class="border-t border-base-300 px-3 py-2 text-xs text-base-content/60"
    >
      {{ infoMessage }}
    </div>

    <div
      v-if="contextMenu"
      ref="contextMenuRef"
      class="fixed z-50 flex flex-col rounded-box border border-base-300 bg-base-100 p-1 shadow-xl"
      :style="{ left: `${String(contextMenu.x)}px`, top: `${String(contextMenu.y)}px` }"
      @contextmenu.prevent
    >
      <button
        type="button"
        class="btn btn-ghost btn-sm w-full justify-start"
        tabindex="-1"
        @click="handleCheckout"
      >
        <ArrowRightLeft :size="14" />
        Переключиться на {{ contextMenu.targetBranch ? contextMenu.targetBranch.displayName : formatShortHash(contextMenu.hash) }}
      </button>
      <button
        v-if="contextMenu.targetBranch"
        type="button"
        class="btn btn-ghost btn-sm w-full justify-start"
        :class="contextMenu.targetBranch.remote ? 'text-warning' : 'text-error'"
        tabindex="-1"
        @click="handleDeleteBranch"
      >
        <Trash2 :size="14" />
        Удалить {{ contextMenu.targetBranch.displayName }}{{ contextMenu.targetBranch.remote ? ' (удалённая)' : '' }}
      </button>
      <button
        type="button"
        class="btn btn-ghost btn-sm w-full justify-start"
        tabindex="-1"
        @click="handleCreateBranch"
      >
        <GitBranch :size="14" />
        Создать ветку
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, toRef, watch } from "vue";
import { ArrowRightLeft, GitBranch, Trash2 } from "lucide-vue-next";
import { isBranchRef } from "./git-graph-format";
import { useAppToastStore } from "../../toast/toast-store";
import { useConfirmDialog, usePromptDialog } from "../../utils/dialog-utils";
import { usePanelHeightResize } from "../../composables/use-panel-height-resize";
import { useGitGraphPanel } from "./use-git-graph-panel";
import CommitDetailsPanel from "./CommitDetailsPanel.vue";
import PanelHeightResizeHandle from "../PanelHeightResizeHandle.vue";

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const { pushToast, pushError } = useAppToastStore();
const { requestConfirm } = useConfirmDialog();
const { requestPrompt } = usePromptDialog();

const props = defineProps<{
  projectPath: string;
  gitRefreshToken: number;
}>();

const emit = defineEmits<{
  openFile: [path: string];
}>();

const panelContainer = ref<HTMLElement | null>(null);
const conflictFiles = ref<string[]>([]);

const {
  ROW_HEIGHT, COMMIT_RADIUS,
  graphRows, infoMessage, isLoading, loadError, graphSvgWidth,
  copiedHash, selectedCommitDetails, selectedRowIndex,
  isDetailsLoading, detailsError, fileDiff,
  contextMenu, contextMenuElement,
  laneX, laneColor,
  formatShortHash, formatRelativeDate, formatRef, refClasses, authorColor,
  copyHash, selectCommit, selectFile, clearFileDiff, closeDetails,
  openContextMenu, checkout, createBranch, deleteBranch
} = useGitGraphPanel(toRef(props, "projectPath"), toRef(props, "gitRefreshToken"));

const contextMenuRef = ref<HTMLElement | null>(null);
watch(contextMenuRef, (element) => { contextMenuElement.value = element; });

const {
  panelHeight: detailsPanelHeight,
  isResizeActive: isDetailsResizeActive,
  handleResizePointerDown: handleDetailsResizePointerDown
} = usePanelHeightResize({
  storageKey: "crime:git-details-height",
  defaultHeight: 280,
  minHeight: 100,
  minOppositeHeight: 80
});

const commitListStyle = computed(() => ({
  height: `calc(100% - ${String(detailsPanelHeight.value)}px - 16px)`,
  maxHeight: `calc(100% - 116px)`
}));

const handleDetailsResize = (event: PointerEvent) => {
  if (panelContainer.value) {
    handleDetailsResizePointerDown(event, panelContainer.value);
  }
};

const handleCheckout = async () => {
  if (!contextMenu.value) {
    return;
  }
  const branch = contextMenu.value.targetBranch;
  const target = branch ? branch.branchName : contextMenu.value.hash;
  const label = branch ? branch.displayName : formatShortHash(contextMenu.value.hash);
  const result = await checkout(target, branch?.remote);
  if (result.ok && result.stashConflict) {
    conflictFiles.value = result.conflictFiles ?? [];
    pushToast(`Переключено на ${label}, но stash pop вызвал конфликты`, { tone: "warning" });
  } else if (result.ok) {
    conflictFiles.value = [];
    pushToast(`Переключено на ${label}`, { tone: "success" });
  } else if (result.error) {
    pushError(result.error);
  }
};

const handleDeleteBranch = async () => {
  const branch = contextMenu.value?.targetBranch;
  if (!branch) {
    return;
  }
  const name = escapeHtml(branch.displayName);
  const title = branch.remote
    ? `Удалить УДАЛЁННУЮ ветку <strong>${name}</strong>?`
    : `Удалить ветку <strong>${name}</strong>?`;
  const body = branch.remote
    ? `Ветка будет удалена на <strong>${escapeHtml(branch.remote)}</strong>. Это действие нельзя отменить.`
    : undefined;
  const result = await deleteBranch(branch, () =>
    requestConfirm({ title, body })
  );
  if (result.ok) {
    pushToast(`Ветка «${branch.displayName}» удалена`, { tone: "success" });
  } else if (result.error) {
    pushError(result.error);
  }
};

const handleCreateBranch = async () => {
  if (!contextMenu.value) {
    return;
  }
  const hash = contextMenu.value.hash;
  const result = await createBranch(hash, () =>
    requestPrompt({ title: "Создать ветку", placeholder: "Имя ветки" })
  );
  if (result.ok) {
    pushToast("Ветка создана", { tone: "success" });
  } else if (result.error) {
    pushError(result.error);
  }
};

watch(loadError, (message) => { if (message) { pushError(message); } });
watch(detailsError, (message) => { if (message) { pushError(message); } });

watch(() => props.projectPath, () => { conflictFiles.value = []; });

watch(() => props.gitRefreshToken, async () => {
  if (conflictFiles.value.length === 0) {
    return;
  }
  const unmerged = await window.projectApi.git.getUnmergedFiles(props.projectPath);
  conflictFiles.value = unmerged;
});
</script>
