import { computed, inject } from "vue";
import { isPathInsideBase, isSamePath } from "../../utils/path-utils";
import { FILE_DRAG_KEY, type FileDragContext } from "./file-drag-injection";

interface UseFileTreeNodeDragOptions {
  getPath: () => string;
  getIsDirectory: () => boolean;
  getIsVirtual: () => boolean;
  getIsDraggable: () => boolean;
}

const isValidDropTarget = (fileDrag: FileDragContext, directoryPath: string): boolean => {
  const sourcePath = fileDrag.dragSourcePath.value;
  if (sourcePath === null) {
    return true;
  }
  if (isSamePath(sourcePath, directoryPath)) {
    return false;
  }
  return !isPathInsideBase(sourcePath, directoryPath);
};

const canAcceptDrop = (
  fileDrag: FileDragContext | undefined,
  options: UseFileTreeNodeDragOptions
): fileDrag is FileDragContext =>
  fileDrag !== undefined
  && options.getIsDirectory()
  && !options.getIsVirtual()
  && isValidDropTarget(fileDrag, options.getPath());

const createDragOverHandler = (fileDrag: FileDragContext | undefined, options: UseFileTreeNodeDragOptions) =>
  (event: DragEvent) => {
    if (!canAcceptDrop(fileDrag, options)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = fileDrag.dragSourcePath.value !== null ? "move" : "copy";
    }
    fileDrag.onDragOverDirectory(options.getPath());
  };

const createDropHandler = (fileDrag: FileDragContext | undefined, options: UseFileTreeNodeDragOptions) =>
  (event: DragEvent) => {
    if (!canAcceptDrop(fileDrag, options)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    fileDrag.onDropOnDirectory(options.getPath(), event);
  };

const buildIsDragSource = (fileDrag: FileDragContext | undefined, getPath: () => string) =>
  computed(() => {
    if (!fileDrag) {
      return false;
    }
    const sourcePath = fileDrag.dragSourcePath.value;
    return sourcePath !== null && isSamePath(sourcePath, getPath());
  });

const buildIsDropTarget = (fileDrag: FileDragContext | undefined, options: UseFileTreeNodeDragOptions) =>
  computed(() => {
    if (!fileDrag || !options.getIsDirectory()) {
      return false;
    }
    const overPath = fileDrag.dragOverDirectoryPath.value;
    return overPath !== null && isSamePath(overPath, options.getPath());
  });

export function useFileTreeNodeDrag(options: UseFileTreeNodeDragOptions) {
  const fileDrag = inject(FILE_DRAG_KEY);

  return {
    isDragSource: buildIsDragSource(fileDrag, options.getPath),
    isDropTarget: buildIsDropTarget(fileDrag, options),
    handleDragStart: (event: DragEvent) => {
      if (!fileDrag || !options.getIsDraggable()) {
        event.preventDefault();
        return;
      }
      fileDrag.onDragStart(options.getPath(), event);
    },
    handleDragEnd: () => { fileDrag?.onDragEnd(); },
    handleNodeDragOver: createDragOverHandler(fileDrag, options),
    handleNodeDrop: createDropHandler(fileDrag, options)
  };
}
