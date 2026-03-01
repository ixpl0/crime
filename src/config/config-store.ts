import { inject, provide, type InjectionKey, type Ref } from "vue";
import { type PromptSuffixConfig } from "../types/prompt-suffix";
import { type ProjectSettings } from "../types/project-settings";
import { type ToolbarConfig } from "../types/toolbar";

type ReadableRef<T> = Readonly<Ref<T>>;
type MaybePromise = void | Promise<void>;

export interface AppConfigStore {
  settingsDirectoryName: string;
  toolbarConfigFilename: string;
  terminalToolbarConfigFilename: string;
  promptSuffixConfigFilename: string;
  projectSettingsFilename: string;
  secretsFilename: string;
  errorMessage: ReadableRef<string>;
  toolbarConfig: ReadableRef<ToolbarConfig>;
  terminalToolbarConfig: ReadableRef<ToolbarConfig>;
  promptSuffixConfig: ReadableRef<PromptSuffixConfig>;
  projectSettings: ReadableRef<ProjectSettings>;
  secretsConfig: ReadableRef<string>;
  isToolbarConfigEditorOpen: ReadableRef<boolean>;
  isTerminalToolbarConfigEditorOpen: ReadableRef<boolean>;
  isPromptSuffixConfigEditorOpen: ReadableRef<boolean>;
  isProjectSettingsEditorOpen: ReadableRef<boolean>;
  isSecretsEditorOpen: ReadableRef<boolean>;
  handleToolbarConfigSave: (config: ToolbarConfig) => MaybePromise;
  handleTerminalToolbarConfigSave: (config: ToolbarConfig) => MaybePromise;
  handlePromptSuffixConfigSave: (config: PromptSuffixConfig) => MaybePromise;
  handleProjectSettingsSave: (settings: ProjectSettings) => MaybePromise;
  handleSecretsSave: (secrets: string) => MaybePromise;
  openToolbarConfigEditor: () => void;
  openTerminalToolbarConfigEditor: () => void;
  openPromptSuffixConfigEditor: () => void;
  openProjectSettingsEditor: () => void;
  openSecretsEditor: () => void;
  closeToolbarConfigEditor: () => void;
  closeTerminalToolbarConfigEditor: () => void;
  closePromptSuffixConfigEditor: () => void;
  closeProjectSettingsEditor: () => void;
  closeSecretsEditor: () => void;
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
