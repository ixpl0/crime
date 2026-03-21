import { computed, nextTick, onBeforeUnmount, onMounted, ref, type Ref, watch } from "vue";
import { type DeletedChildrenByParent } from "./file-tree-status-utils";
import { toErrorMessage } from "../../utils/fail-fast";
import { clampContextMenuX, clampContextMenuY, getGitUnavailableMessage } from "../../utils/context-menu-utils";
import { buildNextTreeState, type NextTreeState } from "./file-manager-panel-utils";
import type { FileManagerContextMenuPayload, FileManagerContextMenuState } from "./file-manager-context-menu-types";
import { useFileDrag } from "./use-file-drag";
export type { FileManagerContextMenuPayload, FileManagerContextMenuState };

const FILESYSTEM_REFRESH_INTERVAL_MS = 5000;

interface UseFileManagerPanelOptions {
  projectPath: Ref<string>;
  gitStatusResponse: Ref<GitStatusResponse | null>;
  gitRefreshToken: Ref<number>;
  refreshGitStatus: () => Promise<void>;
  requestConfirm: (options: { title: string; body?: string }) => Promise<boolean>;
}

// eslint-disable-next-line max-lines-per-function
export function useFileManagerPanel({
  projectPath,
  gitStatusResponse,
  gitRefreshToken,
  refreshGitStatus,
  requestConfirm
}: UseFileManagerPanelOptions) {
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
  const hasChanges = computed(() => Object.keys(gitStatuses.value).length > 0);
  const headerSummary = computed(() => {
    const count = Object.keys(gitStatuses.value).length;
    return count > 0 ? `${String(count)} changed` : `${String(entries.value.length)} items`;
  });
  const isActionInProgress = computed(() => isRevertingAll.value || revertingPath.value !== null);

  let loadRequestId = 0;
  let refreshIntervalId: ReturnType<typeof setInterval> | null = null;
  let isAutoRefreshInFlight = false;
  let lastStateSnapshot = "";
  let lastStructureSnapshot = "";
  let lastDirectoryResponse: FilesystemReadResponse | null = null;

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
      status: payload.status,
      isDirectory: payload.isDirectory
    };
    void nextTick(() => {
      contextMenuElement.value?.focus();
    });
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
    if (contextMenu.value && contextMenu.value.status !== null && !(contextMenu.value.path in nextState.statuses)) {
      closeContextMenu();
    }
  }

  function rebuildTreeWithGitStatus() {
    const gitResponse = gitStatusResponse.value;
    if (!lastDirectoryResponse || !gitResponse) {
      return;
    }

    const nextState = buildNextTreeState(projectPath.value, lastDirectoryResponse, gitResponse);
    applyTreeState(nextState);
  }

  async function requestDirectoryState(
    requestId: number,
    isBackgroundRefresh: boolean
  ): Promise<FilesystemReadResponse | null> {
    try {
      const response = await window.projectApi.filesystem.readDirectory(projectPath.value);
      return requestId === loadRequestId ? response : null;
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

  const loadRootDirectory = async (isBackgroundRefresh = false) => {
    const requestId = ++loadRequestId;
    if (!isBackgroundRefresh) {
      isLoading.value = true;
      loadError.value = "";
    }

    const directoryResponse = await requestDirectoryState(requestId, isBackgroundRefresh);
    if (!directoryResponse) {
      return;
    }

    if (!isBackgroundRefresh) {
      isLoading.value = false;
    }

    lastDirectoryResponse = directoryResponse;
    const gitResponse = gitStatusResponse.value ?? { ok: true, available: true, entries: [] };
    const nextState = buildNextTreeState(projectPath.value, directoryResponse, gitResponse);
    applyTreeState(nextState);
  };

  async function revertPath(path: string) {
    if (isActionInProgress.value || !await requestConfirm({ title: "Откатить изменения файла?", body: path })) {
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
        await refreshGitStatus();
        await loadRootDirectory(true);
      }
    } catch (error) {
      loadError.value = toErrorMessage(error, "Failed to revert file changes.");
    } finally {
      revertingPath.value = null;
    }
  }

  async function revertAllChanges() {
    if (isActionInProgress.value || !hasChanges.value) {
      return;
    }
    if (!await requestConfirm({ title: "Откатить ВСЕ изменения?", body: "Это удалит все незакоммиченные правки в текущем проекте." })) {
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
        await refreshGitStatus();
        await loadRootDirectory(true);
      }
    } catch (error) {
      loadError.value = toErrorMessage(error, "Failed to revert all changes.");
    } finally {
      isRevertingAll.value = false;
    }
  }

  async function deletePath(targetPath: string, isDirectory: boolean) {
    const entityLabel = isDirectory ? "папку" : "файл";
    if (isActionInProgress.value || !await requestConfirm({ title: `Удалить ${entityLabel}?`, body: targetPath })) {
      return;
    }
    closeContextMenu();
    revertingPath.value = targetPath;
    loadError.value = "";
    try {
      const response = await window.projectApi.filesystem.deletePath(projectPath.value, targetPath);
      if (!response.ok) {
        loadError.value = response.error ?? "Failed to delete path.";
      } else {
        await refreshGitStatus();
        await loadRootDirectory(true);
      }
    } catch (error) {
      loadError.value = toErrorMessage(error, "Failed to delete path.");
    } finally {
      revertingPath.value = null;
    }
  }

  const handleContextMenuRevertClick = () => {
    if (contextMenu.value) { void revertPath(contextMenu.value.path); }
  };
  const handleContextMenuDeleteClick = () => {
    if (contextMenu.value) { void deletePath(contextMenu.value.path, contextMenu.value.isDirectory); }
  };
  const handleRevertAllClick = () => { void revertAllChanges(); };

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
    }, FILESYSTEM_REFRESH_INTERVAL_MS);
  }

  watch(gitRefreshToken, () => {
    rebuildTreeWithGitStatus();
  });

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
    lastDirectoryResponse = null;
    closeContextMenu();
    void loadRootDirectory();
    startAutoRefresh();
  });

  const fileDragContext = useFileDrag({
    projectPath,
    loadError,
    refreshGitStatus,
    loadRootDirectory
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
    handleContextMenuDeleteClick,
    handleRevertAllClick,
    fileDragContext
  };
}
