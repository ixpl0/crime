import { computed, type Ref } from "vue";

interface FileTreeNodeClassesOptions {
  entryStatus: Ref<GitFileStatus | null>;
  isIgnoredEntry: Ref<boolean>;
  isDeletedEntry: Ref<boolean>;
  isSelectedEntry: Ref<boolean>;
  isDragSource: Ref<boolean>;
  isDropTarget: Ref<boolean>;
}

const buildButtonClasses = (options: FileTreeNodeClassesOptions) =>
  computed(() => {
    const classes: string[] = [];
    if (options.isDragSource.value) {
      classes.push("opacity-50");
    }
    if (options.isDropTarget.value) {
      classes.push("border-base-content/25 bg-base-content/10");
    } else if (options.isSelectedEntry.value) {
      classes.push("border-base-content/15 bg-base-300");
    }
    if (options.isIgnoredEntry.value) {
      classes.push("opacity-[0.55]");
      return classes.join(" ");
    }
    if (options.isDeletedEntry.value) {
      classes.push("opacity-90");
    }
    return classes.join(" ");
  });

const STATUS_TO_NAME_CLASS: Record<string, string> = {
  added: "text-green-600",
  modified: "text-blue-600",
  deleted: "text-red-600"
};

const STATUS_TO_FILE_ICON_CLASS: Record<string, string> = {
  added: "text-green-500",
  modified: "text-blue-500",
  deleted: "text-red-500"
};

export function useFileTreeNodeClasses(options: FileTreeNodeClassesOptions) {
  return {
    buttonClasses: buildButtonClasses(options),
    nameClasses: computed(() => STATUS_TO_NAME_CLASS[options.entryStatus.value ?? ""] ?? ""),
    folderIconClasses: computed(() =>
      options.entryStatus.value === "deleted" ? "text-red-500" : "text-warning"
    ),
    fileIconClasses: computed(() =>
      STATUS_TO_FILE_ICON_CLASS[options.entryStatus.value ?? ""] ?? "text-base-content/50"
    )
  };
}
