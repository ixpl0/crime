/* eslint-disable max-lines-per-function */
import { ref, type Ref } from "vue";
import { type PromptSuffixConfig } from "../types/prompt-suffix";
import { type ProjectSettings } from "../types/project-settings";
import { type ToolbarAction, type ToolbarConfig } from "../types/toolbar";
import {
  defaultPromptSuffixConfig,
  savePromptSuffixConfig
} from "../prompt-suffix/prompt-suffix-storage";
import {
  defaultProjectSettings,
  saveProjectSettings
} from "../settings/project-settings-storage";
import {
  defaultSecretsContent,
  saveSecrets
} from "../settings/secrets-storage";
import { defaultTerminalToolbarConfig, saveTerminalToolbarConfig } from "../toolbar/terminal-toolbar-storage";
import { defaultToolbarConfig, saveToolbarConfig } from "../toolbar/toolbar-storage";
import { applyToolbarActionTracking } from "../toolbar/toolbar-tracking";

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
  const terminalToolbarConfig = ref<ToolbarConfig>(defaultTerminalToolbarConfig);
  const promptSuffixConfig = ref<PromptSuffixConfig>(defaultPromptSuffixConfig);
  const projectSettings = ref<ProjectSettings>(defaultProjectSettings);
  const secretsConfig = ref<string>(defaultSecretsContent);
  const isToolbarConfigEditorOpen = ref(false);
  const isTerminalToolbarConfigEditorOpen = ref(false);
  const isPromptSuffixConfigEditorOpen = ref(false);
  const isProjectSettingsEditorOpen = ref(false);
  const isSecretsEditorOpen = ref(false);

  let promptSuffixConfigEditVersion = 0;
  let promptSuffixConfigPersistedVersion = 0;
  let promptSuffixConfigPersistQueue: Promise<void> = Promise.resolve();
  let projectSettingsPersistQueue: Promise<void> = Promise.resolve();

  return {
    toolbarConfig,
    terminalToolbarConfig,
    promptSuffixConfig,
    projectSettings,
    secretsConfig,
    isToolbarConfigEditorOpen,
    isTerminalToolbarConfigEditorOpen,
    isPromptSuffixConfigEditorOpen,
    isProjectSettingsEditorOpen,
    isSecretsEditorOpen,
    openToolbarConfigEditor,
    openTerminalToolbarConfigEditor,
    closeToolbarConfigEditor,
    closeTerminalToolbarConfigEditor,
    openPromptSuffixConfigEditor,
    closePromptSuffixConfigEditor,
    openProjectSettingsEditor,
    closeProjectSettingsEditor,
    openSecretsEditor,
    closeSecretsEditor,
    handleToolbarConfigSave,
    handleTerminalToolbarConfigSave,
    handlePromptSuffixConfigSave,
    handlePromptSuffixToggle,
    handleSecretsSave,
    applyPromptSuffixConfig,
    persistProjectSettings,
    updateToolbarActionTracking,
    canReloadPromptSuffixConfig,
    resetConfigPersistState
  };

  function openToolbarConfigEditor() {
    isToolbarConfigEditorOpen.value = true;
  }

  function closeToolbarConfigEditor() {
    isToolbarConfigEditorOpen.value = false;
  }

  function openTerminalToolbarConfigEditor() {
    isTerminalToolbarConfigEditorOpen.value = true;
  }

  function closeTerminalToolbarConfigEditor() {
    isTerminalToolbarConfigEditorOpen.value = false;
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

  function openSecretsEditor() {
    isSecretsEditorOpen.value = true;
  }

  function closeSecretsEditor() {
    isSecretsEditorOpen.value = false;
  }

  async function updateToolbarActionTracking(executedAction: ToolbarAction) {
    const updatedConfig = applyToolbarActionTracking(
      toolbarConfig.value,
      executedAction
    );
    if (!updatedConfig) {
      return;
    }

    toolbarConfig.value = updatedConfig;
    if (projectPath.value) {
      try {
        await saveToolbarConfig(projectPath.value, updatedConfig);
      } catch (error) {
        reportUiError(
          "Toolbar tracking",
          error,
          "Не удалось сохранить данные отслеживания."
        );
      }
    }
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
          "Не удалось сохранить конфигурацию суффиксов."
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
          "Не удалось сохранить конфигурацию панели."
        );
        return;
      }
    }
    isToolbarConfigEditorOpen.value = false;
  }

  async function handleTerminalToolbarConfigSave(config: ToolbarConfig) {
    terminalToolbarConfig.value = config;
    if (projectPath.value) {
      try {
        await saveTerminalToolbarConfig(projectPath.value, config);
      } catch (error) {
        reportUiError(
          "Terminal toolbar config",
          error,
          "Не удалось сохранить конфигурацию панели терминала."
        );
        return;
      }
    }
    isTerminalToolbarConfigEditorOpen.value = false;
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

  async function handleSecretsSave(content: string) {
    secretsConfig.value = content;
    if (projectPath.value) {
      try {
        await saveSecrets(projectPath.value, content);
      } catch (error) {
        reportUiError(
          "Secrets config",
          error,
          "Не удалось сохранить секреты."
        );
        return;
      }
    }
    isSecretsEditorOpen.value = false;
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
          "Не удалось сохранить настройки проекта."
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
