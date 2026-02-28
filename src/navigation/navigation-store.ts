import { inject, provide, type InjectionKey, type Ref } from "vue";
import {
  type AppTab,
  type HiddenPanelId,
  type HiddenPanelOption
} from "./use-app-navigation";

type ReadableRef<T> = Readonly<Ref<T>>;

export interface AppNavigationStore {
  projectPath: ReadableRef<string | null>;
  activeTab: ReadableRef<AppTab>;
  isOpening: ReadableRef<boolean>;
  isProjectDropdownOpen: ReadableRef<boolean>;
  isHiddenPanelsDropdownOpen: ReadableRef<boolean>;
  hiddenPanelOptions: ReadableRef<HiddenPanelOption[]>;
  recentProjects: ReadableRef<string[]>;
  getProjectNameFromPath: (path: string) => string;
  setActiveTab: (tab: AppTab) => void;
  toggleProjectDropdown: () => void;
  handleProjectDropdownFocusOut: (event: FocusEvent) => void;
  handleProjectDropdownTriggerKeydown: (event: KeyboardEvent) => void;
  setProjectDropdownOpen: (shouldOpen: boolean) => void;
  openProjectFolder: () => void;
  openRecentProject: (path: string) => void;
  toggleHiddenPanelsDropdown: () => void;
  handleHiddenPanelsDropdownFocusOut: (event: FocusEvent) => void;
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
  resetChangesSelectedFile: () => void;
  handleChangesPathOpen: (path: string) => void;
}

const appNavigationStoreKey: InjectionKey<AppNavigationStore> = Symbol(
  "dream-ide-app-navigation-store"
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
