/* eslint-disable max-lines-per-function */
import { ref, type Ref } from "vue";
import { type PromptSuffixConfig } from "../types/prompt-suffix";
import { type ProjectSettings } from "../types/project-settings";
import { type ToolbarConfig } from "../types/toolbar";
import { defaultPromptSuffixConfig } from "../prompt-suffix/default-prompt-suffix-config";
import { savePromptSuffixConfig } from "../prompt-suffix/prompt-suffix-storage";
import {
  defaultProjectSettings,
  saveProjectSettings
} from "../settings/project-settings-storage";
import { defaultToolbarConfig } from "../toolbar/default-toolbar-config";
import { saveToolbarConfig } from "../toolbar/toolbar-storage";

interface ConfigManagementDeps {
  readonly projectPath: Ref<string | null>;
  readonly reportUiError: (
    context: string,
    error: unknown,
    fallbackMessage: string
  ) => string;
}

export function useConfigManagement({
  projectPath,
  reportUiError
}: ConfigManagementDeps) {
  const toolbarConfig = ref<ToolbarConfig>(defaultToolbarConfig);
  const promptSuffixConfig = ref<PromptSuffixConfig>(defaultPromptSuffixConfig);
  const projectSettings = ref<ProjectSettings>(defaultProjectSettings);
  const isToolbarConfigEditorOpen = ref(false);
  const isPromptSuffixConfigEditorOpen = ref(false);
  const isProjectSettingsEditorOpen = ref(false);

  let promptSuffixConfigEditVersion = 0;
  let promptSuffixConfigPersistedVersion = 0;
  let promptSuffixConfigPersistQueue: Promise<void> = Promise.resolve();
  let projectSettingsPersistQueue: Promise<void> = Promise.resolve();

  return {
    toolbarConfig,
    promptSuffixConfig,
    projectSettings,
    isToolbarConfigEditorOpen,
    isPromptSuffixConfigEditorOpen,
    isProjectSettingsEditorOpen,
    openToolbarConfigEditor,
    closeToolbarConfigEditor,
    openPromptSuffixConfigEditor,
    closePromptSuffixConfigEditor,
    openProjectSettingsEditor,
    closeProjectSettingsEditor,
    handleToolbarConfigSave,
    handlePromptSuffixConfigSave,
    handlePromptSuffixToggle,
    applyPromptSuffixConfig,
    persistProjectSettings,
    canReloadPromptSuffixConfig,
    resetConfigPersistState
  };

  function openToolbarConfigEditor() {
    isToolbarConfigEditorOpen.value = true;
  }

  function closeToolbarConfigEditor() {
    isToolbarConfigEditorOpen.value = false;
  }

  function openPromptSuffixConfigEditor() {
    isPromptSuffixConfigEditorOpen.value = true;
  }

  function closePromptSuffixConfigEditor() {
    isPromptSuffixConfigEditorOpen.value = false;
  }

  function openProjectSettingsEditor() {
    isProjectSettingsEditorOpen.value = true;
  }

  function closeProjectSettingsEditor() {
    isProjectSettingsEditorOpen.value = false;
  }

  function persistPromptSuffixSettings(
    config: PromptSuffixConfig,
    version: number
  ) {
    if (!projectPath.value) {
      return;
    }

    const path = projectPath.value;
    const operation = async () => {
      try {
        await savePromptSuffixConfig(path, config);
      } catch (error) {
        reportUiError(
          "Prompt suffix config",
          error,
          "Failed to persist prompt suffix configuration."
        );
        return;
      }

      if (
        projectPath.value === path &&
        version > promptSuffixConfigPersistedVersion
      ) {
        promptSuffixConfigPersistedVersion = version;
      }
    };

    promptSuffixConfigPersistQueue = promptSuffixConfigPersistQueue.then(
      operation,
      operation
    );
  }

  function applyPromptSuffixConfig(config: PromptSuffixConfig) {
    promptSuffixConfigEditVersion += 1;
    promptSuffixConfig.value = config;
    persistPromptSuffixSettings(config, promptSuffixConfigEditVersion);
  }

  async function handleToolbarConfigSave(config: ToolbarConfig) {
    toolbarConfig.value = config;
    if (projectPath.value) {
      try {
        await saveToolbarConfig(projectPath.value, config);
      } catch (error) {
        reportUiError(
          "Toolbar config",
          error,
          "Failed to save toolbar configuration."
        );
        return;
      }
    }
    isToolbarConfigEditorOpen.value = false;
  }

  function handlePromptSuffixToggle(index: number) {
    const currentItems = promptSuffixConfig.value.items;
    if (index < 0 || index >= currentItems.length) {
      return;
    }

    const cycleNext = { off: "once", once: "always", always: "off" } as const;
    const nextItems = currentItems.map((item, itemIndex) =>
      itemIndex === index
        ? {
            ...item,
            mode: cycleNext[item.mode]
          }
        : item
    );

    applyPromptSuffixConfig({ items: nextItems });
  }

  function handlePromptSuffixConfigSave(config: PromptSuffixConfig) {
    applyPromptSuffixConfig(config);
    isPromptSuffixConfigEditorOpen.value = false;
  }

  function persistProjectSettings(settings: ProjectSettings) {
    if (!projectPath.value) {
      return;
    }

    const path = projectPath.value;
    const operation = async () => {
      try {
        await saveProjectSettings(path, settings);
      } catch (error) {
        reportUiError(
          "Project settings",
          error,
          "Failed to persist project settings."
        );
      }
    };

    projectSettingsPersistQueue = projectSettingsPersistQueue.then(
      operation,
      operation
    );
  }

  function canReloadPromptSuffixConfig() {
    return promptSuffixConfigEditVersion <= promptSuffixConfigPersistedVersion;
  }

  function resetConfigPersistState() {
    promptSuffixConfigEditVersion = 0;
    promptSuffixConfigPersistedVersion = 0;
    promptSuffixConfigPersistQueue = Promise.resolve();
    projectSettingsPersistQueue = Promise.resolve();
  }
}
