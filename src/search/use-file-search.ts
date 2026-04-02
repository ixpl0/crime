import { computed, ref, type Ref } from "vue";
import { type SearchMode } from "./search-dialog-store";

const DEBOUNCE_MS = 200;
const SPINNER_DELAY_MS = 500;
const MIN_CONTENT_QUERY_LENGTH = 2;

interface UseFileSearchOptions {
  projectPath: Ref<string>;
  searchMode: Ref<SearchMode>;
  includeIgnored: Ref<boolean>;
}

const isQueryTooShort = (trimmed: string, mode: SearchMode): boolean =>
  trimmed.length === 0 || (mode === "content" && trimmed.length < MIN_CONTENT_QUERY_LENGTH);

// eslint-disable-next-line max-lines-per-function
export const useFileSearch = (options: UseFileSearchOptions) => {
  const query = ref("");
  const selectedIndex = ref(0);
  const isSearching = ref(false);
  const showSpinner = ref(false);
  const fileResults = ref<readonly FileSearchResult[]>([]);
  const contentResults = ref<readonly ContentSearchResult[]>([]);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let spinnerTimer: ReturnType<typeof setTimeout> | null = null;
  let searchRequestId = 0;

  const hasQuery = computed(() => query.value.trim().length > 0);

  const currentResultCount = computed(() =>
    options.searchMode.value === "names"
      ? fileResults.value.length
      : contentResults.value.length
  );

  const clearSpinnerTimer = () => {
    if (spinnerTimer !== null) {
      clearTimeout(spinnerTimer);
      spinnerTimer = null;
    }
  };

  const startSpinnerTimer = () => {
    clearSpinnerTimer();
    spinnerTimer = setTimeout(() => {
      if (isSearching.value) {
        showSpinner.value = true;
      }
    }, SPINNER_DELAY_MS);
  };

  const clearAllResults = () => {
    fileResults.value = [];
    contentResults.value = [];
    isSearching.value = false;
    showSpinner.value = false;
    clearSpinnerTimer();
  };

  const fetchFileNames = async (searchQuery: string, requestId: number) => {
    const response = await window.projectApi.filesystem.search(
      options.projectPath.value, searchQuery, undefined, options.includeIgnored.value
    );
    if (requestId === searchRequestId) {
      fileResults.value = response.ok && response.results ? response.results : [];
    }
  };

  const fetchFileContent = async (searchQuery: string, requestId: number) => {
    const response = await window.projectApi.filesystem.searchContent(
      options.projectPath.value, searchQuery, undefined, options.includeIgnored.value
    );
    if (requestId === searchRequestId) {
      contentResults.value = response.ok && response.results ? response.results : [];
    }
  };

  const performSearch = async (searchQuery: string, mode: SearchMode) => {
    const requestId = ++searchRequestId;

    if (isQueryTooShort(searchQuery.trim(), mode)) {
      clearAllResults();
      return;
    }

    isSearching.value = true;
    startSpinnerTimer();

    try {
      if (mode === "names") {
        await fetchFileNames(searchQuery, requestId);
      } else {
        await fetchFileContent(searchQuery, requestId);
      }
    } catch {
      if (requestId === searchRequestId) {
        fileResults.value = [];
        contentResults.value = [];
      }
    } finally {
      if (requestId === searchRequestId) {
        isSearching.value = false;
        showSpinner.value = false;
        clearSpinnerTimer();
      }
    }

    selectedIndex.value = 0;
  };

  const scheduleSearch = () => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      void performSearch(query.value, options.searchMode.value);
    }, DEBOUNCE_MS);
  };

  const resetSearchState = () => {
    query.value = "";
    clearAllResults();
    selectedIndex.value = 0;
    searchRequestId += 1;

    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  };

  return {
    query,
    selectedIndex,
    isSearching,
    showSpinner,
    hasQuery,
    currentResultCount,
    fileResults,
    contentResults,
    scheduleSearch,
    performSearch,
    resetSearchState
  };
};
