<template>
  <div class="flex min-h-0 flex-1 flex-col border-t border-base-300">
    <div class="flex items-center gap-2 border-b border-base-300 px-3 py-1.5">
      <span class="text-xs font-semibold text-base-content/70">Детали коммита</span>
      <button
        class="icon-btn ml-auto text-base-content/40 hover:text-error"
        tabindex="-1"
        title="Закрыть"
        @click="$emit('close')"
      >
        <X :size="14" />
      </button>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-6">
      <span class="loading loading-spinner loading-sm" />
    </div>

    <div v-else-if="error" class="px-3 py-4 text-sm text-base-content/50">
      Детали коммита недоступны
    </div>

    <div v-else class="flex min-h-0 flex-1">
      <div class="min-h-0 min-w-0 shrink-0 overflow-y-auto px-3 py-2" :class="fileDiff.selectedFilePath ? 'w-2/5' : 'flex-1'">
        <div class="mb-3 flex flex-col gap-1.5">
          <div class="flex items-center gap-2">
            <span class="shrink-0 w-16 text-xs text-base-content/50">Хеш</span>
            <button
              class="cursor-pointer rounded px-1.5 py-0.5 font-mono text-xs text-base-content/80 transition-colors hover:bg-base-content/10"
              tabindex="-1"
              :title="copiedHash === details.hash ? 'Скопировано!' : 'Скопировать полный хеш'"
              @click="$emit('copy-hash', details.hash)"
            >
              {{ copiedHash === details.hash ? "скопировано!" : details.hash }}
            </button>
          </div>

          <div v-if="details.parentHashes.length > 0" class="flex items-start gap-2">
            <span class="shrink-0 w-16 text-xs text-base-content/50">
              {{ details.parentHashes.length > 1 ? "Родители" : "Родитель" }}
            </span>
            <div class="flex flex-wrap gap-1">
              <button
                v-for="parentHash in details.parentHashes"
                :key="parentHash"
                class="cursor-pointer rounded px-1.5 py-0.5 font-mono text-xs text-base-content/60 transition-colors hover:bg-base-content/10"
                tabindex="-1"
                :title="copiedHash === parentHash ? 'Скопировано!' : 'Скопировать хеш'"
                @click="$emit('copy-hash', parentHash)"
              >
                {{ copiedHash === parentHash ? "скопировано!" : formatShortHash(parentHash) }}
              </button>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <span class="shrink-0 w-16 text-xs text-base-content/50">Автор</span>
            <span class="text-xs">
              {{ details.authorName }}
              <span class="text-base-content/40">&lt;{{ details.authorEmail }}&gt;</span>
            </span>
          </div>

          <div class="flex items-center gap-2">
            <span class="shrink-0 w-16 text-xs text-base-content/50">Дата</span>
            <span class="text-xs text-base-content/70">{{ formatFullDate(details.authorDate) }}</span>
          </div>

          <div v-if="showCommitter" class="flex items-center gap-2">
            <span class="shrink-0 w-16 text-xs text-base-content/50">Коммитер</span>
            <span class="text-xs">
              {{ details.committerName }}
              <span class="text-base-content/40">&lt;{{ details.committerEmail }}&gt;</span>
            </span>
          </div>

          <div v-if="details.refs.length > 0" class="flex items-center gap-2">
            <span class="shrink-0 w-16 text-xs text-base-content/50">Ссылки</span>
            <div class="flex flex-wrap gap-1">
              <span
                v-for="ref in details.refs"
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
          <p class="text-sm font-medium">{{ details.subject }}</p>
          <p
            v-if="details.body"
            class="mt-1 whitespace-pre-wrap text-xs text-base-content/70"
          >{{ details.body }}</p>
        </div>

        <div v-if="details.files.length > 0">
          <div class="mb-1 text-xs text-base-content/50">
            {{ String(details.files.length) }} {{ fileCountLabel }}
            <span class="text-success">+{{ String(totalAdditions) }}</span>
            <span class="text-error">-{{ String(totalDeletions) }}</span>
          </div>
          <div class="flex flex-col">
            <div
              v-for="file in details.files"
              :key="file.path"
              class="flex cursor-pointer items-center gap-2 rounded px-1.5 py-0.5 text-xs hover:bg-base-300/50"
              :class="fileDiff.selectedFilePath === file.path ? 'bg-base-300' : ''"
              @click="$emit('select-file', file.path)"
            >
              <span class="shrink-0 font-mono text-success">+{{ String(file.additions) }}</span>
              <span class="shrink-0 font-mono text-error">-{{ String(file.deletions) }}</span>
              <span class="min-w-0 truncate font-mono text-base-content/70">{{ file.path }}</span>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="fileDiff.selectedFilePath"
        class="flex min-h-0 min-w-0 flex-1 flex-col border-l border-base-300"
      >
        <div class="flex items-center gap-2 border-b border-base-300/80 bg-base-100/40 px-3 py-1.5">
          <span class="min-w-0 truncate font-mono text-xs text-base-content/70">{{ fileDiff.selectedFilePath }}</span>
          <template v-if="changeCount > 0 && !fileDiff.isLoading">
            <div class="ml-auto flex items-center">
              <button class="icon-btn text-base-content/40 hover:text-primary" tabindex="-1" title="Предыдущее изменение" @click="goToPrevChange">
                <ChevronUp :size="14" />
              </button>
              <span class="min-w-6 text-center text-[11px] text-base-content/55">{{ positionLabel }}</span>
              <button class="icon-btn text-base-content/40 hover:text-primary" tabindex="-1" title="Следующее изменение" @click="goToNextChange">
                <ChevronDown :size="14" />
              </button>
            </div>
          </template>
        </div>
        <div v-if="fileDiff.isLoading" class="flex flex-1 items-center justify-center">
          <span class="loading loading-spinner loading-sm" />
        </div>
        <div v-else-if="fileDiff.error" class="flex flex-1 items-center justify-center px-4 text-sm text-base-content/50">
          Diff недоступен
        </div>
        <div v-else-if="fileDiff.lines.length === 0" class="flex flex-1 items-center justify-center px-4 text-sm text-base-content/50">
          Нет изменений
        </div>
        <CodeMirrorDiffViewer
          v-else
          ref="diffViewerRef"
          class="min-h-0 flex-1"
          :file-path="fileDiff.selectedFilePath"
          :display-lines="fileDiff.lines"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { ChevronDown, ChevronUp, X } from "lucide-vue-next";
import { formatFullDate, formatRef, formatShortHash, refClasses } from "./git-graph-format";
import type { CommitFileDiffState } from "./use-commit-file-diff";
import CodeMirrorDiffViewer from "../CodeMirrorDiffViewer.vue";
import { useDiffChangeNavigation } from "../../composables/use-diff-change-navigation";

const props = defineProps<{
  details: GitCommitDetails;
  copiedHash: string | null;
  isLoading: boolean;
  error: string;
  fileDiff: CommitFileDiffState;
}>();

defineEmits<{
  close: [];
  "copy-hash": [hash: string];
  "select-file": [filePath: string];
}>();

const diffViewerRef = ref<InstanceType<typeof CodeMirrorDiffViewer> | null>(null);

const { changeCount, positionLabel, goToNext, goToPrevious } = useDiffChangeNavigation(() => props.fileDiff.lines);

const goToNextChange = () => {
  const line = goToNext();
  if (line !== null) { diffViewerRef.value?.scrollToLine(line); }
};

const goToPrevChange = () => {
  const line = goToPrevious();
  if (line !== null) { diffViewerRef.value?.scrollToLine(line); }
};

const showCommitter = computed(() =>
  props.details.committerName !== props.details.authorName
  || props.details.committerEmail !== props.details.authorEmail
);

const totalAdditions = computed(() =>
  props.details.files.reduce((sum, file) => sum + file.additions, 0)
);

const totalDeletions = computed(() =>
  props.details.files.reduce((sum, file) => sum + file.deletions, 0)
);

const fileCountLabel = computed(() =>
  props.details.files.length === 1 ? "файл изменён" : "файлов изменено"
);
</script>
