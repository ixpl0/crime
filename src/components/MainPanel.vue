<template>
  <div
    ref="mainContainer"
    class="min-h-0 flex-1 overflow-hidden"
    :class="isAgentDetached ? 'flex flex-col gap-4 lg:flex-row lg:gap-0' : 'flex'"
  >
    <!-- Left card (agent + header), or the only card when not detached -->
    <div
      class="card min-h-0 min-w-0 overflow-hidden bg-base-100 shadow-xl"
      :class="agentCardClass"
      :style="agentCardStyle"
    >
      <div class="card-body flex min-h-0 flex-col gap-4">
        <div v-if="errorMessage" class="alert alert-error">
          <span>{{ errorMessage }}</span>
        </div>

        <MainPanelHeader :changes-count="changesCount" />

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

        <SecretsEditor
          title="Секреты проекта"
          :file-path="secretsConfigFilePath"
          :current-value="secretsConfig"
          :default-value="defaultSecretsContent"
          :open="isSecretsEditorOpen"
          @save="handleSecretsSave"
          @close="closeSecretsEditor"
        />

        <!-- Agent: always in left card -->
        <AgentPanel v-show="isAgentDetached || activeTab === 'agent'" />

        <!-- Non-agent tabs: in left card only when NOT detached -->
        <template v-if="!isAgentDetached">
          <TerminalWorkspacePanel
            v-show="activeTab === 'terminal'"
            :project-path="projectPath"
            :is-active="activeTab === 'terminal'"
          />

          <div v-show="activeTab === 'files'" class="min-h-0 flex-1 overflow-hidden px-1 pb-1">
            <div ref="filesContainer" class="flex h-full min-h-0 flex-col gap-4 lg:flex-row lg:gap-0">
              <FileManagerPanel
                class="panel-w-resizable h-full min-h-[14rem] flex-1 lg:min-h-0 lg:flex-none"
                :style="sidebarStyle"
                :project-path="projectPath"
                :selected-path="filesDisplayPath"
                :reveal-path="fileTreeRevealPath"
                :reveal-request-token="fileTreeRevealRequestToken"
                :git-status-response="gitStatusResponse"
                :git-refresh-token="gitStatusRefreshToken"
                :refresh-git-status="refreshGitStatus"
                @select-file="handleFileSelect"
              />

              <PanelResizeHandle
                :is-active="isSidebarResizeActive"
                @pointerdown="handleSidebarResize($event, filesContainer)"
              />

              <FileContentViewer
                class="h-full min-h-0 min-w-0 flex-[2] lg:flex-1"
                :project-path="projectPath"
                :file-path="selectedFilePath"
                :target-line="selectedFileTargetLine"
                :target-request-token="selectedFileTargetRequestToken"
                :refresh-token="gitStatusRefreshToken"
                :is-active="activeTab === 'files'"
              />
            </div>
          </div>

          <div v-show="activeTab === 'changes'" class="min-h-0 flex-1 overflow-hidden px-1 pb-1">
            <div ref="changesContainer" class="flex h-full min-h-0 flex-col gap-4 lg:flex-row lg:gap-0">
              <ChangesPanel
                class="panel-w-resizable h-full min-h-[14rem] flex-1 lg:min-h-0 lg:flex-none"
                :style="sidebarStyle"
                :project-path="projectPath"
                :selected-path="changesSelectedFilePath"
                :git-status-response="gitStatusResponse"
                :git-refresh-token="gitStatusRefreshToken"
                :refresh-git-status="refreshGitStatus"
                @select-file="handleChangesFileSelect"
                @open-path="handleChangesPathOpen"
                @reset-selected-file="resetChangesSelectedFile"
              />

              <PanelResizeHandle
                :is-active="isSidebarResizeActive"
                @pointerdown="handleSidebarResize($event, changesContainer)"
              />

              <FileContentViewer
                class="h-full min-h-0 min-w-0 flex-[2] lg:flex-1"
                :project-path="projectPath"
                :file-path="changesSelectedFilePath"
                :refresh-token="gitStatusRefreshToken"
                :is-active="activeTab === 'changes'"
                @file-not-found="resetChangesSelectedFile"
              />
            </div>
          </div>

          <div v-show="activeTab === 'git'" class="min-h-0 flex-1 overflow-y-auto px-1">
            <GitGraphPanel :project-path="projectPath" :git-refresh-token="gitRepositoryRefreshToken" />
          </div>
        </template>
      </div>
    </div>

    <!-- Resize handle between agent and secondary panels (only when detached) -->
    <PanelResizeHandle
      v-if="isAgentDetached"
      :is-active="isAgentPanelResizeActive"
      @pointerdown="handleAgentPanelResize"
    />

    <!-- Right card: separate panel with non-agent tabs (only when detached) -->
    <SecondaryTabsPanel
      v-if="isAgentDetached"
      class="min-w-0"
      :project-path="projectPath"
      :changes-count="changesCount"
      :git-status-response="gitStatusResponse"
      :git-refresh-token="gitStatusRefreshToken"
      :git-repository-refresh-token="gitRepositoryRefreshToken"
      :refresh-git-status="refreshGitStatus"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useAppConfigStore } from "../config/config-store";
import { usePanelWidthResize } from "../composables/use-panel-width-resize";
import { defaultSecretsContent } from "../settings/secrets-storage";
import { useAppNavigationStore } from "../navigation/navigation-store";
import { defaultTerminalToolbarConfig } from "../toolbar/terminal-toolbar-storage";
import { useGitStatus } from "../composables/use-git-status";
import AgentPanel from "./AgentPanel.vue";
import ChangesPanel from "./changes/ChangesPanel.vue";
import ConfirmDialog from "./ConfirmDialog.vue";
import FileContentViewer from "./FileContentViewer.vue";
import FileManagerPanel from "./file-manager/FileManagerPanel.vue";
import GitGraphPanel from "./git-graph/GitGraphPanel.vue";
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
  errorMessage,
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
  isAgentDetached,
  filesDisplayPath,
  fileTreeRevealPath,
  fileTreeRevealRequestToken,
  handleFileSelect,
  selectedFilePath,
  selectedFileTargetLine,
  selectedFileTargetRequestToken,
  changesSelectedFilePath,
  handleChangesFileSelect,
  resetChangesSelectedFile,
  handleChangesPathOpen
} = navigationStore;

const mainContainer = ref<HTMLElement | null>(null);
const filesContainer = ref<HTMLElement | null>(null);
const changesContainer = ref<HTMLElement | null>(null);

const {
  panelWidth: agentPanelWidth,
  panelMaxWidth: agentPanelMaxWidth,
  isResizeActive: isAgentPanelResizeActive,
  handleResizePointerDown: handleAgentPanelResizePointerDown
} = usePanelWidthResize({
  storageKey: "dream-ide:agent-panel-width",
  defaultWidth: 0,
  minWidth: 200,
  minOppositeWidth: 200
});

const agentCardClass = computed(() => {
  if (isAgentDetached.value && agentPanelWidth.value > 0) {
    return "panel-w-resizable";
  }
  return "flex-1";
});

const agentCardStyle = computed(() => {
  if (isAgentDetached.value && agentPanelWidth.value > 0) {
    return {
      "--panel-w": String(agentPanelWidth.value) + "px",
      "--panel-max-w": agentPanelMaxWidth
    };
  }
  return undefined;
});

const handleAgentPanelResize = (event: PointerEvent) => {
  if (mainContainer.value) {
    handleAgentPanelResizePointerDown(event, mainContainer.value);
  }
};

const {
  panelWidth: sidebarPanelWidth,
  panelMaxWidth: sidebarPanelMaxWidth,
  isResizeActive: isSidebarResizeActive,
  handleResizePointerDown: handleSidebarResizePointerDown
} = usePanelWidthResize({
  storageKey: "dream-ide:sidebar-panel-width",
  defaultWidth: 352,
  minWidth: 50,
  minOppositeWidth: 50
});

const sidebarStyle = computed(() => ({
  "--panel-w": String(sidebarPanelWidth.value) + "px",
  "--panel-max-w": sidebarPanelMaxWidth
}));

const handleSidebarResize = (event: PointerEvent, container: HTMLElement | null) => {
  if (container) {
    handleSidebarResizePointerDown(event, container);
  }
};

const projectPath = computed(() => {
  const currentProjectPath = navigationStore.projectPath.value;
  if (currentProjectPath === null) {
    throw new Error("MainPanel requires an active project.");
  }

  return currentProjectPath;
});

const {
  statusResponse: gitStatusResponse,
  refreshToken: gitStatusRefreshToken,
  repositoryRefreshToken: gitRepositoryRefreshToken,
  refresh: refreshGitStatus
} = useGitStatus(projectPath, activeTab);

const changesCount = computed(() => gitStatusResponse.value?.entries?.length ?? 0);

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
