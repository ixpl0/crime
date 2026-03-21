import type { InjectionKey, Ref } from "vue";

export interface FileDragContext {
  readonly dragSourcePath: Ref<string | null>;
  readonly dragOverDirectoryPath: Ref<string | null>;
  onDragStart: (path: string, event: DragEvent) => void;
  onDragEnd: () => void;
  onDragOverDirectory: (directoryPath: string) => void;
  onDropOnDirectory: (directoryPath: string, event: DragEvent) => void;
  clearDragOver: () => void;
}

export const FILE_DRAG_KEY: InjectionKey<FileDragContext> = Symbol("file-drag");
