import { computed, onBeforeUnmount, onMounted, ref, type Ref, watch } from "vue";
import { buildGitGraphRows, type GraphRow } from "./git-graph-layout";
import { authorColor, formatRef, formatRelativeDate, formatShortHash, refClasses } from "./git-graph-format";
import { useCommitFileDiff } from "./use-commit-file-diff";
import { useGitGraphContextMenu } from "./use-git-graph-context-menu";
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
    ? "Git не установлен."
    : "Выбранная папка не является Git-репозиторием.";
}

// eslint-disable-next-line max-lines-per-function
export function useGitGraphPanel(projectPath: Ref<string>, gitRefreshToken: Ref<number>) {
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

  const {
    contextMenu, contextMenuElement, openContextMenu, checkout, createBranch, deleteBranch
  } = useGitGraphContextMenu(projectPath);

  const { fileDiff, selectFile, clearFileDiff } = useCommitFileDiff(projectPath, selectedCommitDetails);

  let loadRequestId = 0;
  let detailsRequestId = 0;
  let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null;
  let lastCommitsSnapshot = "";
  let isInitialized = false;

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
    clearFileDiff();
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
        detailsError.value = toErrorMessage(error, "Не удалось загрузить детали коммита.");
        isDetailsLoading.value = false;
      }
      return null;
    }
  }

  function applyCommitDetailsResponse(response: GitCommitDetailsResponse) {
    isDetailsLoading.value = false;
    if (!response.ok || !response.details) {
      detailsError.value = response.error ?? "Не удалось загрузить детали коммита.";
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
    clearFileDiff();
    const selectedRow = graphRows.value[rowIndex];
    const requestId = ++detailsRequestId;
    isDetailsLoading.value = true;
    detailsError.value = "";
    const response = await requestCommitDetails(requestId, selectedRow.commit.hash);
    if (response) {
      applyCommitDetailsResponse(response);
    }
  };

  function applyGraphRows(entries: readonly GitLogEntry[]) {
    const rows = buildGitGraphRows(entries);
    const selectedHash =
      selectedRowIndex.value !== null
        ? graphRows.value[selectedRowIndex.value]?.commit.hash ?? null
        : null;
    graphRows.value = rows;
    maxLaneCount.value = computeMaxLaneCount(rows);
    infoMessage.value = entries.length > 0 ? `${String(entries.length)} коммитов` : "";

    if (selectedHash !== null) {
      const newIndex = rows.findIndex((r) => r.commit.hash === selectedHash);
      if (newIndex >= 0) {
        selectedRowIndex.value = newIndex;
      } else {
        closeDetails();
      }
    }
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
        loadError.value = toErrorMessage(error, "Не удалось загрузить историю Git.");
      }
      return null;
    }
  }

  const loadLog = async () => {
    const requestId = ++loadRequestId;
    if (!isInitialized) {
      isLoading.value = true;
    }
    loadError.value = "";
    const response = await requestGitLog(requestId);
    if (!response) {
      return;
    }

    isLoading.value = false;
    isInitialized = true;

    if (!response.ok) {
      loadError.value = response.error ?? "История Git недоступна.";
      lastCommitsSnapshot = "";
      return;
    }

    if (!response.available) {
      applyUnavailableLog(response.reason);
      lastCommitsSnapshot = "";
      return;
    }

    const entries = response.entries ?? [];
    const snapshot = entries.map((e) => `${e.hash}:${e.refs.join(";")}`).join(",");
    if (snapshot === lastCommitsSnapshot) {
      return;
    }
    lastCommitsSnapshot = snapshot;
    applyGraphRows(entries);
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
    lastCommitsSnapshot = "";
    isInitialized = false;
    void loadLog();
  });

  watch(gitRefreshToken, () => {
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
    fileDiff,
    contextMenu,
    contextMenuElement,
    laneX,
    laneColor,
    formatShortHash,
    formatRelativeDate,
    formatRef,
    refClasses,
    authorColor,
    copyHash,
    selectCommit,
    selectFile,
    clearFileDiff,
    closeDetails,
    openContextMenu,
    checkout,
    createBranch,
    deleteBranch
  };
}

