import { computed, nextTick, onBeforeUnmount, onMounted, ref, type Ref, watch, type ComputedRef } from "vue";
import { toErrorMessage } from "../../utils/fail-fast";
import { clampContextMenuX, clampContextMenuY, getGitUnavailableMessage } from "../../utils/context-menu-utils";
import { useContextMenuDragRegionBackdrop } from "../../utils/dropdown-utils";
import {
  buildSnapshot,
  entryDisplayName,
  entryPathDisplayForProject,
  nameClasses,
  sortEntries,
  statusBadgeClasses
} from "./changes-panel-utils";

export interface ChangesContextMenuState {
  x: number;
  y: number;
  path: string;
  status: GitFileStatus;
}

interface UseChangesPanelOptions {
  projectPath: Ref<string>;
  selectedPath: Ref<string | null | undefined>;
  gitStatusResponse: Ref<GitStatusResponse | null>;
  gitRefreshToken: Ref<number>;
  refreshGitStatus: () => Promise<void>;
  requestConfirm: (options: { title: string; body?: string }) => Promise<boolean>;
  onResetSelectedFile?: () => void;
}

// eslint-disable-next-line max-lines-per-function
export function useChangesPanel({
  projectPath,
  selectedPath,
  gitStatusResponse,
  gitRefreshToken,
  refreshGitStatus,
  requestConfirm,
  onResetSelectedFile
}: UseChangesPanelOptions) {
  const hasRefreshed = ref(false);
  const isLoading: ComputedRef<boolean> = computed(
    () => gitStatusResponse.value === null && !hasRefreshed.value
  );
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
    const counts: Record<GitFileStatus, number> = { conflict: 0, modified: 0, added: 0, deleted: 0 };
    for (const entry of changeEntries.value) {
      counts[entry.status] += 1;
    }
    return counts;
  });

  let lastSnapshot = "";

  function closeContextMenu() {
    contextMenu.value = null;
  }

  useContextMenuDragRegionBackdrop(contextMenu, closeContextMenu);

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

    if (selectedPath.value !== null && selectedPath.value !== undefined) {
      const pathExists = entries.some((entry) => entry.path === selectedPath.value);
      if (!pathExists && onResetSelectedFile) {
        onResetSelectedFile();
      }
    }

    lastSnapshot = nextSnapshot;
    changeEntries.value = entries;
    infoMessage.value = info;
    loadError.value = error;
  }

  function applyGitStatusResponse(response: GitStatusResponse | null) {
    if (!response) {
      return;
    }

    hasRefreshed.value = true;

    if (!response.ok) {
      updateSnapshot([], "", response.error ?? "Git статус недоступен.");
      closeContextMenu();
      return;
    }

    if (!response.available) {
      updateSnapshot([], getGitUnavailableMessage(response.reason), "");
      closeContextMenu();
      return;
    }

    const nextEntries = sortEntries(response.entries ?? []);
    const nextInfo = nextEntries.length > 0 ? `${String(nextEntries.length)} изменено` : "";
    updateSnapshot(nextEntries, nextInfo, "");
    if (contextMenu.value && !nextEntries.some((entry) => entry.path === contextMenu.value?.path)) {
      closeContextMenu();
    }
  }

  async function revertPath(path: string) {
    if (isActionInProgress.value) {
      return;
    }

    const confirmed = await requestConfirm({ title: "Откатить изменения файла?", body: path });
    if (!confirmed) {
      return;
    }

    closeContextMenu();
    revertingPath.value = path;
    loadError.value = "";
    try {
      const response = await window.projectApi.git.revertFile(projectPath.value, path);
      if (!response.ok) {
        loadError.value = response.error ?? "Не удалось откатить изменения файла.";
      } else if (!response.available) {
        loadError.value = getGitUnavailableMessage(response.reason);
      } else {
        await refreshGitStatus();
      }
    } catch (error) {
      loadError.value = toErrorMessage(error, "Не удалось откатить изменения файла.");
    } finally {
      revertingPath.value = null;
    }
  }

  async function revertAllChanges() {
    if (isActionInProgress.value || !hasChanges.value) {
      return;
    }

    const confirmed = await requestConfirm({
      title: "Откатить ВСЕ изменения?",
      body: "Это удалит все незакоммиченные правки в текущем проекте."
    });
    if (!confirmed) {
      return;
    }

    closeContextMenu();
    isRevertingAll.value = true;
    loadError.value = "";
    try {
      const response = await window.projectApi.git.revertAll(projectPath.value);
      if (!response.ok) {
        loadError.value = response.error ?? "Не удалось откатить все изменения.";
      } else if (!response.available) {
        loadError.value = getGitUnavailableMessage(response.reason);
      } else {
        await refreshGitStatus();
      }
    } catch (error) {
      loadError.value = toErrorMessage(error, "Не удалось откатить все изменения.");
    } finally {
      isRevertingAll.value = false;
    }
  }

  function handleContextMenuRevertClick() {
    if (contextMenu.value) {
      void revertPath(contextMenu.value.path);
    }
  }

  function handleContextMenuShowInFolder() {
    if (contextMenu.value) {
      void window.projectApi.shell.openPath(contextMenu.value.path);
      closeContextMenu();
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

  watch(gitRefreshToken, () => {
    applyGitStatusResponse(gitStatusResponse.value);
  });

  watch(projectPath, () => {
    lastSnapshot = "";
    hasRefreshed.value = false;
    changeEntries.value = [];
    infoMessage.value = "";
    loadError.value = "";
    closeContextMenu();
    if (onResetSelectedFile) {
      onResetSelectedFile();
    }
  });

  onMounted(() => {
    applyGitStatusResponse(gitStatusResponse.value);
    window.addEventListener("pointerdown", handleGlobalPointerDown, true);
    window.addEventListener("keydown", handleGlobalKeydown, true);
    window.addEventListener("scroll", closeContextMenu, true);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("pointerdown", handleGlobalPointerDown, true);
    window.removeEventListener("keydown", handleGlobalKeydown, true);
    window.removeEventListener("scroll", closeContextMenu, true);
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
    statusBadgeClasses,
    entryDisplayName,
    entryPathDisplay,
    openContextMenu,
    isPathReverting,
    handleContextMenuRevertClick,
    handleContextMenuShowInFolder,
    handleRevertAllClick
  };
}
