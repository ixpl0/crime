<template>
  <div class="card min-h-0 flex-1 overflow-hidden bg-base-100 shadow-xl">
    <div class="card-body flex min-h-0 flex-col gap-4">
      <div v-if="errorMessage" class="alert alert-error">
        <span>{{ errorMessage }}</span>
      </div>

      <MainPanelHeader />

      <ToolbarConfigEditor
        :current-config="toolbarConfig"
        :config-file-path="toolbarConfigFilePath"
        :open="isToolbarConfigEditorOpen"
        @save="handleToolbarConfigSave"
        @close="closeToolbarConfigEditor"
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

      <AgentPanel v-show="activeTab === 'agent'" />

      <div v-show="activeTab === 'files'" class="min-h-0 flex-1 overflow-hidden px-1">
        <div class="grid h-full min-h-0 grid-rows-[minmax(14rem,1fr)_minmax(0,2fr)] gap-4 lg:grid-cols-[22rem_minmax(0,1fr)] lg:grid-rows-1">
          <FileManagerPanel
            class="h-full min-h-0"
            :project-path="projectPath"
            :selected-path="filesDisplayPath"
            :reveal-path="fileTreeRevealPath"
            :reveal-request-token="fileTreeRevealRequestToken"
            @select-file="handleFileSelect"
          />

          <FileContentViewer
            class="h-full min-h-0"
            :project-path="projectPath"
            :file-path="selectedFilePath"
            :target-line="selectedFileTargetLine"
            :target-request-token="selectedFileTargetRequestToken"
            :is-active="activeTab === 'files'"
          />
        </div>
      </div>

      <div v-show="activeTab === 'changes'" class="min-h-0 flex-1 overflow-hidden px-1">
        <div class="grid h-full min-h-0 grid-rows-[minmax(14rem,1fr)_minmax(0,2fr)] gap-4 lg:grid-cols-[22rem_minmax(0,1fr)] lg:grid-rows-1">
          <ChangesPanel
            class="h-full min-h-0"
            :project-path="projectPath"
            :selected-path="changesSelectedFilePath"
            @select-file="handleChangesFileSelect"
            @open-path="handleChangesPathOpen"
          />

          <FileContentViewer
            class="h-full min-h-0"
            :project-path="projectPath"
            :file-path="changesSelectedFilePath"
            :is-active="activeTab === 'changes'"
          />
        </div>
      </div>

      <div v-show="activeTab === 'git'" class="min-h-0 flex-1 overflow-y-auto px-1">
        <GitGraphPanel :project-path="projectPath" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useAppConfigStore } from "../config/config-store";
import { useAppNavigationStore } from "../navigation/navigation-store";
import AgentPanel from "./AgentPanel.vue";
import ChangesPanel from "./changes/ChangesPanel.vue";
import FileContentViewer from "./FileContentViewer.vue";
import FileManagerPanel from "./file-manager/FileManagerPanel.vue";
import GitGraphPanel from "./git-graph/GitGraphPanel.vue";
import MainPanelHeader from "./MainPanelHeader.vue";
import ProjectSettingsEditor from "./ProjectSettingsEditor.vue";
import PromptSuffixConfigEditor from "./PromptSuffixConfigEditor.vue";
import ToolbarConfigEditor from "./ToolbarConfigEditor.vue";

const {
  settingsDirectoryName,
  toolbarConfigFilename,
  promptSuffixConfigFilename,
  projectSettingsFilename,
  errorMessage,
  isToolbarConfigEditorOpen,
  isPromptSuffixConfigEditorOpen,
  isProjectSettingsEditorOpen,
  toolbarConfig,
  promptSuffixConfig,
  projectSettings,
  handleToolbarConfigSave,
  handlePromptSuffixConfigSave,
  handleProjectSettingsSave,
  closeToolbarConfigEditor,
  closePromptSuffixConfigEditor,
  closeProjectSettingsEditor
} = useAppConfigStore();
const navigationStore = useAppNavigationStore();
const {
  activeTab,
  filesDisplayPath,
  fileTreeRevealPath,
  fileTreeRevealRequestToken,
  handleFileSelect,
  selectedFilePath,
  selectedFileTargetLine,
  selectedFileTargetRequestToken,
  changesSelectedFilePath,
  handleChangesFileSelect,
  handleChangesPathOpen
} = navigationStore;

const projectPath = computed(() => {
  const currentProjectPath = navigationStore.projectPath.value;
  if (currentProjectPath === null) {
    throw new Error("MainPanel requires an active project.");
  }

  return currentProjectPath;
});

const toolbarConfigFilePath = computed(
  () => `${projectPath.value}/${settingsDirectoryName}/${toolbarConfigFilename}`
);
const promptSuffixConfigFilePath = computed(
  () => `${projectPath.value}/${settingsDirectoryName}/${promptSuffixConfigFilename}`
);
const projectSettingsFilePath = computed(
  () => `${projectPath.value}/${settingsDirectoryName}/${projectSettingsFilename}`
);
</script>
