import { computed, onBeforeUnmount, onMounted, ref, type Ref, watch } from "vue";
import { buildGitGraphRows, type GraphRow } from "./git-graph-layout";
import {
  formatFullDate,
  formatRef,
  formatRelativeDate,
  formatShortHash,
  refClasses
} from "./git-graph-format";
import { toErrorMessage } from "../../utils/fail-fast";

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
  "#a855f7"
];

function laneX(lane: number) {
  return LANE_OFFSET + lane * LANE_WIDTH;
}

function laneColor(lane: number) {
  return LANE_COLORS[lane % LANE_COLORS.length];
}

function computeMaxLaneCount(rows: readonly GraphRow[]) {
  let maxLane = 1;
  for (const row of rows) {
    maxLane = Math.max(maxLane, row.lane + 1);
    for (const line of row.lines) {
      maxLane = Math.max(maxLane, Math.max(line.fromLane, line.toLane) + 1);
    }
  }

  return maxLane;
}

function getUnavailableLogMessage(reason?: GitLogResponse["reason"]) {
  return reason === "git-not-installed"
    ? "Git is not installed."
    : "The selected folder is not a Git repository.";
}

// eslint-disable-next-line max-lines-per-function
export function useGitGraphPanel(projectPath: Ref<string>) {
  const isLoading = ref(false);
  const loadError = ref("");
  const graphRows = ref<GraphRow[]>([]);
  const infoMessage = ref("");
  const selectedRowIndex = ref<number | null>(null);
  const copiedHash = ref<string | null>(null);
  const selectedCommitDetails = ref<GitCommitDetails | null>(null);
  const isDetailsLoading = ref(false);
  const detailsError = ref("");
  const maxLaneCount = ref(0);
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
    return count === 1 ? "file changed" : "files changed";
  });

  let loadRequestId = 0;
  let detailsRequestId = 0;
  let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null;

  function clearCopyFeedbackTimer() {
    if (copyFeedbackTimer !== null) {
      clearTimeout(copyFeedbackTimer);
      copyFeedbackTimer = null;
    }
  }

  async function copyHash(hash: string) {
    try {
      await window.projectApi.clipboard.writeText(hash);
      copiedHash.value = hash;
      clearCopyFeedbackTimer();
      copyFeedbackTimer = setTimeout(() => {
        copiedHash.value = null;
        copyFeedbackTimer = null;
      }, COPY_FEEDBACK_MS);
    } catch {
      // noop
    }
  }

  function closeDetails() {
    selectedRowIndex.value = null;
    selectedCommitDetails.value = null;
    detailsError.value = "";
    isDetailsLoading.value = false;
    detailsRequestId += 1;
  }

  async function requestCommitDetails(
    requestId: number,
    hash: string
  ): Promise<GitCommitDetailsResponse | null> {
    try {
      const response = await window.projectApi.git.getCommitDetails(projectPath.value, hash);
      return requestId === detailsRequestId ? response : null;
    } catch (error) {
      if (requestId === detailsRequestId) {
        detailsError.value = toErrorMessage(error, "Failed to load commit details.");
        isDetailsLoading.value = false;
      }
      return null;
    }
  }

  function applyCommitDetailsResponse(response: GitCommitDetailsResponse) {
    isDetailsLoading.value = false;
    if (!response.ok || !response.details) {
      detailsError.value = response.error ?? "Failed to load commit details.";
      return;
    }

    selectedCommitDetails.value = response.details;
  }

  const selectCommit = async (rowIndex: number) => {
    if (selectedRowIndex.value === rowIndex) {
      closeDetails();
      return;
    }

    selectedRowIndex.value = rowIndex;
    const selectedRow = graphRows.value[rowIndex];
    const requestId = ++detailsRequestId;
    isDetailsLoading.value = true;
    detailsError.value = "";
    selectedCommitDetails.value = null;
    const response = await requestCommitDetails(requestId, selectedRow.commit.hash);
    if (response) {
      applyCommitDetailsResponse(response);
    }
  };

  function applyGraphRows(entries: readonly GitLogEntry[]) {
    const rows = buildGitGraphRows(entries);
    graphRows.value = rows;
    maxLaneCount.value = computeMaxLaneCount(rows);
    infoMessage.value = entries.length > 0 ? `${String(entries.length)} commits` : "";
    closeDetails();
  }

  function applyUnavailableLog(reason?: GitLogResponse["reason"]) {
    infoMessage.value = getUnavailableLogMessage(reason);
    graphRows.value = [];
    maxLaneCount.value = 0;
  }

  async function requestGitLog(requestId: number): Promise<GitLogResponse | null> {
    try {
      const response = await window.projectApi.git.getLog(projectPath.value, MAX_COMMITS);
      return requestId === loadRequestId ? response : null;
    } catch (error) {
      if (requestId === loadRequestId) {
        isLoading.value = false;
        loadError.value = toErrorMessage(error, "Failed to load git log.");
      }
      return null;
    }
  }

  const loadLog = async () => {
    const requestId = ++loadRequestId;
    isLoading.value = true;
    loadError.value = "";
    const response = await requestGitLog(requestId);
    if (!response) {
      return;
    }

    isLoading.value = false;
    if (!response.ok) {
      loadError.value = response.error ?? "Git log unavailable.";
      return;
    }

    if (!response.available) {
      applyUnavailableLog(response.reason);
      return;
    }

    applyGraphRows(response.entries ?? []);
  };

  onMounted(() => {
    void loadLog();
  });

  onBeforeUnmount(() => {
    loadRequestId += 1;
    detailsRequestId += 1;
    clearCopyFeedbackTimer();
  });

  watch(projectPath, () => {
    graphRows.value = [];
    infoMessage.value = "";
    maxLaneCount.value = 0;
    void loadLog();
  });

  return {
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
  };
}

