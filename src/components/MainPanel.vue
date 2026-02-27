<template>
  <div class="card min-h-0 bg-base-100 shadow-xl">
    <div class="card-body flex min-h-0 flex-col gap-4">
      <div v-if="errorMessage" class="alert alert-error">
        <span>{{ errorMessage }}</span>
      </div>

      <MainPanelHeader
        :active-tab="activeTab"
        :is-opening="isOpening"
        :is-project-dropdown-open="isProjectDropdownOpen"
        :is-hidden-panels-dropdown-open="isHiddenPanelsDropdownOpen"
        :hidden-panel-options="hiddenPanelOptions"
        :recent-projects="recentProjects"
        :get-project-name-from-path="getProjectNameFromPath"
        :set-active-tab="setActiveTab"
        :toggle-project-dropdown="toggleProjectDropdown"
        :handle-project-dropdown-focus-out="handleProjectDropdownFocusOut"
        :handle-project-dropdown-trigger-keydown="handleProjectDropdownTriggerKeydown"
        :set-project-dropdown-open="setProjectDropdownOpen"
        :open-project-folder="openProjectFolder"
        :open-recent-project="openRecentProject"
        :toggle-hidden-panels-dropdown="toggleHiddenPanelsDropdown"
        :handle-hidden-panels-dropdown-focus-out="handleHiddenPanelsDropdownFocusOut"
        :handle-hidden-panels-dropdown-trigger-keydown="handleHiddenPanelsDropdownTriggerKeydown"
        :set-hidden-panels-dropdown-open="setHiddenPanelsDropdownOpen"
        :show-hidden-panel="showHiddenPanel"
        :open-project-settings="openProjectSettings"
      />

      <ToolbarConfigEditor
        :current-config="toolbarConfig"
        :config-file-path="`${projectPath}/${settingsDirectoryName}/${toolbarConfigFilename}`"
        :open="isToolbarConfigEditorOpen"
        @save="handleToolbarConfigSave"
        @close="closeToolbarConfigEditor"
      />

      <PromptSuffixConfigEditor
        :current-config="promptSuffixConfig"
        :config-file-path="`${projectPath}/${settingsDirectoryName}/${promptSuffixConfigFilename}`"
        :open="isPromptSuffixConfigEditorOpen"
        @save="handlePromptSuffixConfigSave"
        @close="closePromptSuffixConfigEditor"
      />

      <ProjectSettingsEditor
        :current-settings="projectSettings"
        :config-file-path="`${projectPath}/${settingsDirectoryName}/${projectSettingsFilename}`"
        :open="isProjectSettingsEditorOpen"
        @save="handleProjectSettingsSave"
        @close="closeProjectSettingsEditor"
      />

      <AgentPanel
        v-show="activeTab === 'agent'"
        :toolbar-config="toolbarConfig"
        :prompt-suffix-config="promptSuffixConfig"
        :is-terminal-ready="isTerminalReady"
        :terminal-panel-height="terminalPanelHeight"
        :is-terminal-panel-resize-active="isTerminalPanelResizeActive"
        :terminal-input-text="terminalInputText"
        :quick-key-grid-slots="quickKeyGridSlots"
        :last-prompt="lastPrompt"
        :set-terminal-container="setTerminalContainer"
        :set-terminal-input-textarea="setTerminalInputTextarea"
        :execute-toolbar-action="executeToolbarAction"
        :open-toolbar-config-editor="openToolbarConfigEditor"
        :focus-terminal="focusTerminal"
        :handle-terminal-context-menu="handleTerminalContextMenu"
        :handle-terminal-aux-click="handleTerminalAuxClick"
        :handle-terminal-panel-resize-pointer-down="handleTerminalPanelResizePointerDown"
        :set-terminal-input-text="setTerminalInputText"
        :handle-textarea-keydown="handleTextareaKeydown"
        :handle-textarea-input="handleTextareaInput"
        :handle-textarea-paste="handleTextareaPaste"
        :send-textarea-to-terminal="sendTextareaToTerminal"
        :handle-prompt-suffix-toggle="handlePromptSuffixToggle"
        :open-prompt-suffix-config-editor="openPromptSuffixConfigEditor"
        :send-quick-key="sendQuickKey"
      />

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
import { type ComponentPublicInstance } from "vue";
import { type PromptSuffixConfig } from "../types/prompt-suffix";
import { type ProjectSettings } from "../types/project-settings";
import { type ToolbarAction, type ToolbarConfig } from "../types/toolbar";
import {
  type AppTab,
  type HiddenPanelId,
  type HiddenPanelOption
} from "../app/use-app-navigation";
import AgentPanel from "./AgentPanel.vue";
import ChangesPanel from "./ChangesPanel.vue";
import FileContentViewer from "./FileContentViewer.vue";
import FileManagerPanel from "./FileManagerPanel.vue";
import GitGraphPanel from "./GitGraphPanel.vue";
import MainPanelHeader from "./MainPanelHeader.vue";
import ProjectSettingsEditor from "./ProjectSettingsEditor.vue";
import PromptSuffixConfigEditor from "./PromptSuffixConfigEditor.vue";
import ToolbarConfigEditor from "./ToolbarConfigEditor.vue";

defineProps<{
  projectPath: string;
  settingsDirectoryName: string;
  toolbarConfigFilename: string;
  promptSuffixConfigFilename: string;
  projectSettingsFilename: string;
  errorMessage: string;
  activeTab: AppTab;
  isOpening: boolean;
  isProjectDropdownOpen: boolean;
  isHiddenPanelsDropdownOpen: boolean;
  hiddenPanelOptions: HiddenPanelOption[];
  recentProjects: string[];
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
  openProjectSettings: () => void;
  toolbarConfig: ToolbarConfig;
  promptSuffixConfig: PromptSuffixConfig;
  projectSettings: ProjectSettings;
  isToolbarConfigEditorOpen: boolean;
  isPromptSuffixConfigEditorOpen: boolean;
  isProjectSettingsEditorOpen: boolean;
  handleToolbarConfigSave: (config: ToolbarConfig) => void;
  handlePromptSuffixConfigSave: (config: PromptSuffixConfig) => void;
  handleProjectSettingsSave: (settings: ProjectSettings) => void;
  closeToolbarConfigEditor: () => void;
  closePromptSuffixConfigEditor: () => void;
  closeProjectSettingsEditor: () => void;
  isTerminalReady: boolean;
  terminalPanelHeight: number;
  isTerminalPanelResizeActive: boolean;
  terminalInputText: string;
  quickKeyGridSlots: Array<QuickKeyBinding | null>;
  lastPrompt: string | undefined;
  setTerminalContainer: (element: Element | ComponentPublicInstance | null) => void;
  setTerminalInputTextarea: (element: Element | ComponentPublicInstance | null) => void;
  executeToolbarAction: (action: ToolbarAction) => void;
  openToolbarConfigEditor: () => void;
  focusTerminal: () => void;
  handleTerminalContextMenu: (event: MouseEvent) => void;
  handleTerminalAuxClick: (event: MouseEvent) => void;
  handleTerminalPanelResizePointerDown: (event: PointerEvent) => void;
  setTerminalInputText: (value: string) => void;
  handleTextareaKeydown: (event: KeyboardEvent) => void;
  handleTextareaInput: (event: Event) => void;
  handleTextareaPaste: (event: ClipboardEvent) => void;
  sendTextareaToTerminal: () => void;
  handlePromptSuffixToggle: (index: number) => void;
  openPromptSuffixConfigEditor: () => void;
  sendQuickKey: (data: string) => void;
  filesDisplayPath: string | null;
  fileTreeRevealPath: string | null;
  fileTreeRevealRequestToken: number;
  handleFileSelect: (path: string, options?: { targetLine?: number }) => void;
  selectedFilePath: string | null;
  selectedFileTargetLine: number | null;
  selectedFileTargetRequestToken: number;
  changesSelectedFilePath: string | null;
  handleChangesFileSelect: (path: string) => void;
  handleChangesPathOpen: (path: string) => void;
}>();
</script>
