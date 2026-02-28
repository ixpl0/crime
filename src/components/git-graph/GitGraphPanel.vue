<template>
  <div class="flex h-full min-h-0 flex-col rounded-box border border-base-300 bg-base-200">
    <div
      class="min-h-0 overflow-y-auto"
      :class="selectedCommitDetails ? 'h-1/2 shrink-0' : 'flex-1'"
      ref="scrollContainer"
    >
      <div v-if="isLoading" class="flex items-center justify-center py-8">
        <span class="loading loading-spinner loading-md" />
      </div>

      <div v-else-if="loadError" class="py-4 text-center text-sm text-error">
        {{ loadError }}
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
          <svg
            class="shrink-0"
            :width="graphSvgWidth"
            :height="ROW_HEIGHT"
          >
            <template v-for="(line, lineIndex) in row.lines" :key="lineIndex">
              <line
                :x1="laneX(line.fromLane)"
                :y1="line.fromTop ? 0 : ROW_HEIGHT / 2"
                :x2="laneX(line.toLane)"
                :y2="line.toBottom ? ROW_HEIGHT : ROW_HEIGHT / 2"
                :stroke="laneColor(line.colorLane)"
                stroke-width="2"
              />
            </template>
            <circle
              :cx="laneX(row.lane)"
              :cy="ROW_HEIGHT / 2"
              :r="COMMIT_RADIUS"
              :fill="row.commit.parentHashes.length > 1 ? 'transparent' : laneColor(row.lane)"
              :stroke="laneColor(row.lane)"
              :stroke-width="row.commit.parentHashes.length > 1 ? 2.5 : 0"
            />
          </svg>

          <div class="flex min-w-0 flex-1 items-center gap-2 pr-3">
            <span
              v-for="ref in row.commit.refs"
              :key="ref"
              class="inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-xs font-medium"
              :class="refClasses(ref)"
            >
              {{ formatRef(ref) }}
            </span>
            <span class="min-w-0 truncate text-sm">{{ row.commit.subject }}</span>
            <button
              class="ml-auto shrink-0 cursor-pointer rounded px-1 text-xs font-mono text-base-content/40 transition-colors hover:bg-base-content/10 hover:text-base-content/70"
              :title="copiedHash === row.commit.hash ? 'Скопировано!' : 'Скопировать хеш'"
              @click.stop="copyHash(row.commit.hash)"
            >
              {{ copiedHash === row.commit.hash ? "copied" : formatShortHash(row.commit.hash) }}
            </button>
            <span class="shrink-0 text-xs text-base-content/40">
              {{ formatRelativeDate(row.commit.date) }}
            </span>
            <span class="shrink-0 text-xs text-base-content/50">
              {{ row.commit.author }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="selectedCommitDetails"
      class="flex min-h-0 flex-1 flex-col border-t border-base-300"
    >
      <div class="flex items-center gap-2 border-b border-base-300 px-3 py-1.5">
        <span class="text-xs font-semibold text-base-content/70">Commit details</span>
        <button
          class="btn btn-ghost btn-sm btn-square ml-auto"
          title="Закрыть"
          @click="closeDetails"
        >
          <X :size="14" />
        </button>
      </div>

      <div v-if="isDetailsLoading" class="flex items-center justify-center py-6">
        <span class="loading loading-spinner loading-sm" />
      </div>

      <div v-else-if="detailsError" class="px-3 py-4 text-sm text-error">
        {{ detailsError }}
      </div>

      <div v-else class="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        <div class="mb-3 flex flex-col gap-1.5">
          <div class="flex items-center gap-2">
            <span class="shrink-0 text-xs text-base-content/50 w-16">Hash</span>
            <button
              class="cursor-pointer rounded px-1.5 py-0.5 font-mono text-xs text-base-content/80 transition-colors hover:bg-base-content/10"
              :title="copiedHash === selectedCommitDetails.hash ? 'Скопировано!' : 'Скопировать полный хеш'"
              @click="copyHash(selectedCommitDetails.hash)"
            >
              {{ copiedHash === selectedCommitDetails.hash ? "copied!" : selectedCommitDetails.hash }}
            </button>
          </div>

          <div v-if="selectedCommitDetails.parentHashes.length > 0" class="flex items-start gap-2">
            <span class="shrink-0 text-xs text-base-content/50 w-16">
              {{ selectedCommitDetails.parentHashes.length > 1 ? "Parents" : "Parent" }}
            </span>
            <div class="flex flex-wrap gap-1">
              <button
                v-for="parentHash in selectedCommitDetails.parentHashes"
                :key="parentHash"
                class="cursor-pointer rounded px-1.5 py-0.5 font-mono text-xs text-base-content/60 transition-colors hover:bg-base-content/10"
                :title="copiedHash === parentHash ? 'Скопировано!' : 'Скопировать хеш'"
                @click="copyHash(parentHash)"
              >
                {{ copiedHash === parentHash ? "copied!" : formatShortHash(parentHash) }}
              </button>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <span class="shrink-0 text-xs text-base-content/50 w-16">Author</span>
            <span class="text-xs">
              {{ selectedCommitDetails.authorName }}
              <span class="text-base-content/40">&lt;{{ selectedCommitDetails.authorEmail }}&gt;</span>
            </span>
          </div>

          <div class="flex items-center gap-2">
            <span class="shrink-0 text-xs text-base-content/50 w-16">Date</span>
            <span class="text-xs text-base-content/70">{{ formatFullDate(selectedCommitDetails.authorDate) }}</span>
          </div>

          <div
            v-if="showCommitter"
            class="flex items-center gap-2"
          >
            <span class="shrink-0 text-xs text-base-content/50 w-16">Committer</span>
            <span class="text-xs">
              {{ selectedCommitDetails.committerName }}
              <span class="text-base-content/40">&lt;{{ selectedCommitDetails.committerEmail }}&gt;</span>
            </span>
          </div>

          <div
            v-if="selectedCommitDetails.refs.length > 0"
            class="flex items-center gap-2"
          >
            <span class="shrink-0 text-xs text-base-content/50 w-16">Refs</span>
            <div class="flex flex-wrap gap-1">
              <span
                v-for="ref in selectedCommitDetails.refs"
                :key="ref"
                class="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium"
                :class="refClasses(ref)"
              >
                {{ formatRef(ref) }}
              </span>
            </div>
          </div>
        </div>

        <div class="mb-3">
          <p class="text-sm font-medium">{{ selectedCommitDetails.subject }}</p>
          <p
            v-if="selectedCommitDetails.body"
            class="mt-1 whitespace-pre-wrap text-xs text-base-content/70"
          >{{ selectedCommitDetails.body }}</p>
        </div>

        <div v-if="selectedCommitDetails.files.length > 0">
          <div class="mb-1 text-xs text-base-content/50">
            {{ String(selectedCommitDetails.files.length) }} {{ fileCountLabel }}
            <span class="text-success">+{{ String(totalAdditions) }}</span>
            <span class="text-error">-{{ String(totalDeletions) }}</span>
          </div>
          <div class="flex flex-col">
            <div
              v-for="file in selectedCommitDetails.files"
              :key="file.path"
              class="flex items-center gap-2 rounded px-1.5 py-0.5 text-xs hover:bg-base-300/50"
            >
              <span class="shrink-0 font-mono text-success">+{{ String(file.additions) }}</span>
              <span class="shrink-0 font-mono text-error">-{{ String(file.deletions) }}</span>
              <span class="min-w-0 truncate font-mono text-base-content/70">{{ file.path }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="infoMessage"
      class="border-t border-base-300 px-3 py-2 text-xs text-base-content/60"
    >
      {{ infoMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { toRef } from "vue";
import { X } from "lucide-vue-next";
import { useGitGraphPanel } from "./use-git-graph-panel";

const props = defineProps<{
  projectPath: string;
}>();

const {
  ROW_HEIGHT,
  COMMIT_RADIUS,
  graphRows,
  infoMessage,
  isLoading,
  loadError,
  graphSvgWidth,
  copiedHash,
  selectedCommitDetails,
  selectedRowIndex,
  isDetailsLoading,
  detailsError,
  showCommitter,
  totalAdditions,
  totalDeletions,
  fileCountLabel,
  laneX,
  laneColor,
  formatShortHash,
  formatRelativeDate,
  formatFullDate,
  formatRef,
  refClasses,
  copyHash,
  selectCommit,
  closeDetails
} = useGitGraphPanel(toRef(props, "projectPath"));
</script>

