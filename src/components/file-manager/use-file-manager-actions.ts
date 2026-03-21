import { type ComputedRef, type Ref } from "vue";
import { toErrorMessage } from "../../utils/fail-fast";
import { getGitUnavailableMessage } from "../../utils/context-menu-utils";
import type { FileManagerContextMenuState } from "./file-manager-context-menu-types";

interface UseFileManagerActionsOptions {
  projectPath: Ref<string>;
  loadError: Ref<string>;
  revertingPath: Ref<string | null>;
  isRevertingAll: Ref<boolean>;
  hasChanges: ComputedRef<boolean>;
  isActionInProgress: ComputedRef<boolean>;
  contextMenu: Ref<FileManagerContextMenuState | null>;
  closeContextMenu: () => void;
  refreshGitStatus: () => Promise<void>;
  loadRootDirectory: (isBackgroundRefresh?: boolean) => Promise<void>;
  requestConfirm: (options: { title: string; body?: string }) => Promise<boolean>;
  requestPrompt: (options: { title: string; placeholder?: string }) => Promise<string | null>;
}

function getTargetDirectory(path: string, isDirectory: boolean): string {
  if (isDirectory) {
    return path;
  }
  const normalized = path.replace(/[\\/]+/g, "/");
  const lastSlash = normalized.lastIndexOf("/");
  return lastSlash > 0 ? normalized.substring(0, lastSlash) : normalized;
}

// eslint-disable-next-line max-lines-per-function
export function useFileManagerActions(options: UseFileManagerActionsOptions) {
  const {
    projectPath, loadError, revertingPath, isRevertingAll,
    hasChanges, isActionInProgress, contextMenu,
    closeContextMenu, refreshGitStatus, loadRootDirectory,
    requestConfirm, requestPrompt
  } = options;

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
    const body = "Это удалит все незакоммиченные правки в текущем проекте.";
    if (!await requestConfirm({ title: "Откатить ВСЕ изменения?", body })) {
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

  async function promptAndCreatePath(targetDirectory: string, isDirectory: boolean) {
    if (isActionInProgress.value) {
      return;
    }
    const label = isDirectory ? "папки" : "файла";
    const name = await requestPrompt({
      title: `Имя новой ${label}`,
      placeholder: isDirectory ? "folder-name" : "file-name.txt"
    });
    if (!name || /[/\\]/.test(name)) {
      if (name) { loadError.value = "Имя не может содержать слэши."; }
      return;
    }
    closeContextMenu();
    await executeCreatePath(targetDirectory, name, isDirectory);
  }

  async function executeCreatePath(targetDirectory: string, name: string, isDirectory: boolean) {
    revertingPath.value = targetDirectory;
    loadError.value = "";
    try {
      const response = await window.projectApi.filesystem.createPath(
        projectPath.value, targetDirectory, name, isDirectory
      );
      if (!response.ok) {
        loadError.value = response.error ?? "Failed to create path.";
      } else {
        await refreshGitStatus();
        await loadRootDirectory(true);
      }
    } catch (error) {
      loadError.value = toErrorMessage(error, "Failed to create path.");
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

  const handleContextMenuNewFileClick = () => {
    if (contextMenu.value) {
      void promptAndCreatePath(getTargetDirectory(contextMenu.value.path, contextMenu.value.isDirectory), false);
    }
  };

  const handleContextMenuNewFolderClick = () => {
    if (contextMenu.value) {
      void promptAndCreatePath(getTargetDirectory(contextMenu.value.path, contextMenu.value.isDirectory), true);
    }
  };

  return {
    handleContextMenuRevertClick,
    handleContextMenuDeleteClick,
    handleContextMenuNewFileClick,
    handleContextMenuNewFolderClick,
    handleRevertAllClick
  };
}
