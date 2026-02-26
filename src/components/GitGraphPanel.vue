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
          class="btn btn-ghost btn-xs btn-square ml-auto"
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
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { X } from "lucide-vue-next";
import { toErrorMessage } from "../utils/fail-fast";

const props = defineProps<{
  projectPath: string;
}>();

const ROW_HEIGHT = 28;
const LANE_WIDTH = 14;
const LANE_OFFSET = 12;
const COMMIT_RADIUS = 4;
const MAX_COMMITS = 300;
const COPY_FEEDBACK_MS = 1500;

const LANE_COLORS = [
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
  "#8b5cf6",
  "#14b8a6",
  "#f97316",
  "#a855f7",
];

interface GraphLine {
  fromLane: number;
  toLane: number;
  fromTop: boolean;
  toBottom: boolean;
  colorLane: number;
}

interface GraphRow {
  commit: GitLogEntry;
  lane: number;
  lines: GraphLine[];
}

const isLoading = ref(false);
const loadError = ref("");
const graphRows = ref<GraphRow[]>([]);
const infoMessage = ref("");
const selectedRowIndex = ref<number | null>(null);
const scrollContainer = ref<HTMLElement | null>(null);
const maxLaneCount = ref(0);
const copiedHash = ref<string | null>(null);
const selectedCommitDetails = ref<GitCommitDetails | null>(null);
const isDetailsLoading = ref(false);
const detailsError = ref("");
let loadRequestId = 0;
let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null;
let detailsRequestId = 0;

const graphSvgWidth = computed(() => LANE_OFFSET + maxLaneCount.value * LANE_WIDTH + LANE_OFFSET);

const showCommitter = computed(() => {
  const details = selectedCommitDetails.value;
  if (!details) {
    return false;
  }

  return details.committerName !== details.authorName || details.committerEmail !== details.authorEmail;
});

const totalAdditions = computed(() =>
  selectedCommitDetails.value?.files.reduce((sum, file) => sum + file.additions, 0) ?? 0
);

const totalDeletions = computed(() =>
  selectedCommitDetails.value?.files.reduce((sum, file) => sum + file.deletions, 0) ?? 0
);

const fileCountLabel = computed(() => {
  const count = selectedCommitDetails.value?.files.length ?? 0;
  if (count === 1) {
    return "file changed";
  }
  return "files changed";
});

const laneX = (lane: number) => LANE_OFFSET + lane * LANE_WIDTH;
const laneColor = (lane: number) => LANE_COLORS[lane % LANE_COLORS.length];

const formatShortHash = (hash: string) => hash.slice(0, 7);

const formatRelativeDate = (isoDate: string) => {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSeconds < 60) {
    return "just now";
  }

  if (diffMinutes < 60) {
    return `${String(diffMinutes)}m ago`;
  }

  if (diffHours < 24) {
    return `${String(diffHours)}h ago`;
  }

  if (diffDays < 7) {
    return `${String(diffDays)}d ago`;
  }

  if (diffWeeks < 5) {
    return `${String(diffWeeks)}w ago`;
  }

  if (diffMonths < 12) {
    return `${String(diffMonths)}mo ago`;
  }

  return `${String(diffYears)}y ago`;
};

const formatFullDate = (isoDate: string) => {
  const date = new Date(isoDate);
  return date.toLocaleString("ru-RU", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const formatRef = (refName: string) => {
  if (refName.startsWith("HEAD -> ")) {
    return refName.slice(8);
  }

  if (refName.startsWith("tag: ")) {
    return refName.slice(5);
  }

  if (refName.startsWith("origin/")) {
    return refName;
  }

  return refName;
};

const refClasses = (refName: string) => {
  if (refName.startsWith("HEAD -> ")) {
    return "bg-primary/20 text-primary";
  }

  if (refName.startsWith("tag: ")) {
    return "bg-warning/20 text-warning";
  }

  if (refName.startsWith("origin/")) {
    return "bg-info/20 text-info";
  }

  return "bg-base-content/10 text-base-content/70";
};

const copyHash = async (hash: string) => {
  try {
    await window.projectApi.clipboard.writeText(hash);
    copiedHash.value = hash;
    if (copyFeedbackTimer !== null) {
      clearTimeout(copyFeedbackTimer);
    }
    copyFeedbackTimer = setTimeout(() => {
      copiedHash.value = null;
      copyFeedbackTimer = null;
    }, COPY_FEEDBACK_MS);
  } catch {
    // noop
  }
};

const selectCommit = async (rowIndex: number) => {
  if (selectedRowIndex.value === rowIndex) {
    closeDetails();
    return;
  }

  selectedRowIndex.value = rowIndex;
  const row = graphRows.value[rowIndex];

  const requestId = ++detailsRequestId;
  isDetailsLoading.value = true;
  detailsError.value = "";
  selectedCommitDetails.value = null;

  let response: GitCommitDetailsResponse;
  try {
    response = await window.projectApi.git.getCommitDetails(props.projectPath, row.commit.hash);
  } catch (error) {
    if (requestId !== detailsRequestId) {
      return;
    }

    isDetailsLoading.value = false;
    detailsError.value = toErrorMessage(error, "Failed to load commit details.");
    return;
  }

  if (requestId !== detailsRequestId) {
    return;
  }

  isDetailsLoading.value = false;

  if (!response.ok || !response.details) {
    detailsError.value = response.error ?? "Failed to load commit details.";
    return;
  }

  selectedCommitDetails.value = response.details;
};

const closeDetails = () => {
  selectedRowIndex.value = null;
  selectedCommitDetails.value = null;
  detailsError.value = "";
  isDetailsLoading.value = false;
  detailsRequestId++;
};

const compactLanes = (
  nextLanes: readonly string[],
  lines: readonly GraphLine[],
): { compactedLanes: string[]; remappedLines: GraphLine[] } => {
  const hasEmpty = nextLanes.some((hash) => hash === "");
  if (!hasEmpty) {
    return { compactedLanes: [...nextLanes], remappedLines: [...lines] };
  }

  const indexMap = new Map<number, number>();
  let newIndex = 0;
  for (let i = 0; i < nextLanes.length; i++) {
    if (nextLanes[i] !== "") {
      indexMap.set(i, newIndex);
      newIndex++;
    }
  }

  const remappedLines = lines.map((line) => {
    if (!line.toBottom) {
      return line;
    }

    const mapped = indexMap.get(line.toLane);
    if (mapped !== undefined && mapped !== line.toLane) {
      return { ...line, toLane: mapped };
    }

    return line;
  });

  const compactedLanes = nextLanes.filter((hash) => hash !== "");
  return { compactedLanes, remappedLines };
};

const buildGraph = (entries: GitLogEntry[]): GraphRow[] => {
  if (entries.length === 0) {
    return [];
  }

  const rows: GraphRow[] = [];
  let activeLanes: string[] = [];

  for (const commit of entries) {
    const commitLanes: number[] = [];
    for (let i = 0; i < activeLanes.length; i++) {
      if (activeLanes[i] === commit.hash) {
        commitLanes.push(i);
      }
    }

    let commitLane: number;
    const isNewLane = commitLanes.length === 0;

    if (isNewLane) {
      commitLane = activeLanes.length;
      activeLanes.push(commit.hash);
      commitLanes.push(commitLane);
    } else {
      commitLane = commitLanes[0];
    }

    const lines: GraphLine[] = [];
    const nextLanes = [...activeLanes];
    const continuingLanes = new Set<number>();

    for (let i = 0; i < activeLanes.length; i++) {
      const laneHash = activeLanes[i];
      if (laneHash === "") {
        continue;
      }

      if (laneHash === commit.hash) {
        if (i === commitLane) {
          if (!isNewLane) {
            lines.push({ fromLane: i, toLane: i, fromTop: true, toBottom: false, colorLane: i });
          }
        } else {
          lines.push({ fromLane: i, toLane: commitLane, fromTop: true, toBottom: false, colorLane: i });
        }
      } else {
        lines.push({ fromLane: i, toLane: i, fromTop: true, toBottom: false, colorLane: i });
        continuingLanes.add(i);
      }
    }

    for (const l of commitLanes) {
      nextLanes[l] = "";
    }

    const parents = commit.parentHashes;
    for (let i = 0; i < parents.length; i++) {
      const p = parents[i];
      let targetLane: number;

      if (i === 0) {
        targetLane = commitLane;
      } else {
        targetLane = nextLanes.indexOf(p);
        if (targetLane === -1) {
          if (i < commitLanes.length) {
            targetLane = commitLanes[i];
          } else {
            const emptyIdx = nextLanes.indexOf("");
            targetLane = emptyIdx !== -1 ? emptyIdx : nextLanes.length;
          }
        }
      }

      nextLanes[targetLane] = p;
      lines.push({
        fromLane: commitLane,
        toLane: targetLane,
        fromTop: false,
        toBottom: true,
        colorLane: i === 0 ? commitLane : targetLane,
      });
    }

    for (const laneIndex of continuingLanes) {
      lines.push({ fromLane: laneIndex, toLane: laneIndex, fromTop: false, toBottom: true, colorLane: laneIndex });
    }

    const { compactedLanes, remappedLines } = compactLanes(nextLanes, lines);
    activeLanes = compactedLanes;

    rows.push({ commit, lane: commitLane, lines: remappedLines });
  }

  return rows;
};

const loadLog = async () => {
  const requestId = ++loadRequestId;
  isLoading.value = true;
  loadError.value = "";

  let response: GitLogResponse;
  try {
    response = await window.projectApi.git.getLog(props.projectPath, MAX_COMMITS);
  } catch (error) {
    if (requestId !== loadRequestId) {
      return;
    }

    isLoading.value = false;
    loadError.value = toErrorMessage(error, "Failed to load git log.");
    return;
  }

  if (requestId !== loadRequestId) {
    return;
  }

  isLoading.value = false;

  if (!response.ok) {
    loadError.value = response.error ?? "Git log unavailable.";
    return;
  }

  if (!response.available) {
    infoMessage.value = response.reason === "git-not-installed"
      ? "Git is not installed."
      : "The selected folder is not a Git repository.";
    graphRows.value = [];
    return;
  }

  const entries = response.entries ?? [];
  const rows = buildGraph(entries);
  graphRows.value = rows;

  let maxLane = 1;
  for (const row of rows) {
    if (row.lane + 1 > maxLane) {
      maxLane = row.lane + 1;
    }

    for (const line of row.lines) {
      const lineMax = Math.max(line.fromLane, line.toLane) + 1;
      if (lineMax > maxLane) {
        maxLane = lineMax;
      }
    }
  }

  maxLaneCount.value = maxLane;
  infoMessage.value = entries.length > 0 ? `${String(entries.length)} commits` : "";
  closeDetails();
};

onMounted(() => {
  void loadLog();
});

onBeforeUnmount(() => {
  loadRequestId++;
  detailsRequestId++;
  if (copyFeedbackTimer !== null) {
    clearTimeout(copyFeedbackTimer);
  }
});

watch(() => props.projectPath, () => {
  graphRows.value = [];
  infoMessage.value = "";
  void loadLog();
});
</script>
