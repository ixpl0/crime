import { describe, it, expect } from "vitest";
import { ref } from "vue";
import { useFileTreeNodeClasses } from "./file-tree-node-classes";

const createOptions = (overrides: Partial<Record<string, unknown>> = {}) => ({
  entryStatus: ref<GitFileStatus | null>(null),
  isIgnoredEntry: ref(false),
  isDeletedEntry: ref(false),
  isSelectedEntry: ref(false),
  isDragSource: ref(false),
  isDropTarget: ref(false),
  ...overrides
});

describe("useFileTreeNodeClasses", () => {
  describe("buttonClasses", () => {
    it("returns empty string by default (no flags set)", () => {
      const { buttonClasses } = useFileTreeNodeClasses(createOptions());
      expect(buttonClasses.value).toBe("");
    });

    it("includes opacity class when isDragSource is true", () => {
      const options = createOptions();
      options.isDragSource.value = true;
      const { buttonClasses } = useFileTreeNodeClasses(options);
      expect(buttonClasses.value).toContain("opacity-50");
    });

    it("includes drop target classes when isDropTarget is true", () => {
      const options = createOptions();
      options.isDropTarget.value = true;
      const { buttonClasses } = useFileTreeNodeClasses(options);
      expect(buttonClasses.value).toContain("bg-base-content/10");
    });

    it("includes selected classes when isSelectedEntry is true and not drop target", () => {
      const options = createOptions();
      options.isSelectedEntry.value = true;
      const { buttonClasses } = useFileTreeNodeClasses(options);
      expect(buttonClasses.value).toContain("bg-base-300");
    });

    it("prefers drop target over selected styling", () => {
      const options = createOptions();
      options.isDropTarget.value = true;
      options.isSelectedEntry.value = true;
      const { buttonClasses } = useFileTreeNodeClasses(options);
      expect(buttonClasses.value).toContain("bg-base-content/10");
      expect(buttonClasses.value).not.toContain("bg-base-300");
    });

    it("includes reduced opacity for ignored entries", () => {
      const options = createOptions();
      options.isIgnoredEntry.value = true;
      const { buttonClasses } = useFileTreeNodeClasses(options);
      expect(buttonClasses.value).toContain("opacity-[0.55]");
    });

    it("includes slightly reduced opacity for deleted entries", () => {
      const options = createOptions();
      options.isDeletedEntry.value = true;
      const { buttonClasses } = useFileTreeNodeClasses(options);
      expect(buttonClasses.value).toContain("opacity-90");
    });

    it("is reactive — updates when refs change", () => {
      const options = createOptions();
      const { buttonClasses } = useFileTreeNodeClasses(options);
      expect(buttonClasses.value).toBe("");

      options.isDragSource.value = true;
      expect(buttonClasses.value).toContain("opacity-50");
    });
  });

  describe("nameClasses", () => {
    it("returns empty string when no git status", () => {
      const { nameClasses } = useFileTreeNodeClasses(createOptions());
      expect(nameClasses.value).toBe("");
    });

    it("returns green color for added status", () => {
      const options = createOptions();
      options.entryStatus.value = "added";
      const { nameClasses } = useFileTreeNodeClasses(options);
      expect(nameClasses.value).toContain("emerald");
    });

    it("returns blue color for modified status", () => {
      const options = createOptions();
      options.entryStatus.value = "modified";
      const { nameClasses } = useFileTreeNodeClasses(options);
      expect(nameClasses.value).toContain("sky");
    });

    it("returns red color for deleted status", () => {
      const options = createOptions();
      options.entryStatus.value = "deleted";
      const { nameClasses } = useFileTreeNodeClasses(options);
      expect(nameClasses.value).toContain("rose");
    });

    it("returns different classes for different statuses", () => {
      const added = createOptions();
      added.entryStatus.value = "added";
      const modified = createOptions();
      modified.entryStatus.value = "modified";
      const deleted = createOptions();
      deleted.entryStatus.value = "deleted";

      const addedClasses = useFileTreeNodeClasses(added).nameClasses.value;
      const modifiedClasses = useFileTreeNodeClasses(modified).nameClasses.value;
      const deletedClasses = useFileTreeNodeClasses(deleted).nameClasses.value;

      expect(addedClasses).not.toBe(modifiedClasses);
      expect(addedClasses).not.toBe(deletedClasses);
      expect(modifiedClasses).not.toBe(deletedClasses);
    });
  });

  describe("folderIconClasses", () => {
    it("returns warning color for non-deleted folders", () => {
      const { folderIconClasses } = useFileTreeNodeClasses(createOptions());
      expect(folderIconClasses.value).toContain("warning");
    });

    it("returns rose color for deleted folders", () => {
      const options = createOptions();
      options.entryStatus.value = "deleted";
      const { folderIconClasses } = useFileTreeNodeClasses(options);
      expect(folderIconClasses.value).toContain("rose");
    });
  });

  describe("fileIconClasses", () => {
    it("returns muted base color for files without git status", () => {
      const { fileIconClasses } = useFileTreeNodeClasses(createOptions());
      expect(fileIconClasses.value).toContain("base-content");
    });

    it("returns green color for added files", () => {
      const options = createOptions();
      options.entryStatus.value = "added";
      const { fileIconClasses } = useFileTreeNodeClasses(options);
      expect(fileIconClasses.value).toContain("emerald");
    });

    it("returns blue color for modified files", () => {
      const options = createOptions();
      options.entryStatus.value = "modified";
      const { fileIconClasses } = useFileTreeNodeClasses(options);
      expect(fileIconClasses.value).toContain("sky");
    });

    it("returns red color for deleted files", () => {
      const options = createOptions();
      options.entryStatus.value = "deleted";
      const { fileIconClasses } = useFileTreeNodeClasses(options);
      expect(fileIconClasses.value).toContain("rose");
    });
  });
});
