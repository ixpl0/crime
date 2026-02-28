import { computed, nextTick, onBeforeUnmount, onMounted, ref, type Ref, watch } from "vue";
import { type DeletedChildrenByParent } from "./file-tree-status-utils";
import { toErrorMessage } from "../../utils/fail-fast";
import {
  buildNextTreeState,
  clampContextMenuX,
  clampContextMenuY,
  getGitUnavailableMessage,
  type NextTreeState
} from "./file-manager-panel-utils";

const REFRESH_INTERVAL_MS = 3000;

export interface FileManagerContextMenuPayload {
  event: MouseEvent;
  path: string;
  status: GitFileStatus;
}

export interface FileManagerContextMenuState {
  x: number;
  y: number;
  path: string;
  status: GitFileStatus;
}

// eslint-disable-next-line max-lines-per-function
export function useFileManagerPanel(projectPath: Ref<string>) {
  const isLoading = ref(false);
  const loadError = ref("");
  const entries = ref<FileEntry[]>([]);
  const gitStatuses = ref<Record<string, GitFileStatus>>({});
  const deletedChildrenByParent = ref<DeletedChildrenByParent>({});
  const gitInfoMessage = ref("");
  const contextMenu = ref<FileManagerContextMenuState | null>(null);
  const contextMenuElement = ref<HTMLElement | null>(null);
  const isRevertingAll = ref(false);
  const revertingPath = ref<string | null>(null);
  const refreshToken = ref(0);
  const changedFilesCount = computed(() => Object.keys(gitStatuses.value).length);
  const hasChanges = computed(() => changedFilesCount.value > 0);
  const headerSummary = computed(() =>
    hasChanges.value
      ? `${String(changedFilesCount.value)} changed`
      : `${String(entries.value.length)} items`
  );
  const isActionInProgress = computed(() => isRevertingAll.value || revertingPath.value !== null);

  let loadRequestId = 0;
  let refreshIntervalId: ReturnType<typeof setInterval> | null = null;
  let isAutoRefreshInFlight = false;
  let lastStateSnapshot = "";
  let lastStructureSnapshot = "";

  function closeContextMenu() {
    contextMenu.value = null;
  }

  function openContextMenu(payload: FileManagerContextMenuPayload) {
    if (isActionInProgress.value) {
      return;
    }

    payload.event.preventDefault();
    contextMenu.value = {
      x: clampContextMenuX(payload.event.clientX),
      y: clampContextMenuY(payload.event.clientY),
      path: payload.path,
      status: payload.status
    };
    void nextTick(() => {
      contextMenuElement.value?.focus();
    });
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

  async function requestDirectoryState(
    requestId: number,
    isBackgroundRefresh: boolean
  ): Promise<[FilesystemReadResponse, GitStatusResponse] | null> {
    try {
      const responses = await Promise.all([
        window.projectApi.filesystem.readDirectory(projectPath.value),
        window.projectApi.git.getStatus(projectPath.value)
      ]);
      return requestId === loadRequestId ? responses : null;
    } catch (error) {
      if (requestId !== loadRequestId) {
        return null;
      }

      const message = toErrorMessage(error, "Failed to load project directory.");
      if (!isBackgroundRefresh) {
        isLoading.value = false;
        loadError.value = message;
      } else {
        gitInfoMessage.value = `Auto-refresh failed: ${message}`;
      }
      return null;
    }
  }

  function applyTreeState(nextState: NextTreeState) {
    if (nextState.stateSnapshot === lastStateSnapshot) {
      return;
    }

    const hasStructureChanged = nextState.structureSnapshot !== lastStructureSnapshot;
    lastStateSnapshot = nextState.stateSnapshot;
    lastStructureSnapshot = nextState.structureSnapshot;
    loadError.value = nextState.loadError;
    gitStatuses.value = nextState.statuses;
    deletedChildrenByParent.value = nextState.deletedChildren;
    gitInfoMessage.value = nextState.infoMessage;
    entries.value = nextState.entries;
    if (hasStructureChanged) {
      refreshToken.value += 1;
    }

    if (contextMenu.value && !(contextMenu.value.path in nextState.statuses)) {
      closeContextMenu();
    }
  }

  const loadRootDirectory = async (isBackgroundRefresh = false) => {
    const requestId = beginLoad(isBackgroundRefresh);
    const responses = await requestDirectoryState(requestId, isBackgroundRefresh);
    if (!responses) {
      return;
    }

    finishLoad(isBackgroundRefresh);
    const [directoryResponse, gitResponse] = responses;
    const nextState = buildNextTreeState(projectPath.value, directoryResponse, gitResponse);
    applyTreeState(nextState);
  };

  async function revertPath(path: string) {
    if (isActionInProgress.value || !window.confirm(`ÃÅ¾Ã‘â€šÃÂºÃÂ°Ã‘â€šÃÂ¸Ã‘â€šÃ‘Å’ ÃÂ¸ÃÂ·ÃÂ¼ÃÂµÃÂ½ÃÂµÃÂ½ÃÂ¸Ã‘Â Ã‘â€žÃÂ°ÃÂ¹ÃÂ»ÃÂ°?\n${path}`)) {
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
        await loadRootDirectory();
      }
    } catch (error) {
      loadError.value = toErrorMessage(error, "Failed to revert file changes.");
    } finally {
      revertingPath.value = null;
    }
  }

  async function revertAllChanges() {
    const confirmationText =
      "ÃÅ¾Ã‘â€šÃÂºÃÂ°Ã‘â€šÃÂ¸Ã‘â€šÃ‘Å’ Ãâ€™ÃÂ¡Ãâ€¢ ÃÂ¸ÃÂ·ÃÂ¼ÃÂµÃÂ½ÃÂµÃÂ½ÃÂ¸Ã‘Â ÃÂ² Ã‘â€šÃÂµÃÂºÃ‘Æ’Ã‘â€°ÃÂµÃÂ¼ ÃÂ¿Ã‘â‚¬ÃÂ¾ÃÂµÃÂºÃ‘â€šÃÂµ? ÃÂ­Ã‘â€šÃÂ¾ Ã‘Æ’ÃÂ´ÃÂ°ÃÂ»ÃÂ¸Ã‘â€š ÃÂ²Ã‘ÂÃÂµ ÃÂ½ÃÂµÃÂ·ÃÂ°ÃÂºÃÂ¾ÃÂ¼ÃÂ¼ÃÂ¸Ã‘â€¡ÃÂµÃÂ½ÃÂ½Ã‘â€¹ÃÂµ ÃÂ¿Ã‘â‚¬ÃÂ°ÃÂ²ÃÂºÃÂ¸.";
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
        await loadRootDirectory();
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
      void loadRootDirectory(true).finally(() => {
        isAutoRefreshInFlight = false;
      });
    }, REFRESH_INTERVAL_MS);
  }

  onMounted(() => {
    void loadRootDirectory();
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
    lastStateSnapshot = "";
    lastStructureSnapshot = "";
    closeContextMenu();
    void loadRootDirectory();
    startAutoRefresh();
  });

  return {
    isLoading,
    loadError,
    entries,
    gitStatuses,
    deletedChildrenByParent,
    gitInfoMessage,
    contextMenu,
    contextMenuElement,
    isRevertingAll,
    refreshToken,
    hasChanges,
    headerSummary,
    isActionInProgress,
    openContextMenu,
    handleContextMenuRevertClick,
    handleRevertAllClick
  };
}

