<template>
  <div class="flex h-full min-h-0 flex-col rounded-box border border-base-300 bg-base-200">
    <div class="min-h-0 flex-1 overflow-y-auto" ref="scrollContainer">
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
          class="group flex items-stretch hover:bg-base-300/50"
          :class="rowIndex === selectedRowIndex ? 'bg-base-300' : ''"
          @click="selectedRowIndex = rowIndex"
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
            <span class="ml-auto shrink-0 text-xs text-base-content/40">
              {{ formatShortHash(row.commit.hash) }}
            </span>
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
      v-if="infoMessage"
      class="border-t border-base-300 px-3 py-2 text-xs text-base-content/60"
    >
      {{ infoMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { toErrorMessage } from "../utils/fail-fast";

const props = defineProps<{
  projectPath: string;
}>();

const ROW_HEIGHT = 28;
const LANE_WIDTH = 16;
const LANE_OFFSET = 12;
const COMMIT_RADIUS = 4;
const MAX_COMMITS = 300;

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
let loadRequestId = 0;

const graphSvgWidth = computed(() => LANE_OFFSET + maxLaneCount.value * LANE_WIDTH + LANE_OFFSET);

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

const buildGraph = (entries: GitLogEntry[]): GraphRow[] => {
  if (entries.length === 0) {
    return [];
  }

  const rows: GraphRow[] = [];
  let activeLanes: string[] = [];

  for (const commit of entries) {
    const existingLaneIndex = activeLanes.indexOf(commit.hash);
    let commitLane: number;

    if (existingLaneIndex !== -1) {
      commitLane = existingLaneIndex;
    } else {
      commitLane = activeLanes.length;
      activeLanes = [...activeLanes, commit.hash];
    }

    const lines: GraphLine[] = [];

    const nextLanes = [...activeLanes];

    const parents = commit.parentHashes;
    const hasParents = parents.length > 0;

    if (hasParents) {
      nextLanes[commitLane] = parents[0];
    } else {
      nextLanes[commitLane] = "";
    }

    for (const [laneIndex, laneHash] of activeLanes.entries()) {
      if (laneIndex === commitLane) {
        continue;
      }

      if (laneHash.length > 0) {
        lines.push({
          fromLane: laneIndex,
          toLane: nextLanes.indexOf(laneHash) !== -1 ? nextLanes.indexOf(laneHash) : laneIndex,
          fromTop: true,
          toBottom: true,
          colorLane: laneIndex,
        });
      }
    }

    if (hasParents) {
      lines.push({
        fromLane: commitLane,
        toLane: commitLane,
        fromTop: true,
        toBottom: true,
        colorLane: commitLane,
      });
    } else {
      lines.push({
        fromLane: commitLane,
        toLane: commitLane,
        fromTop: true,
        toBottom: false,
        colorLane: commitLane,
      });
    }

    for (let parentIndex = 1; parentIndex < parents.length; parentIndex++) {
      const parent = parents[parentIndex];
      const existingParentLane = nextLanes.indexOf(parent);

      if (existingParentLane !== -1) {
        lines.push({
          fromLane: commitLane,
          toLane: existingParentLane,
          fromTop: false,
          toBottom: true,
          colorLane: existingParentLane,
        });
      } else {
        const newLane = nextLanes.length;
        nextLanes.push(parent);
        lines.push({
          fromLane: commitLane,
          toLane: newLane,
          fromTop: false,
          toBottom: true,
          colorLane: newLane,
        });
      }
    }

    if (!hasParents) {
      const compactedLanes = nextLanes.filter((_, index) => index !== commitLane);
      activeLanes = compactedLanes;
    } else {
      const closedLanes: number[] = [];
      for (let laneIndex = nextLanes.length - 1; laneIndex >= 0; laneIndex--) {
        if (nextLanes[laneIndex] === "") {
          closedLanes.push(laneIndex);
        }
      }

      if (closedLanes.length > 0) {
        activeLanes = nextLanes.filter((hash) => hash !== "");
      } else {
        activeLanes = nextLanes;
      }
    }

    rows.push({ commit, lane: commitLane, lines });
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
  selectedRowIndex.value = null;
};

onMounted(() => {
  void loadLog();
});

onBeforeUnmount(() => {
  loadRequestId++;
});

watch(() => props.projectPath, () => {
  graphRows.value = [];
  infoMessage.value = "";
  void loadLog();
});
</script>
