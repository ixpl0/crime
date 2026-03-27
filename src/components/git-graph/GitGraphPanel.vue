<template>
  <div ref="panelContainer" class="flex h-full min-h-0 flex-col rounded-box border border-base-300 bg-base-200">
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
        Git history unavailable
      </div>

      <div v-else-if="graphRows.length === 0" class="py-4 text-center text-sm text-base-content/50">
        No commits found
      </div>

      <div v-else class="relative">
        <div
          v-for="(row, rowIndex) in graphRows"
          :key="row.commit.hash"
          class="group flex cursor-pointer items-stretch hover:bg-base-300/50"
          :class="rowIndex === selectedRowIndex ? 'bg-base-300' : ''"
          @click="selectCommit(rowIndex)"
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
              :fill="row.commit.parentHashes.length > 1 ? 'transparent' : laneColor(row.lane)"
              :stroke="laneColor(row.lane)"
              :stroke-width="row.commit.parentHashes.length > 1 ? 2.5 : 0"
            />
          </svg>
          <div class="flex min-w-0 flex-1 items-center gap-2 pr-3">
            <span
              v-for="ref in row.commit.refs" :key="ref"
              class="inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-xs font-medium"
              :class="refClasses(ref)"
            >{{ formatRef(ref) }}</span>
            <span class="min-w-0 truncate text-sm">{{ row.commit.subject }}</span>
            <button
              class="ml-auto shrink-0 cursor-pointer rounded px-1 text-xs font-mono text-base-content/40 transition-colors hover:bg-base-content/10 hover:text-base-content/70"
              tabindex="-1"
              :title="copiedHash === row.commit.hash ? 'Скопировано!' : 'Скопировать хеш'"
              @click.stop="copyHash(row.commit.hash)"
            >{{ copiedHash === row.commit.hash ? "copied" : formatShortHash(row.commit.hash) }}</button>
            <span class="shrink-0 text-xs text-base-content/40">{{ formatRelativeDate(row.commit.date) }}</span>
            <span class="shrink-0 text-xs text-base-content/50">{{ row.commit.author }}</span>
          </div>
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
    />

    <div
      v-if="infoMessage"
      class="border-t border-base-300 px-3 py-2 text-xs text-base-content/60"
    >
      {{ infoMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, toRef, watch } from "vue";
import { useAppToastStore } from "../../toast/toast-store";
import { usePanelHeightResize } from "../../composables/use-panel-height-resize";
import { useGitGraphPanel } from "./use-git-graph-panel";
import CommitDetailsPanel from "./CommitDetailsPanel.vue";
import PanelHeightResizeHandle from "../PanelHeightResizeHandle.vue";

const { pushError } = useAppToastStore();

const props = defineProps<{
  projectPath: string;
  gitRefreshToken: number;
}>();

const panelContainer = ref<HTMLElement | null>(null);

const {
  ROW_HEIGHT, COMMIT_RADIUS,
  graphRows, infoMessage, isLoading, loadError, graphSvgWidth,
  copiedHash, selectedCommitDetails, selectedRowIndex,
  isDetailsLoading, detailsError, fileDiff,
  laneX, laneColor,
  formatShortHash, formatRelativeDate, formatRef, refClasses,
  copyHash, selectCommit, selectFile, closeDetails
} = useGitGraphPanel(toRef(props, "projectPath"), toRef(props, "gitRefreshToken"));

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

watch(loadError, (message) => { if (message) { pushError(message); } });
watch(detailsError, (message) => { if (message) { pushError(message); } });
</script>
