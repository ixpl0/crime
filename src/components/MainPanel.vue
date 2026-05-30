<template>
  <div
    ref="mainContainer"
    class="min-h-0 flex-1"
    :class="isAgentDetached ? 'flex flex-row' : 'flex'"
  >
    <!-- Left card (agent + header), or the only card when not detached -->
    <div
      class="card min-h-0 min-w-0 overflow-hidden bg-base-100 shadow-sm"
      :class="agentCardClass"
      :style="agentCardStyle"
    >
      <div ref="cardBody" class="card-body flex min-h-0 flex-col gap-2 p-3">

        <MainPanelHeader :terminal-session-count="terminalSessionCount" />

        <ToolbarConfigEditor
          :current-config="toolbarConfig"
          :config-file-path="toolbarConfigFilePath"
          :open="isToolbarConfigEditorOpen"
          @save="handleToolbarConfigSave"
          @close="closeToolbarConfigEditor"
        />

        <ToolbarConfigEditor
          :current-config="terminalToolbarConfig"
          :config-file-path="terminalToolbarConfigFilePath"
          :open="isTerminalToolbarConfigEditorOpen"
          title="Terminal Toolbar Settings"
          :default-config="defaultTerminalToolbarConfig"
          @save="handleTerminalToolbarConfigSave"
          @close="closeTerminalToolbarConfigEditor"
        />

        <PromptSuffixConfigEditor
          :current-config="promptSuffixConfig"
          :config-file-path="promptSuffixConfigFilePath"
          :open="isPromptSuffixConfigEditorOpen"
          @save="handlePromptSuffixConfigSave"
          @close="closePromptSuffixConfigEditor"
        />

        <ProjectSettingsEditor
          :current-settings="projectSettings"
          :config-file-path="projectSettingsFilePath"
          :open="isProjectSettingsEditorOpen"
          @save="handleProjectSettingsSave"
          @close="closeProjectSettingsEditor"
        />

        <ConfirmDialog />
        <PromptDialog />

        <SecretsEditor
          title="Секреты проекта"
          :file-path="secretsConfigFilePath"
          :current-value="secretsConfig"
          :default-value="defaultSecretsContent"
          :open="isSecretsEditorOpen"
          @save="handleSecretsSave"
          @close="closeSecretsEditor"
        />

        <AgentPanel v-show="isAgentDetached || activeTab === 'agent'" />

        <div
          ref="nonAgentContainer"
          v-show="isAgentDetached || activeTab !== 'agent'"
          class="flex min-h-0 flex-1 flex-col"
        >
          <TerminalWorkspacePanel
            v-show="activeTab === 'terminal'"
            :project-path="projectPath"
            :is-active="activeTab === 'terminal'"
            @update:session-count="terminalSessionCount = $event"
          />
        </div>
      </div>
    </div>

    <PanelResizeHandle
      v-show="isAgentDetached"
      :is-active="isAgentPanelResizeActive"
      @pointerdown="handleAgentPanelResize"
    />

    <SecondaryTabsPanel
      v-show="isAgentDetached"
      class="min-w-0"
      :terminal-session-count="terminalSessionCount"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watchEffect } from "vue";
import { useAppConfigStore } from "../config/config-store";
import { provideTerminalWorkspaceActionsStore } from "../terminal/terminal-workspace-actions-store";
import { usePanelWidthResize } from "../composables/use-panel-width-resize";
import { defaultSecretsContent } from "../settings/secrets-storage";
import { useAppNavigationStore } from "../navigation/navigation-store";
import { defaultTerminalToolbarConfig } from "../toolbar/terminal-toolbar-storage";
import AgentPanel from "./AgentPanel.vue";
import ConfirmDialog from "./ConfirmDialog.vue";
import PromptDialog from "./PromptDialog.vue";
import MainPanelHeader from "./MainPanelHeader.vue";
import PanelResizeHandle from "./PanelResizeHandle.vue";
import ProjectSettingsEditor from "./ProjectSettingsEditor.vue";
import PromptSuffixConfigEditor from "./PromptSuffixConfigEditor.vue";
import SecondaryTabsPanel from "./SecondaryTabsPanel.vue";
import SecretsEditor from "./SecretsEditor.vue";
import TerminalWorkspacePanel from "./TerminalWorkspacePanel.vue";
import ToolbarConfigEditor from "./ToolbarConfigEditor.vue";

const {
  settingsDirectoryName,
  toolbarConfigFilename,
  terminalToolbarConfigFilename,
  promptSuffixConfigFilename,
  projectSettingsFilename,
  secretsFilename,
  isToolbarConfigEditorOpen,
  isTerminalToolbarConfigEditorOpen,
  isPromptSuffixConfigEditorOpen,
  isProjectSettingsEditorOpen,
  isSecretsEditorOpen,
  toolbarConfig,
  terminalToolbarConfig,
  promptSuffixConfig,
  projectSettings,
  secretsConfig,
  handleToolbarConfigSave,
  handleTerminalToolbarConfigSave,
  handlePromptSuffixConfigSave,
  handleProjectSettingsSave,
  handleSecretsSave,
  closeToolbarConfigEditor,
  closeTerminalToolbarConfigEditor,
  closePromptSuffixConfigEditor,
  closeProjectSettingsEditor,
  closeSecretsEditor
} = useAppConfigStore();

const navigationStore = useAppNavigationStore();
const {
  activeTab,
  isAgentDetached
} = navigationStore;

provideTerminalWorkspaceActionsStore();

const mainContainer = ref<HTMLElement | null>(null);
const cardBody = ref<HTMLElement | null>(null);
const nonAgentContainer = ref<HTMLElement | null>(null);

// Move non-agent content between card-body and secondary panel via raw DOM.
// Vue 3 Block Tree uses VNode→el refs (not DOM position), so this is safe.
watchEffect(() => {
  const container = nonAgentContainer.value;
  if (!container) {
    return;
  }
  const target = isAgentDetached.value
    ? document.getElementById("secondary-tabs-content")
    : cardBody.value;
  if (target && container.parentNode !== target) {
    target.appendChild(container);
  }
}, { flush: "post" });

const {
  panelWidth: agentPanelWidth,
  panelMaxWidth: agentPanelMaxWidth,
  isResizeActive: isAgentPanelResizeActive,
  handleResizePointerDown: handleAgentPanelResizePointerDown
} = usePanelWidthResize({
  storageKey: "crime:agent-panel-width",
  defaultWidth: 0,
  minWidth: 200,
  minOppositeWidth: 200
});

const isAgentPanelResized = computed(() => isAgentDetached.value && agentPanelWidth.value > 0);
const agentCardClass = computed(() => isAgentPanelResized.value ? "panel-w-resizable" : "flex-1");
const agentCardStyle = computed(() => isAgentPanelResized.value
  ? { "--panel-w": String(agentPanelWidth.value) + "px", "--panel-max-w": agentPanelMaxWidth }
  : undefined
);

const handleAgentPanelResize = (event: PointerEvent) => {
  if (mainContainer.value) {
    handleAgentPanelResizePointerDown(event, mainContainer.value);
  }
};

const projectPath = computed(() => {
  const currentProjectPath = navigationStore.projectPath.value;
  if (currentProjectPath === null) {
    throw new Error("MainPanel requires an active project.");
  }

  return currentProjectPath;
});

const terminalSessionCount = ref(0);

const toolbarConfigFilePath = computed(
  () => `${projectPath.value}/${settingsDirectoryName}/${toolbarConfigFilename}`
);
const terminalToolbarConfigFilePath = computed(
  () => `${projectPath.value}/${settingsDirectoryName}/${terminalToolbarConfigFilename}`
);
const promptSuffixConfigFilePath = computed(
  () => `${projectPath.value}/${settingsDirectoryName}/${promptSuffixConfigFilename}`
);
const projectSettingsFilePath = computed(
  () => `${projectPath.value}/${settingsDirectoryName}/${projectSettingsFilename}`
);
const secretsConfigFilePath = computed(
  () => `${projectPath.value}/${settingsDirectoryName}/${secretsFilename}`
);
</script>
