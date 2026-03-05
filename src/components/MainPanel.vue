<template>
  <div class="card min-h-0 flex-1 overflow-hidden bg-base-100 shadow-xl">
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

      <!-- Content: flex-row when detached (agent left, tabs right), flex-col when normal -->
      <div
        class="flex min-h-0 flex-1"
        :class="isAgentDetached ? 'gap-4' : 'flex-col'"
      >
        <!-- Agent section -->
        <AgentPanel
          v-show="isAgentDetached || activeTab === 'agent'"
          :class="{ 'min-w-0': isAgentDetached }"
        />

        <!-- Vertical divider when detached -->
        <div v-if="isAgentDetached" class="w-px shrink-0 bg-base-300" />

        <!-- Other tabs section -->
        <div
          v-show="isAgentDetached || activeTab !== 'agent'"
          class="flex min-h-0 flex-1 flex-col gap-4"
          :class="{ 'min-w-0': isAgentDetached }"
        >
          <!-- Secondary tab bar (only visible when detached) -->
          <div v-if="isAgentDetached" role="tablist" class="tabs tabs-bordered shrink-0">
            <button
              role="tab"
              class="tab"
              tabindex="-1"
              :class="{ 'tab-active': activeTab === 'terminal' }"
              @click="setActiveTab('terminal')"
            >
              Терминал
            </button>
            <button
              role="tab"
              class="tab"
              tabindex="-1"
              :class="{ 'tab-active': activeTab === 'files' }"
              @click="setActiveTab('files')"
            >
              Файлы
            </button>
            <button
              role="tab"
              class="tab"
              tabindex="-1"
              :class="{ 'tab-active': activeTab === 'changes' }"
              @click="setActiveTab('changes')"
            >
              Изменения
              <span v-if="changesCount > 0" class="badge badge-xs badge-primary ml-1">{{ changesCount }}</span>
            </button>
            <button
              role="tab"
              class="tab"
              tabindex="-1"
              :class="{ 'tab-active': activeTab === 'git' }"
              @click="setActiveTab('git')"
            >
              Гит
            </button>
          </div>

          <TerminalWorkspacePanel
            v-show="activeTab === 'terminal'"
            :project-path="projectPath"
            :is-active="activeTab === 'terminal'"
          />

          <div v-show="activeTab === 'files'" class="min-h-0 flex-1 overflow-hidden px-1 pb-1">
            <div class="grid h-full min-h-0 grid-rows-[minmax(14rem,1fr)_minmax(0,2fr)] gap-4 lg:grid-cols-[22rem_minmax(0,1fr)] lg:grid-rows-1">
              <FileManagerPanel
                class="h-full min-h-0"
                :project-path="projectPath"
                :selected-path="filesDisplayPath"
                :reveal-path="fileTreeRevealPath"
                :reveal-request-token="fileTreeRevealRequestToken"
                :git-status-response="gitStatusResponse"
                :git-refresh-token="gitStatusRefreshToken"
                :refresh-git-status="refreshGitStatus"
                @select-file="handleFileSelect"
              />

              <FileContentViewer
                class="h-full min-h-0"
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
            <div class="grid h-full min-h-0 grid-rows-[minmax(14rem,1fr)_minmax(0,2fr)] gap-4 lg:grid-cols-[22rem_minmax(0,1fr)] lg:grid-rows-1">
              <ChangesPanel
                class="h-full min-h-0"
                :project-path="projectPath"
                :selected-path="changesSelectedFilePath"
                :git-status-response="gitStatusResponse"
                :git-refresh-token="gitStatusRefreshToken"
                :refresh-git-status="refreshGitStatus"
                @select-file="handleChangesFileSelect"
                @open-path="handleChangesPathOpen"
                @reset-selected-file="resetChangesSelectedFile"
              />

              <FileContentViewer
                class="h-full min-h-0"
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
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useAppConfigStore } from "../config/config-store";
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
import ProjectSettingsEditor from "./ProjectSettingsEditor.vue";
import PromptSuffixConfigEditor from "./PromptSuffixConfigEditor.vue";
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
  setActiveTab,
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
