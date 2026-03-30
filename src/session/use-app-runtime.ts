import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  type Ref,
  watch
} from "vue";

const PRIMARY_TERMINAL_SESSION_ID = "primary";

interface UseAppRuntimeOptions {
  isTodoPanelCollapsed: Ref<boolean>;
  isTerminalReady: Ref<boolean>;
  isStartupReady: Ref<boolean>;
  isDebugTodoPanelVisible: Ref<boolean>;
  loadRecentProjectsFromStorage: () => void;
  validateRecentProjects: () => Promise<void>;
  subscribeTerminalData: (listener: (data: string, sessionId: string) => void) => () => void;
  markTerminalDataReceived: (data: string) => void;
  writeTerminalOutput: (data: string) => void;
  subscribeTerminalExit: (listener: (code: number | null, sessionId: string) => void) => () => void;
  writeTerminalNotice: (message: string) => void;
  startProjectLayoutListeners: () => void;
  handleHistoryNavigationMouseButton: (event: MouseEvent) => void;
  reportUiError: (context: string, error: unknown, fallbackMessage: string) => string;
  subscribeGlobalQuickKey: (listener: (input: string) => void) => () => void;
  findQuickKeyByInput: (input: string) => QuickKeyBinding | undefined;
  sendQuickKey: (quickKey: QuickKeyBinding) => void;
  resizeTerminalInputTextareaElement: () => void;
  openLastProjectOnStartup: () => Promise<void>;
  handleTodoPanelCollapsedChanged: (isCollapsed: boolean) => void;
  loadDebugTodoEntries: () => Promise<void>;
  resizeDebugTodoTextareas: () => void;
  stopProjectLayout: () => void;
  stopSettingsWatcher: () => Promise<void>;
  stopTerminalRequest: () => Promise<TerminalResponse>;
  disposeTerminalView: () => void;
}

interface RuntimeSubscriptionState {
  unsubscribeTerminalData: (() => void) | null;
  unsubscribeTerminalExit: (() => void) | null;
  removeWindowHistoryMouseListener: (() => void) | null;
  removeWindowErrorListener: (() => void) | null;
  removeWindowUnhandledRejectionListener: (() => void) | null;
  unsubscribeGlobalQuickKey: (() => void) | null;
}

function createRuntimeSubscriptionState(): RuntimeSubscriptionState {
  return {
    unsubscribeTerminalData: null,
    unsubscribeTerminalExit: null,
    removeWindowHistoryMouseListener: null,
    removeWindowErrorListener: null,
    removeWindowUnhandledRejectionListener: null,
    unsubscribeGlobalQuickKey: null
  };
}

function subscribeTerminalStreams(
  options: UseAppRuntimeOptions,
  state: RuntimeSubscriptionState
) {
  state.unsubscribeTerminalData = options.subscribeTerminalData((data, sessionId) => {
    if (sessionId !== PRIMARY_TERMINAL_SESSION_ID) {
      return;
    }

    options.markTerminalDataReceived(data);
    // Keep terminal stream untouched: PTY output must reach xterm as-is.
    options.writeTerminalOutput(data);
  });

  state.unsubscribeTerminalExit = options.subscribeTerminalExit((code, sessionId) => {
    if (sessionId !== PRIMARY_TERMINAL_SESSION_ID) {
      return;
    }

    options.isTerminalReady.value = false;
    options.writeTerminalNotice(`\r\n[terminal exited: ${String(code ?? "unknown")}]`);
  });
}

function subscribeWindowHistoryNavigation(
  options: UseAppRuntimeOptions,
  state: RuntimeSubscriptionState
) {
  window.addEventListener("mouseup", options.handleHistoryNavigationMouseButton, true);
  state.removeWindowHistoryMouseListener = () => {
    window.removeEventListener("mouseup", options.handleHistoryNavigationMouseButton, true);
  };
}

function subscribeWindowErrorEvents(
  options: UseAppRuntimeOptions,
  state: RuntimeSubscriptionState
) {
  const handleWindowError = (event: ErrorEvent) => {
    options.reportUiError(
      "Unhandled runtime error",
      event.error ?? event.message,
      event.message || "Unhandled runtime error."
    );
  };
  window.addEventListener("error", handleWindowError);
  state.removeWindowErrorListener = () => {
    window.removeEventListener("error", handleWindowError);
  };

  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    options.reportUiError(
      "Unhandled promise rejection",
      event.reason,
      "Unhandled promise rejection."
    );
  };
  window.addEventListener("unhandledrejection", handleUnhandledRejection);
  state.removeWindowUnhandledRejectionListener = () => {
    window.removeEventListener("unhandledrejection", handleUnhandledRejection);
  };
}

function subscribeGlobalQuickKeys(
  options: UseAppRuntimeOptions,
  state: RuntimeSubscriptionState
) {
  state.unsubscribeGlobalQuickKey = options.subscribeGlobalQuickKey((input) => {
    const quickKey = options.findQuickKeyByInput(input);
    if (quickKey) {
      options.sendQuickKey(quickKey);
    }
  });
}

async function runStartupFlow(options: UseAppRuntimeOptions) {
  options.loadRecentProjectsFromStorage();
  void options.validateRecentProjects();
  options.startProjectLayoutListeners();
  void nextTick(() => {
    options.resizeTerminalInputTextareaElement();
  });
  try {
    await options.openLastProjectOnStartup();
  } finally {
    options.isStartupReady.value = true;
  }
  void options.loadDebugTodoEntries();
}

function stopRuntimeSubscriptions(state: RuntimeSubscriptionState) {
  state.unsubscribeTerminalData?.();
  state.unsubscribeTerminalExit?.();
  state.unsubscribeGlobalQuickKey?.();
  state.removeWindowHistoryMouseListener?.();
  state.removeWindowErrorListener?.();
  state.removeWindowUnhandledRejectionListener?.();
}

function stopTerminalRuntime(options: UseAppRuntimeOptions) {
  void options.stopTerminalRequest()
    .then((response) => {
      if (!response.ok) {
        options.reportUiError("Terminal teardown", response.error, "Failed to stop terminal.");
      }
    })
    .catch((error: unknown) => {
      options.reportUiError("Terminal teardown", error, "Failed to stop terminal.");
    });
}

function stopAppRuntime(options: UseAppRuntimeOptions, state: RuntimeSubscriptionState) {
  stopRuntimeSubscriptions(state);
  options.stopProjectLayout();
  void options.stopSettingsWatcher();
  stopTerminalRuntime(options);
  options.disposeTerminalView();
}

export function useAppRuntime(options: UseAppRuntimeOptions) {
  const state = createRuntimeSubscriptionState();

  onMounted(() => {
    subscribeTerminalStreams(options, state);
    subscribeWindowHistoryNavigation(options, state);
    subscribeWindowErrorEvents(options, state);
    subscribeGlobalQuickKeys(options, state);
    void runStartupFlow(options);
  });

  watch(options.isTodoPanelCollapsed, (isCollapsed) => {
    options.handleTodoPanelCollapsedChanged(isCollapsed);
  });

  watch(options.isDebugTodoPanelVisible, (isVisible) => {
    if (isVisible) {
      void nextTick(() => {
        options.resizeDebugTodoTextareas();
      });
    }
  });

  onBeforeUnmount(() => {
    stopAppRuntime(options, state);
  });
}
