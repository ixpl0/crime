// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ref } from "vue";
import { useFileSearch } from "./use-file-search";
import type { SearchMode } from "./search-dialog-store";

const createMockSearchApi = () => ({
  search: vi.fn().mockResolvedValue({ ok: true, results: [] }),
  searchContent: vi.fn().mockResolvedValue({ ok: true, results: [] })
});

let mockApi: ReturnType<typeof createMockSearchApi>;

beforeEach(() => {
  vi.useFakeTimers();
  mockApi = createMockSearchApi();
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  window.projectApi ??= {} as typeof window.projectApi;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  window.projectApi.filesystem ??= {} as typeof window.projectApi.filesystem;
  (window.projectApi.filesystem as unknown as Record<string, unknown>).search = mockApi.search;
  (window.projectApi.filesystem as unknown as Record<string, unknown>).searchContent = mockApi.searchContent;
});

afterEach(() => {
  vi.useRealTimers();
});

const createFileSearch = (mode: SearchMode = "names") =>
  useFileSearch({
    projectPath: ref("/project"),
    searchMode: ref(mode),
    includeIgnored: ref(false)
  });

describe("useFileSearch", () => {
  it("starts with empty query and no results", () => {
    const search = createFileSearch();
    expect(search.query.value).toBe("");
    expect(search.hasQuery.value).toBe(false);
    expect(search.fileResults.value).toEqual([]);
    expect(search.contentResults.value).toEqual([]);
    expect(search.isSearching.value).toBe(false);
  });

  it("hasQuery is true when query has content", () => {
    const search = createFileSearch();
    search.query.value = "test";
    expect(search.hasQuery.value).toBe(true);
  });

  it("hasQuery is false for whitespace-only query", () => {
    const search = createFileSearch();
    search.query.value = "   ";
    expect(search.hasQuery.value).toBe(false);
  });

  it("performSearch clears results for empty query", async () => {
    const search = createFileSearch();
    await search.performSearch("", "names");
    expect(mockApi.search).not.toHaveBeenCalled();
  });

  it("performSearch clears results for too-short content query", async () => {
    const search = createFileSearch("content");
    await search.performSearch("a", "content");
    expect(mockApi.searchContent).not.toHaveBeenCalled();
  });

  it("performSearch allows single-char query for names mode", async () => {
    const search = createFileSearch();
    await search.performSearch("a", "names");
    expect(mockApi.search).toHaveBeenCalled();
  });

  it("performSearch calls filesystem.search for names mode", async () => {
    const search = createFileSearch();
    await search.performSearch("test", "names");
    expect(mockApi.search).toHaveBeenCalled();
  });

  it("performSearch calls filesystem.searchContent for content mode", async () => {
    const search = createFileSearch("content");
    await search.performSearch("test query", "content");
    expect(mockApi.searchContent).toHaveBeenCalled();
  });

  it("resetSearchState clears query and results", () => {
    const search = createFileSearch();
    search.query.value = "something";
    search.resetSearchState();
    expect(search.query.value).toBe("");
    expect(search.isSearching.value).toBe(false);
  });

  it("scheduleSearch debounces execution", () => {
    const search = createFileSearch();
    search.query.value = "test";
    search.scheduleSearch();
    expect(mockApi.search).not.toHaveBeenCalled();
    vi.advanceTimersByTime(250);
    expect(mockApi.search).toHaveBeenCalled();
  });

  it("scheduleSearch cancels previous timer on rapid calls", () => {
    const search = createFileSearch();
    search.query.value = "first";
    search.scheduleSearch();
    vi.advanceTimersByTime(100);
    search.query.value = "second";
    search.scheduleSearch();
    vi.advanceTimersByTime(250);
    // Should have been called once with "second" (the debounced value)
    expect(mockApi.search).toHaveBeenCalledTimes(1);
  });

  it("currentResultCount reflects file results in names mode", async () => {
    mockApi.search.mockResolvedValue({
      ok: true,
      results: [{ path: "/a.ts" }, { path: "/b.ts" }]
    });
    const search = createFileSearch();
    await search.performSearch("test", "names");
    expect(search.currentResultCount.value).toBe(2);
  });
});
