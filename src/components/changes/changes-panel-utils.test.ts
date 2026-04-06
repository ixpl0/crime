import { describe, it, expect } from "vitest";
import {
  nameClasses,
  statusLabel,
  statusBadgeClasses,
  sortEntries,
  buildSnapshot,
  toRelativeEntryPath,
  entryPathDisplayForProject,
  entryDisplayName
} from "./changes-panel-utils";

describe("nameClasses", () => {
  it("returns amber for conflict", () => {
    expect(nameClasses("conflict")).toBe("text-amber-400");
  });

  it("returns emerald for added", () => {
    expect(nameClasses("added")).toBe("text-emerald-400");
  });

  it("returns sky for modified", () => {
    expect(nameClasses("modified")).toBe("text-sky-400");
  });

  it("returns rose for deleted", () => {
    expect(nameClasses("deleted")).toBe("text-rose-400");
  });
});

describe("statusLabel", () => {
  it("returns C for conflict", () => {
    expect(statusLabel("conflict")).toBe("C");
  });

  it("returns A for added", () => {
    expect(statusLabel("added")).toBe("A");
  });

  it("returns M for modified", () => {
    expect(statusLabel("modified")).toBe("M");
  });

  it("returns D for deleted", () => {
    expect(statusLabel("deleted")).toBe("D");
  });
});

describe("statusBadgeClasses", () => {
  it("returns amber classes for conflict", () => {
    expect(statusBadgeClasses("conflict")).toContain("amber");
  });

  it("returns emerald classes for added", () => {
    expect(statusBadgeClasses("added")).toContain("emerald");
  });

  it("returns sky classes for modified", () => {
    expect(statusBadgeClasses("modified")).toContain("sky");
  });

  it("returns rose classes for deleted", () => {
    expect(statusBadgeClasses("deleted")).toContain("rose");
  });
});

describe("sortEntries", () => {
  it("sorts conflict entries first", () => {
    const entries: GitStatusEntry[] = [
      { path: "/modified.ts", status: "modified" },
      { path: "/conflict.ts", status: "conflict" },
      { path: "/added.ts", status: "added" }
    ];
    const sorted = sortEntries(entries);
    expect(sorted[0].status).toBe("conflict");
    expect(sorted[1].status).toBe("modified");
    expect(sorted[2].status).toBe("added");
  });

  it("sorts alphabetically within same status", () => {
    const entries: GitStatusEntry[] = [
      { path: "/b.ts", status: "conflict" },
      { path: "/a.ts", status: "conflict" }
    ];
    const sorted = sortEntries(entries);
    expect(sorted[0].path).toBe("/a.ts");
    expect(sorted[1].path).toBe("/b.ts");
  });
});

describe("buildSnapshot", () => {
  it("builds snapshot string from entries", () => {
    const entries: GitStatusEntry[] = [
      { path: "src/a.ts", status: "modified" },
      { path: "src/b.ts", status: "added" }
    ];
    const result = buildSnapshot(entries, "info-text", "error-text");
    expect(result).toBe("info-text\nerror-text\nsrc/a.ts:modified\nsrc/b.ts:added");
  });

  it("builds snapshot with empty entries", () => {
    const result = buildSnapshot([], "info", "");
    expect(result).toBe("info\n\n");
  });
});

describe("toRelativeEntryPath", () => {
  it("strips project path prefix", () => {
    expect(toRelativeEntryPath("/project", "/project/src/file.ts")).toBe("src/file.ts");
  });

  it("normalizes backslashes", () => {
    expect(toRelativeEntryPath("C:\\project", "C:\\project\\src\\file.ts")).toBe("src/file.ts");
  });

  it("returns path as-is when not under project", () => {
    expect(toRelativeEntryPath("/project", "/other/file.ts")).toBe("/other/file.ts");
  });

  it("handles trailing slash in project path", () => {
    expect(toRelativeEntryPath("/project/", "/project/file.ts")).toBe("file.ts");
  });
});

describe("entryPathDisplayForProject", () => {
  it("returns relative path with leading slash", () => {
    expect(entryPathDisplayForProject("/project", "/project/src/file.ts")).toBe("/src/file.ts");
  });

  it("does not double leading slash", () => {
    expect(entryPathDisplayForProject("/project", "/other/file.ts")).toBe("/other/file.ts");
  });
});

describe("entryDisplayName", () => {
  it("returns filename from forward-slash path", () => {
    expect(entryDisplayName("/src/utils/file.ts")).toBe("file.ts");
  });

  it("returns filename from backslash path", () => {
    expect(entryDisplayName("src\\utils\\file.ts")).toBe("file.ts");
  });

  it("returns path itself when no separator", () => {
    expect(entryDisplayName("file.ts")).toBe("file.ts");
  });
});
