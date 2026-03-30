import { type Ref, ref } from "vue";
import { toErrorMessage } from "../../utils/fail-fast";
import type { FileDragContext } from "./file-drag-injection";

interface UseFileDragOptions {
  projectPath: Ref<string>;
  loadError: Ref<string>;
  refreshGitStatus: () => Promise<void>;
  loadRootDirectory: (isBackgroundRefresh?: boolean) => Promise<void>;
}

const INTERNAL_DRAG_MIME = "application/x-crime-path";

const getDroppedFilePaths = (files: FileList): readonly string[] =>
  Array.from(files)
    .map((file) => window.projectApi.filesystem.getPathForFile(file))
    .filter((path) => path.length > 0);

async function executeMove(
  options: UseFileDragOptions,
  sourcePath: string,
  destinationDirectory: string
) {
  try {
    const response = await window.projectApi.filesystem.movePath(
      options.projectPath.value, sourcePath, destinationDirectory
    );
    if (!response.ok) {
      options.loadError.value = response.error ?? "Не удалось переместить.";
      return;
    }
    await options.refreshGitStatus();
    await options.loadRootDirectory(true);
  } catch (error) {
    options.loadError.value = toErrorMessage(error, "Не удалось переместить.");
  }
}

async function executeCopy(
  options: UseFileDragOptions,
  paths: readonly string[],
  destinationDirectory: string
) {
  try {
    const response = await window.projectApi.filesystem.copyPaths(
      options.projectPath.value, paths, destinationDirectory
    );
    if (!response.ok) {
      options.loadError.value = response.error ?? "Не удалось скопировать файлы.";
      return;
    }
    await options.refreshGitStatus();
    await options.loadRootDirectory(true);
  } catch (error) {
    options.loadError.value = toErrorMessage(error, "Не удалось скопировать файлы.");
  }
}

function handleDrop(
  options: UseFileDragOptions,
  sourcePath: string | null,
  directoryPath: string,
  dataTransfer: DataTransfer
) {
  const internalPath = sourcePath
    ?? (dataTransfer.getData(INTERNAL_DRAG_MIME) || null);

  if (internalPath !== null) {
    void executeMove(options, internalPath, directoryPath);
    return;
  }

  const paths = getDroppedFilePaths(dataTransfer.files);
  if (paths.length > 0) {
    void executeCopy(options, paths, directoryPath);
  }
}

const initDataTransfer = (event: DragEvent, path: string) => {
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(INTERNAL_DRAG_MIME, path);
  }
};

export function useFileDrag(options: UseFileDragOptions): FileDragContext {
  const dragSourcePath = ref<string | null>(null);
  const dragOverDirectoryPath = ref<string | null>(null);

  return {
    dragSourcePath,
    dragOverDirectoryPath,
    onDragStart: (path: string, event: DragEvent) => {
      dragSourcePath.value = path;
      initDataTransfer(event, path);
    },
    onDragEnd: () => {
      dragSourcePath.value = null;
      dragOverDirectoryPath.value = null;
    },
    onDragOverDirectory: (directoryPath: string) => {
      dragOverDirectoryPath.value = directoryPath;
    },
    onDropOnDirectory: (directoryPath: string, event: DragEvent) => {
      const sourcePath = dragSourcePath.value;
      dragSourcePath.value = null;
      dragOverDirectoryPath.value = null;
      if (event.dataTransfer) {
        handleDrop(options, sourcePath, directoryPath, event.dataTransfer);
      }
    },
    clearDragOver: () => {
      dragOverDirectoryPath.value = null;
    }
  };
}
