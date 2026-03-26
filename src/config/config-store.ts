import { inject, provide, type InjectionKey } from "vue";
import { type PromptSuffixConfig } from "../types/prompt-suffix";
import { type ProjectSettings } from "../types/project-settings";
import { type ToolbarConfig } from "../types/toolbar";
import { type MaybePromise, type ReadableRef } from "../types/utils";

export interface AppConfigStore {
  settingsDirectoryName: string;
  toolbarConfigFilename: string;
  terminalToolbarConfigFilename: string;
  gitToolbarConfigFilename: string;
  promptSuffixConfigFilename: string;
  projectSettingsFilename: string;
  secretsFilename: string;
  errorMessage: ReadableRef<string>;
  toolbarConfig: ReadableRef<ToolbarConfig>;
  terminalToolbarConfig: ReadableRef<ToolbarConfig>;
  gitToolbarConfig: ReadableRef<ToolbarConfig>;
  promptSuffixConfig: ReadableRef<PromptSuffixConfig>;
  projectSettings: ReadableRef<ProjectSettings>;
  secretsConfig: ReadableRef<string>;
  isToolbarConfigEditorOpen: ReadableRef<boolean>;
  isTerminalToolbarConfigEditorOpen: ReadableRef<boolean>;
  isGitToolbarConfigEditorOpen: ReadableRef<boolean>;
  isPromptSuffixConfigEditorOpen: ReadableRef<boolean>;
  isProjectSettingsEditorOpen: ReadableRef<boolean>;
  isSecretsEditorOpen: ReadableRef<boolean>;
  handleToolbarConfigSave: (config: ToolbarConfig) => MaybePromise;
  handleTerminalToolbarConfigSave: (config: ToolbarConfig) => MaybePromise;
  handleGitToolbarConfigSave: (config: ToolbarConfig) => MaybePromise;
  handlePromptSuffixConfigSave: (config: PromptSuffixConfig) => MaybePromise;
  handleProjectSettingsSave: (settings: ProjectSettings) => MaybePromise;
  handleSecretsSave: (secrets: string) => MaybePromise;
  openToolbarConfigEditor: () => void;
  openTerminalToolbarConfigEditor: () => void;
  openGitToolbarConfigEditor: () => void;
  openPromptSuffixConfigEditor: () => void;
  openProjectSettingsEditor: () => void;
  openSecretsEditor: () => void;
  closeToolbarConfigEditor: () => void;
  closeTerminalToolbarConfigEditor: () => void;
  closeGitToolbarConfigEditor: () => void;
  closePromptSuffixConfigEditor: () => void;
  closeProjectSettingsEditor: () => void;
  closeSecretsEditor: () => void;
  handlePromptSuffixToggle: (index: number) => void;
}

const appConfigStoreKey: InjectionKey<AppConfigStore> = Symbol(
  "crime-app-config-store"
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
