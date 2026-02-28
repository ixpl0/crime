import { computed, nextTick, onBeforeUnmount, onMounted, ref, type Ref, watch } from "vue";
import { toErrorMessage } from "../../utils/fail-fast";
import {
  buildSnapshot,
  clampContextMenuX,
  clampContextMenuY,
  entryDisplayName,
  entryPathDisplayForProject,
  getGitUnavailableMessage,
  nameClasses,
  sortEntries,
  statusBadgeClasses,
  statusLabel
} from "./changes-panel-utils";

const REFRESH_INTERVAL_MS = 3000;

export interface ChangesContextMenuState {
  x: number;
  y: number;
  path: string;
  status: GitFileStatus;
}

// eslint-disable-next-line max-lines-per-function
export function useChangesPanel(projectPath: Ref<string>) {
  const isLoading = ref(false);
  const loadError = ref("");
  const changeEntries = ref<GitStatusEntry[]>([]);
  const infoMessage = ref("");
  const contextMenu = ref<ChangesContextMenuState | null>(null);
  const contextMenuElement = ref<HTMLElement | null>(null);
  const isRevertingAll = ref(false);
  const revertingPath = ref<string | null>(null);
  const hasChanges = computed(() => changeEntries.value.length > 0);
  const isActionInProgress = computed(() => isRevertingAll.value || revertingPath.value !== null);
  const statusCounts = computed<Record<GitFileStatus, number>>(() => {
    const counts: Record<GitFileStatus, number> = { modified: 0, added: 0, deleted: 0 };
    for (const entry of changeEntries.value) {
      counts[entry.status] += 1;
    }
    return counts;
  });

  let loadRequestId = 0;
  let refreshIntervalId: ReturnType<typeof setInterval> | null = null;
  let isAutoRefreshInFlight = false;
  let lastSnapshot = "";

  function closeContextMenu() {
    contextMenu.value = null;
  }

  function entryPathDisplay(path: string) {
    return entryPathDisplayForProject(projectPath.value, path);
  }

  function isPathReverting(path: string) {
    return revertingPath.value === path;
  }

  function openContextMenu(event: MouseEvent, entry: GitStatusEntry) {
    if (isActionInProgress.value) {
      return;
    }

    event.preventDefault();
    contextMenu.value = {
      x: clampContextMenuX(event.clientX),
      y: clampContextMenuY(event.clientY),
      path: entry.path,
      status: entry.status
    };
    void nextTick(() => {
      contextMenuElement.value?.focus();
    });
  }

  function updateSnapshot(entries: GitStatusEntry[], info: string, error: string) {
    const nextSnapshot = buildSnapshot(entries, info, error);
    if (nextSnapshot === lastSnapshot) {
      return;
    }

    lastSnapshot = nextSnapshot;
    changeEntries.value = entries;
    infoMessage.value = info;
    loadError.value = error;
  }

  function beginLoad(isBackgroundRefresh: boolean) {
    const requestId = ++loadRequestId;
    if (!isBackgroundRefresh) {
      isLoading.value = true;
      loadError.value = "";
    }
    return requestId;
  }

  function finishLoad(isBackgroundRefresh: boolean) {
    if (!isBackgroundRefresh) {
      isLoading.value = false;
    }
  }

  async function requestGitStatus(
    requestId: number,
    isBackgroundRefresh: boolean
  ): Promise<GitStatusResponse | null> {
    try {
      const response = await window.projectApi.git.getStatus(projectPath.value);
      return requestId === loadRequestId ? response : null;
    } catch (error) {
      if (requestId !== loadRequestId) {
        return null;
      }

      const message = toErrorMessage(error, "Failed to load git status.");
      if (!isBackgroundRefresh) {
        isLoading.value = false;
        loadError.value = message;
      } else {
        infoMessage.value = `Auto-refresh failed: ${message}`;
      }
      return null;
    }
  }

  function applyGitStatusResponse(response: GitStatusResponse) {
    if (!response.ok) {
      updateSnapshot([], "", response.error ?? "Git status unavailable.");
      closeContextMenu();
      return;
    }

    if (!response.available) {
      updateSnapshot([], getGitUnavailableMessage(response.reason), "");
      closeContextMenu();
      return;
    }

    const nextEntries = sortEntries(response.entries ?? []);
    const nextInfo = nextEntries.length > 0 ? `${String(nextEntries.length)} changed` : "";
    updateSnapshot(nextEntries, nextInfo, "");
    if (contextMenu.value && !nextEntries.some((entry) => entry.path === contextMenu.value?.path)) {
      closeContextMenu();
    }
  }

  const loadChanges = async (isBackgroundRefresh = false) => {
    const requestId = beginLoad(isBackgroundRefresh);
    const response = await requestGitStatus(requestId, isBackgroundRefresh);
    if (!response) {
      return;
    }

    finishLoad(isBackgroundRefresh);
    applyGitStatusResponse(response);
  };

  async function revertPath(path: string) {
    if (isActionInProgress.value || !window.confirm(`Откатить изменения файла?\n${path}`)) {
      return;
    }

    closeContextMenu();
    revertingPath.value = path;
    loadError.value = "";
    try {
      const response = await window.projectApi.git.revertFile(projectPath.value, path);
      if (!response.ok) {
        loadError.value = response.error ?? "Failed to revert file changes.";
      } else if (!response.available) {
        loadError.value = getGitUnavailableMessage(response.reason);
      } else {
        await loadChanges();
      }
    } catch (error) {
      loadError.value = toErrorMessage(error, "Failed to revert file changes.");
    } finally {
      revertingPath.value = null;
    }
  }

  async function revertAllChanges() {
    const confirmationText =
      "Откатить ВСЕ изменения в текущем проекте? Это удалит все незакоммиченные правки.";
    if (isActionInProgress.value || !hasChanges.value || !window.confirm(confirmationText)) {
      return;
    }

    closeContextMenu();
    isRevertingAll.value = true;
    loadError.value = "";
    try {
      const response = await window.projectApi.git.revertAll(projectPath.value);
      if (!response.ok) {
        loadError.value = response.error ?? "Failed to revert all changes.";
      } else if (!response.available) {
        loadError.value = getGitUnavailableMessage(response.reason);
      } else {
        await loadChanges();
      }
    } catch (error) {
      loadError.value = toErrorMessage(error, "Failed to revert all changes.");
    } finally {
      isRevertingAll.value = false;
    }
  }

  function handleContextMenuRevertClick() {
    if (contextMenu.value) {
      void revertPath(contextMenu.value.path);
    }
  }

  function handleRevertAllClick() {
    void revertAllChanges();
  }

  function handleGlobalPointerDown(event: PointerEvent) {
    if (!contextMenu.value) {
      return;
    }

    const target = event.target;
    if (contextMenuElement.value && target instanceof Node && contextMenuElement.value.contains(target)) {
      return;
    }

    closeContextMenu();
  }

  function handleGlobalKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      closeContextMenu();
    }
  }

  function stopAutoRefresh() {
    if (refreshIntervalId !== null) {
      clearInterval(refreshIntervalId);
      refreshIntervalId = null;
    }
  }

  function startAutoRefresh() {
    stopAutoRefresh();
    refreshIntervalId = setInterval(() => {
      if (isLoading.value || isAutoRefreshInFlight || isActionInProgress.value) {
        return;
      }
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }

      isAutoRefreshInFlight = true;
      void loadChanges(true).finally(() => {
        isAutoRefreshInFlight = false;
      });
    }, REFRESH_INTERVAL_MS);
  }

  onMounted(() => {
    void loadChanges();
    startAutoRefresh();
    window.addEventListener("pointerdown", handleGlobalPointerDown, true);
    window.addEventListener("keydown", handleGlobalKeydown, true);
    window.addEventListener("scroll", closeContextMenu, true);
  });

  onBeforeUnmount(() => {
    stopAutoRefresh();
    window.removeEventListener("pointerdown", handleGlobalPointerDown, true);
    window.removeEventListener("keydown", handleGlobalKeydown, true);
    window.removeEventListener("scroll", closeContextMenu, true);
  });

  watch(projectPath, () => {
    lastSnapshot = "";
    closeContextMenu();
    void loadChanges();
    startAutoRefresh();
  });

  return {
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
    statusBadgeClasses,
    entryDisplayName,
    entryPathDisplay,
    openContextMenu,
    isPathReverting,
    handleContextMenuRevertClick,
    handleRevertAllClick
  };
}
