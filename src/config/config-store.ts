import { inject, provide, type InjectionKey, type Ref } from "vue";
import { type PromptSuffixConfig } from "../types/prompt-suffix";
import { type ProjectSettings } from "../types/project-settings";
import { type ToolbarConfig } from "../types/toolbar";

type ReadableRef<T> = Readonly<Ref<T>>;
type MaybePromise = void | Promise<void>;

export interface AppConfigStore {
  settingsDirectoryName: string;
  toolbarConfigFilename: string;
  promptSuffixConfigFilename: string;
  projectSettingsFilename: string;
  errorMessage: ReadableRef<string>;
  toolbarConfig: ReadableRef<ToolbarConfig>;
  promptSuffixConfig: ReadableRef<PromptSuffixConfig>;
  projectSettings: ReadableRef<ProjectSettings>;
  isToolbarConfigEditorOpen: ReadableRef<boolean>;
  isPromptSuffixConfigEditorOpen: ReadableRef<boolean>;
  isProjectSettingsEditorOpen: ReadableRef<boolean>;
  handleToolbarConfigSave: (config: ToolbarConfig) => MaybePromise;
  handlePromptSuffixConfigSave: (config: PromptSuffixConfig) => MaybePromise;
  handleProjectSettingsSave: (settings: ProjectSettings) => MaybePromise;
  openToolbarConfigEditor: () => void;
  openPromptSuffixConfigEditor: () => void;
  openProjectSettingsEditor: () => void;
  closeToolbarConfigEditor: () => void;
  closePromptSuffixConfigEditor: () => void;
  closeProjectSettingsEditor: () => void;
  handlePromptSuffixToggle: (index: number) => void;
}

const appConfigStoreKey: InjectionKey<AppConfigStore> = Symbol(
  "dream-ide-app-config-store"
);

export function provideAppConfigStore(store: AppConfigStore) {
  provide(appConfigStoreKey, store);
}

export function useAppConfigStore() {
  const store = inject(appConfigStoreKey);
  if (store === undefined) {
    throw new Error("App config store is not available.");
  }

  return store;
}
