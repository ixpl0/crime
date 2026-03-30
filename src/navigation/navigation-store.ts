import { inject, provide, type InjectionKey } from "vue";
import { type ReadableRef } from "../types/utils";
import {
  type AppTab,
  type HiddenPanelId,
  type HiddenPanelOption
} from "./use-app-navigation";

export interface AppNavigationStore {
  projectPath: ReadableRef<string | null>;
  activeTab: ReadableRef<AppTab>;
  isAgentDetached: ReadableRef<boolean>;
  isOpening: ReadableRef<boolean>;
  isProjectDropdownOpen: ReadableRef<boolean>;
  isHiddenPanelsDropdownOpen: ReadableRef<boolean>;
  hiddenPanelOptions: ReadableRef<HiddenPanelOption[]>;
  recentProjects: ReadableRef<string[]>;
  getProjectNameFromPath: (path: string) => string;
  setActiveTab: (tab: AppTab) => void;
  detachAgent: () => void;
  dockAgent: () => void;
  toggleProjectDropdown: () => void;
  handleProjectDropdownTriggerKeydown: (event: KeyboardEvent) => void;
  setProjectDropdownOpen: (shouldOpen: boolean) => void;
  openProjectFolder: () => void;
  openProjectFolderInNewWindow: () => void;
  createProjectFolder: () => void;
  createProjectInNewWindow: () => void;
  closeProject: () => void;
  openRecentProject: (path: string) => void;
  openProjectInNewWindow: (path: string) => void;
  toggleHiddenPanelsDropdown: () => void;
  handleHiddenPanelsDropdownTriggerKeydown: (event: KeyboardEvent) => void;
  setHiddenPanelsDropdownOpen: (shouldOpen: boolean) => void;
  showHiddenPanel: (panelId: HiddenPanelId) => void;
  filesDisplayPath: ReadableRef<string | null>;
  fileTreeRevealPath: ReadableRef<string | null>;
  fileTreeRevealRequestToken: ReadableRef<number>;
  handleFileSelect: (path: string, options?: { targetLine?: number }) => void;
  selectedFilePath: ReadableRef<string | null>;
  selectedFileTargetLine: ReadableRef<number | null>;
  selectedFileTargetRequestToken: ReadableRef<number>;
  changesSelectedFilePath: ReadableRef<string | null>;
  handleChangesFileSelect: (path: string) => void;
  resetSelectedFile: () => void;
  resetChangesSelectedFile: () => void;
  handleChangesPathOpen: (path: string) => void;
}

const appNavigationStoreKey: InjectionKey<AppNavigationStore> = Symbol(
  "crime-app-navigation-store"
);

export function provideAppNavigationStore(store: AppNavigationStore) {
  provide(appNavigationStoreKey, store);
}

export function useAppNavigationStore() {
  const store = inject(appNavigationStoreKey);
  if (store === undefined) {
    throw new Error("App navigation store is not available.");
  }

  return store;
}
