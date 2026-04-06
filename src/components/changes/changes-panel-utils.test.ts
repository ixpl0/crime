import { describe, it, expect } from "vitest";
import { nameClasses, statusLabel, statusBadgeClasses, sortEntries } from "./changes-panel-utils";

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
