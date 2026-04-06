// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useRecentProjects } from "./use-recent-projects";

const STORAGE_KEY = "test-recent-projects";

const mockReadDirectory = vi.fn().mockResolvedValue({ ok: true });

beforeEach(() => {
  localStorage.clear();
  mockReadDirectory.mockReset().mockResolvedValue({ ok: true });
});

describe("useRecentProjects", () => {
  it("returns empty list when no stored projects", () => {
    const { recentProjects } = useRecentProjects(STORAGE_KEY, mockReadDirectory);
    expect(recentProjects.value).toEqual([]);
  });

  it("loads stored projects from localStorage on creation", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["/a", "/b"]));
    const { recentProjects } = useRecentProjects(STORAGE_KEY, mockReadDirectory);
    expect(recentProjects.value).toEqual(["/a", "/b"]);
  });

  it("handles invalid JSON in localStorage gracefully", () => {
    localStorage.setItem(STORAGE_KEY, "not-json{{{");
    const { recentProjects } = useRecentProjects(STORAGE_KEY, mockReadDirectory);
    expect(recentProjects.value).toEqual([]);
  });

  it("filters out non-string items from stored array", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["/a", 42, null, "/b"]));
    const { recentProjects } = useRecentProjects(STORAGE_KEY, mockReadDirectory);
    expect(recentProjects.value).toEqual(["/a", "/b"]);
  });

  it("returns empty for non-array JSON", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ path: "/a" }));
    const { recentProjects } = useRecentProjects(STORAGE_KEY, mockReadDirectory);
    expect(recentProjects.value).toEqual([]);
  });
});

describe("getProjectNameFromPath", () => {
  it("returns last segment of POSIX path", () => {
    const { getProjectNameFromPath } = useRecentProjects(STORAGE_KEY, mockReadDirectory);
    expect(getProjectNameFromPath("/home/user/project")).toBe("project");
  });

  it("returns last segment of Windows path", () => {
    const { getProjectNameFromPath } = useRecentProjects(STORAGE_KEY, mockReadDirectory);
    expect(getProjectNameFromPath("C:\\Users\\user\\project")).toBe("project");
  });

  it("handles trailing slash", () => {
    const { getProjectNameFromPath } = useRecentProjects(STORAGE_KEY, mockReadDirectory);
    expect(getProjectNameFromPath("/home/user/project/")).toBe("project");
  });

  it("returns path itself for root-like path", () => {
    const { getProjectNameFromPath } = useRecentProjects(STORAGE_KEY, mockReadDirectory);
    const name = getProjectNameFromPath("/");
    expect(typeof name).toBe("string");
  });
});

describe("addRecentProject", () => {
  it("adds project to the front of the list", () => {
    const { recentProjects, addRecentProject } = useRecentProjects(STORAGE_KEY, mockReadDirectory);
    addRecentProject("/first");
    addRecentProject("/second");
    expect(recentProjects.value[0]).toBe("/second");
  });

  it("deduplicates: moves existing project to front", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["/a", "/b", "/c"]));
    const { recentProjects, addRecentProject } = useRecentProjects(STORAGE_KEY, mockReadDirectory);
    addRecentProject("/b");
    expect(recentProjects.value[0]).toBe("/b");
    expect(recentProjects.value.filter((p) => p === "/b")).toHaveLength(1);
  });

  it("limits list to 10 projects", () => {
    const { recentProjects, addRecentProject } = useRecentProjects(STORAGE_KEY, mockReadDirectory);
    for (let i = 0; i < 15; i++) {
      addRecentProject(`/project-${String(i)}`);
    }
    expect(recentProjects.value.length).toBeLessThanOrEqual(10);
  });

  it("persists to localStorage", () => {
    const { addRecentProject } = useRecentProjects(STORAGE_KEY, mockReadDirectory);
    addRecentProject("/saved");
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as string[];
    expect(stored).toContain("/saved");
  });
});

describe("removeRecentProject", () => {
  it("removes project from the list", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["/a", "/b", "/c"]));
    const { recentProjects, removeRecentProject } = useRecentProjects(STORAGE_KEY, mockReadDirectory);
    removeRecentProject("/b");
    expect(recentProjects.value).toEqual(["/a", "/c"]);
  });

  it("does nothing when path not in list", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["/a", "/b"]));
    const { recentProjects, removeRecentProject } = useRecentProjects(STORAGE_KEY, mockReadDirectory);
    removeRecentProject("/nonexistent");
    expect(recentProjects.value).toEqual(["/a", "/b"]);
  });

  it("persists removal to localStorage", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["/a", "/b"]));
    const { removeRecentProject } = useRecentProjects(STORAGE_KEY, mockReadDirectory);
    removeRecentProject("/a");
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as string[];
    expect(stored).not.toContain("/a");
  });
});

describe("validateRecentProjects", () => {
  it("removes projects that fail validation", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["/valid", "/invalid"]));
    mockReadDirectory.mockImplementation((path: string) =>
      Promise.resolve({ ok: path === "/valid" })
    );
    const { recentProjects, validateRecentProjects } = useRecentProjects(STORAGE_KEY, mockReadDirectory);
    await validateRecentProjects();
    expect(recentProjects.value).toEqual(["/valid"]);
  });

  it("keeps all projects when all are valid", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["/a", "/b"]));
    const { recentProjects, validateRecentProjects } = useRecentProjects(STORAGE_KEY, mockReadDirectory);
    await validateRecentProjects();
    expect(recentProjects.value).toEqual(["/a", "/b"]);
  });

  it("handles readDirectory throwing errors gracefully", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["/ok", "/throws"]));
    mockReadDirectory.mockImplementation((path: string) => {
      if (path === "/throws") {
        return Promise.reject(new Error("access denied"));
      }
      return Promise.resolve({ ok: true });
    });
    const { recentProjects, validateRecentProjects } = useRecentProjects(STORAGE_KEY, mockReadDirectory);
    await validateRecentProjects();
    expect(recentProjects.value).toEqual(["/ok"]);
  });
});

describe("loadRecentProjectsFromStorage", () => {
  it("refreshes ref from localStorage", () => {
    const { recentProjects, loadRecentProjectsFromStorage } = useRecentProjects(STORAGE_KEY, mockReadDirectory);
    expect(recentProjects.value).toEqual([]);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["/new"]));
    loadRecentProjectsFromStorage();
    expect(recentProjects.value).toEqual(["/new"]);
  });
});
