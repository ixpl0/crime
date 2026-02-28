import { onBeforeUnmount, onMounted, ref, type Ref, watch } from "vue";
import type { AppTab } from "../navigation/use-app-navigation";
import { toErrorMessage } from "../utils/fail-fast";

const GIT_TABS: ReadonlySet<AppTab> = new Set(["files", "changes", "git"]);
const FALLBACK_POLLING_MS = 10_000;

function buildStatusSnapshot(entries: readonly GitStatusEntry[], errorValue: string) {
  if (errorValue) {
    return `error:${errorValue}`;
  }

  return entries.map((entry) => `${entry.path}:${entry.status}`).join("|");
}

interface GitStatusState {
  statusEntries: Ref<GitStatusEntry[]>;
  statusResponse: Ref<GitStatusResponse | null>;
  error: Ref<string>;
  refreshToken: Ref<number>;
  isLoading: Ref<boolean>;
}

function applySuccessResponse(
  state: GitStatusState,
  response: GitStatusResponse,
  lastSnapshot: string
) {
  const nextEntries = response.entries ?? [];
  const nextSnapshot = buildStatusSnapshot(nextEntries, "");
  if (nextSnapshot === lastSnapshot) {
    return lastSnapshot;
  }

  state.statusEntries.value = nextEntries;
  state.error.value = "";
  state.refreshToken.value += 1;
  return nextSnapshot;
}

function applyErrorResult(state: GitStatusState, message: string, lastSnapshot: string) {
  const nextSnapshot = buildStatusSnapshot([], message);
  if (nextSnapshot === lastSnapshot) {
    return lastSnapshot;
  }

  state.statusEntries.value = [];
  state.error.value = message;
  state.refreshToken.value += 1;
  return nextSnapshot;
}

// eslint-disable-next-line max-lines-per-function
export function useGitStatus(projectPath: Ref<string>, activeTab: Readonly<Ref<AppTab>>) {
  const state: GitStatusState = {
    statusEntries: ref<GitStatusEntry[]>([]),
    statusResponse: ref<GitStatusResponse | null>(null),
    isLoading: ref(false),
    error: ref(""),
    refreshToken: ref(0)
  };

  let requestId = 0;
  let pollingIntervalId: ReturnType<typeof setInterval> | null = null;
  let isRefreshInFlight = false;
  let unsubscribeWatcher: (() => void) | null = null;
  let lastSnapshot = "";

  const applyFetchedResponse = (response: GitStatusResponse) => {
    state.statusResponse.value = response;
    if (!response.ok) {
      lastSnapshot = applyErrorResult(
        state,
        response.error ?? "Git status unavailable.",
        lastSnapshot
      );
      return;
    }

    lastSnapshot = applySuccessResponse(state, response, lastSnapshot);
  };

  const refresh = async () => {
    const currentRequestId = ++requestId;
    isRefreshInFlight = true;

    try {
      const response = await window.projectApi.git.getStatus(projectPath.value);
      if (currentRequestId === requestId) {
        applyFetchedResponse(response);
      }
    } catch (thrown) {
      if (currentRequestId === requestId) {
        lastSnapshot = applyErrorResult(
          state,
          toErrorMessage(thrown, "Failed to load git status."),
          lastSnapshot
        );
      }
    } finally {
      if (currentRequestId === requestId) {
        isRefreshInFlight = false;
        state.isLoading.value = false;
      }
    }
  };

  const stopPolling = () => {
    if (pollingIntervalId !== null) {
      clearInterval(pollingIntervalId);
      pollingIntervalId = null;
    }
  };

  const startPolling = () => {
    stopPolling();
    pollingIntervalId = setInterval(() => {
      if (isRefreshInFlight) {
        return;
      }

      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }

      if (!GIT_TABS.has(activeTab.value)) {
        return;
      }

      void refresh();
    }, FALLBACK_POLLING_MS);
  };

  const stopWatcher = () => {
    if (unsubscribeWatcher) {
      unsubscribeWatcher();
      unsubscribeWatcher = null;
    }

    void window.projectApi.git.unwatch();
  };

  const startWatcher = () => {
    stopWatcher();
    void window.projectApi.git.watch(projectPath.value);
    unsubscribeWatcher = window.projectApi.git.onChanged(() => {
      void refresh();
    });
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible" && GIT_TABS.has(activeTab.value)) {
      void refresh();
    }
  };

  watch(activeTab, (newTab) => {
    if (GIT_TABS.has(newTab)) {
      void refresh();
    }
  });

  watch(projectPath, () => {
    lastSnapshot = "";
    state.statusEntries.value = [];
    state.statusResponse.value = null;
    state.error.value = "";
    state.refreshToken.value += 1;
    startWatcher();
    void refresh();
    startPolling();
  });

  onMounted(() => {
    state.isLoading.value = true;
    startWatcher();
    void refresh();
    startPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);
  });

  onBeforeUnmount(() => {
    requestId += 1;
    stopPolling();
    stopWatcher();
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  });

  return {
    statusEntries: state.statusEntries,
    statusResponse: state.statusResponse,
    isLoading: state.isLoading,
    error: state.error,
    refreshToken: state.refreshToken,
    refresh
  };
}
