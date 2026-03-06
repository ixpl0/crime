import { computed, nextTick, ref, type Ref } from "vue";
import { DROPDOWN_OPEN_KEYS, focusFirstDropdownItem, useDropdownClickOutside } from "../utils/dropdown-utils";

export type AppTab = "agent" | "terminal" | "files" | "changes" | "git";
export type HiddenPanelId = "todo";

export interface HiddenPanelOption {
  id: HiddenPanelId;
  title: string;
}

interface UseAppNavigationOptions {
  isTodoPanelCollapsed: Ref<boolean>;
  isAgentDetached: Ref<boolean>;
  onOpenProjectFolder: () => void;
  onOpenRecentProject: (path: string) => void;
  onAgentTabActivated: () => void;
}

interface DropdownState {
  isProjectDropdownOpen: Ref<boolean>;
  isHiddenPanelsDropdownOpen: Ref<boolean>;
}

interface TabState {
  activeTab: Ref<AppTab>;
  tabBackHistory: AppTab[];
  tabForwardHistory: AppTab[];
}

function updateDropdownState(shouldOpen: boolean, source: Ref<boolean>, opposite: Ref<boolean>) {
  source.value = shouldOpen;
  if (shouldOpen) {
    opposite.value = false;
  }
}

function setProjectDropdownOpen(shouldOpen: boolean, state: DropdownState) {
  updateDropdownState(
    shouldOpen,
    state.isProjectDropdownOpen,
    state.isHiddenPanelsDropdownOpen
  );
}

function setHiddenPanelsDropdownOpen(shouldOpen: boolean, state: DropdownState) {
  updateDropdownState(
    shouldOpen,
    state.isHiddenPanelsDropdownOpen,
    state.isProjectDropdownOpen
  );
}

function handleDropdownTriggerKeydown(
  event: KeyboardEvent,
  setDropdownOpen: (shouldOpen: boolean) => void
) {
  if (event.key === "Escape") {
    setDropdownOpen(false);
    return;
  }

  if (!DROPDOWN_OPEN_KEYS.has(event.key)) {
    return;
  }

  event.preventDefault();
  setDropdownOpen(true);
  if (event.key === "ArrowDown") {
    focusFirstDropdownItem(event.currentTarget);
  }
}

function createDropdownState() {
  return {
    isProjectDropdownOpen: ref(false),
    isHiddenPanelsDropdownOpen: ref(false)
  };
}

function createDropdownStateApi(state: DropdownState) {
  return {
    isProjectDropdownOpen: state.isProjectDropdownOpen,
    isHiddenPanelsDropdownOpen: state.isHiddenPanelsDropdownOpen,
    setProjectDropdownOpen: (shouldOpen: boolean) => {
      setProjectDropdownOpen(shouldOpen, state);
    },
    setHiddenPanelsDropdownOpen: (shouldOpen: boolean) => {
      setHiddenPanelsDropdownOpen(shouldOpen, state);
    },
    toggleProjectDropdown: () => {
      setProjectDropdownOpen(!state.isProjectDropdownOpen.value, state);
    },
    toggleHiddenPanelsDropdown: () => {
      setHiddenPanelsDropdownOpen(!state.isHiddenPanelsDropdownOpen.value, state);
    }
  };
}

function createDropdownKeyboardApi(state: DropdownState) {
  return {
    handleProjectDropdownTriggerKeydown: (event: KeyboardEvent) => {
      handleDropdownTriggerKeydown(event, (shouldOpen) => {
        setProjectDropdownOpen(shouldOpen, state);
      });
    },
    handleHiddenPanelsDropdownTriggerKeydown: (event: KeyboardEvent) => {
      handleDropdownTriggerKeydown(event, (shouldOpen) => {
        setHiddenPanelsDropdownOpen(shouldOpen, state);
      });
    }
  };
}

function setupDropdownClickOutside(state: DropdownState) {
  useDropdownClickOutside(state.isProjectDropdownOpen, () => {
    setProjectDropdownOpen(false, state);
  });
  useDropdownClickOutside(state.isHiddenPanelsDropdownOpen, () => {
    setHiddenPanelsDropdownOpen(false, state);
  });
}

function detachAgent(
  tabState: TabState,
  isAgentDetached: Ref<boolean>,
  onAgentTabActivated: () => void
) {
  if (isAgentDetached.value) {
    return;
  }
  isAgentDetached.value = true;
  if (tabState.activeTab.value === "agent") {
    setActiveTab("terminal", tabState, onAgentTabActivated);
  }
}

function dockAgent(
  tabState: TabState,
  isAgentDetached: Ref<boolean>,
  onAgentTabActivated: () => void
) {
  if (!isAgentDetached.value) {
    return;
  }
  isAgentDetached.value = false;
  setActiveTab("agent", tabState, onAgentTabActivated);
}

function createDropdownActionApi(options: UseAppNavigationOptions, state: DropdownState) {
  const hiddenPanelOptions = computed<HiddenPanelOption[]>(() =>
    options.isTodoPanelCollapsed.value ? [{ id: "todo", title: "Задачи" }] : []
  );

  return {
    hiddenPanelOptions,
    handleProjectDropdownOpenFolderClick: () => {
      setProjectDropdownOpen(false, state);
      options.onOpenProjectFolder();
    },
    handleProjectDropdownRecentClick: (path: string) => {
      setProjectDropdownOpen(false, state);
      options.onOpenRecentProject(path);
    },
    handleHiddenPanelOptionClick: (panelId: HiddenPanelId) => {
      void panelId;
      setHiddenPanelsDropdownOpen(false, state);
      options.isTodoPanelCollapsed.value = false;
    }
  };
}

function createDropdownNavigationApi(options: UseAppNavigationOptions, state: DropdownState) {
  setupDropdownClickOutside(state);

  return {
    ...createDropdownStateApi(state),
    ...createDropdownKeyboardApi(state),
    ...createDropdownActionApi(options, state)
  };
}

function createTabState() {
  return {
    activeTab: ref<AppTab>("agent"),
    tabBackHistory: [] as AppTab[],
    tabForwardHistory: [] as AppTab[]
  };
}

function setActiveTab(
  nextTab: AppTab,
  state: TabState,
  onAgentTabActivated: () => void,
  shouldTrackHistory = true
) {
  const currentTab = state.activeTab.value;
  if (currentTab === nextTab) {
    return;
  }

  if (shouldTrackHistory) {
    state.tabBackHistory.push(currentTab);
    state.tabForwardHistory.length = 0;
  }

  state.activeTab.value = nextTab;
  if (nextTab === "agent") {
    void nextTick(() => {
      onAgentTabActivated();
    });
  }
}

function navigateTabHistoryBack(state: TabState, onAgentTabActivated: () => void) {
  const previousTab = state.tabBackHistory.pop();
  if (!previousTab) {
    return;
  }

  state.tabForwardHistory.push(state.activeTab.value);
  setActiveTab(previousTab, state, onAgentTabActivated, false);
}

function navigateTabHistoryForward(state: TabState, onAgentTabActivated: () => void) {
  const nextTab = state.tabForwardHistory.pop();
  if (!nextTab) {
    return;
  }

  state.tabBackHistory.push(state.activeTab.value);
  setActiveTab(nextTab, state, onAgentTabActivated, false);
}

function createTabNavigationApi(state: TabState, onAgentTabActivated: () => void) {
  return {
    activeTab: state.activeTab,
    setActiveTab: (nextTab: AppTab) => {
      setActiveTab(nextTab, state, onAgentTabActivated);
    },
    clearTabNavigationHistory: () => {
      state.tabBackHistory.length = 0;
      state.tabForwardHistory.length = 0;
    },
    handleHistoryNavigationMouseButton: (event: MouseEvent) => {
      if (event.button === 3) {
        event.preventDefault();
        event.stopPropagation();
        navigateTabHistoryBack(state, onAgentTabActivated);
        return;
      }

      if (event.button === 4) {
        event.preventDefault();
        event.stopPropagation();
        navigateTabHistoryForward(state, onAgentTabActivated);
      }
    }
  };
}

export function useAppNavigation(options: UseAppNavigationOptions) {
  const dropdownState = createDropdownState();
  const tabState = createTabState();

  if (options.isAgentDetached.value && tabState.activeTab.value === "agent") {
    tabState.activeTab.value = "terminal";
  }

  return {
    ...createDropdownNavigationApi(options, dropdownState),
    ...createTabNavigationApi(tabState, options.onAgentTabActivated),
    isAgentDetached: options.isAgentDetached,
    detachAgent: () => {
      detachAgent(tabState, options.isAgentDetached, options.onAgentTabActivated);
    },
    dockAgent: () => {
      dockAgent(tabState, options.isAgentDetached, options.onAgentTabActivated);
    }
  };
}
