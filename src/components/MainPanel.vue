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

        <MainPanelHeader :changes-count="changesCount" :terminal-session-count="terminalSessionCount" :conflict-count="gitConflictCount" />

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

        <ToolbarConfigEditor
          :current-config="gitToolbarConfig"
          :config-file-path="gitToolbarConfigFilePath"
          :open="isGitToolbarConfigEditorOpen"
          title="Git Toolbar Settings"
          :default-config="defaultGitToolbarConfig"
          @save="handleGitToolbarConfigSave"
          @close="closeGitToolbarConfigEditor"
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
        <SearchDialog :project-path="projectPath" />

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

          <div v-show="activeTab === 'files'" class="min-h-0 flex-1 overflow-hidden">
            <div ref="filesContainer" class="flex h-full min-h-0 flex-row">
              <FileManagerPanel
                class="panel-w-resizable h-full min-h-0 flex-none"
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
                class="h-full min-h-0 min-w-0 flex-1"
                :project-path="projectPath"
                :file-path="selectedFilePath"
                :target-line="selectedFileTargetLine"
                :target-request-token="selectedFileTargetRequestToken"
                :refresh-token="gitStatusRefreshToken"
                :is-active="activeTab === 'files'"
                :search-request-token="inFileSearchRequestToken"
                @file-not-found="resetSelectedFile"
                @close="resetSelectedFile"
                @conflict-action="handleConflictAction"
              />
            </div>
          </div>

          <div v-show="activeTab === 'changes'" class="min-h-0 flex-1 overflow-hidden">
            <div ref="changesContainer" class="flex h-full min-h-0 flex-row">
              <ChangesPanel
                class="panel-w-resizable h-full min-h-0 flex-none"
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
                class="h-full min-h-0 min-w-0 flex-1"
                :project-path="projectPath"
                :file-path="changesSelectedFilePath"
                :refresh-token="gitStatusRefreshToken"
                :is-active="activeTab === 'changes'"
                :search-request-token="inFileSearchRequestToken"
                @file-not-found="resetChangesSelectedFile"
                @close="resetChangesSelectedFile"
                @conflict-action="handleConflictAction"
              />
            </div>
          </div>

          <div v-show="activeTab === 'git'" class="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
            <ToolbarPanel
              :toolbar-config="gitToolbarConfig"
              :is-terminal-ready="isTerminalReady"
              :pending-actions="gitSilentPendingActions"
              @execute-action="executeGitToolbarAction"
              @open-config-editor="openGitToolbarConfigEditor"
            />
            <div class="min-h-0 flex-1 overflow-y-auto">
              <GitGraphPanel :project-path="projectPath" :git-refresh-token="gitRepositoryRefreshToken" :branch-highlight-request-token="gitBranchHighlightRequestToken" :merge-state="gitMergeState" :conflict-count="gitConflictCount" @open-file="handleChangesPathOpen" />
            </div>
          </div>
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
      :changes-count="changesCount"
      :terminal-session-count="terminalSessionCount"
      :conflict-count="gitConflictCount"
    />
  </div>
</template>

<script setup lang="ts">
/* eslint-disable max-lines */
import { computed, ref, watchEffect } from "vue";
import { useAppConfigStore } from "../config/config-store";
import { useAppTerminalStore } from "../terminal/terminal-store";
import { usePanelWidthResize } from "../composables/use-panel-width-resize";
import { defaultSecretsContent } from "../settings/secrets-storage";
import { useAppNavigationStore } from "../navigation/navigation-store";
import { defaultGitToolbarConfig } from "../toolbar/git-toolbar-storage";
import { defaultTerminalToolbarConfig } from "../toolbar/terminal-toolbar-storage";
import { useGitStatus } from "../composables/use-git-status";
import { useStatusBarStore } from "../composables/status-bar-store";
import { useAppToastStore } from "../toast/toast-store";
import { useSilentToolbarCommand } from "../toolbar/use-silent-toolbar-command";
import { type ToolbarAction } from "../types/toolbar";
import AgentPanel from "./AgentPanel.vue";
import ChangesPanel from "./changes/ChangesPanel.vue";
import ConfirmDialog from "./ConfirmDialog.vue";
import PromptDialog from "./PromptDialog.vue";
import SearchDialog from "../search/SearchDialog.vue";
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
import ToolbarPanel from "./ToolbarPanel.vue";

const {
  settingsDirectoryName,
  toolbarConfigFilename,
  terminalToolbarConfigFilename,
  gitToolbarConfigFilename,
  promptSuffixConfigFilename,
  projectSettingsFilename,
  secretsFilename,
  isToolbarConfigEditorOpen,
  isTerminalToolbarConfigEditorOpen,
  isGitToolbarConfigEditorOpen,
  isPromptSuffixConfigEditorOpen,
  isProjectSettingsEditorOpen,
  isSecretsEditorOpen,
  toolbarConfig,
  terminalToolbarConfig,
  gitToolbarConfig,
  promptSuffixConfig,
  projectSettings,
  secretsConfig,
  handleToolbarConfigSave,
  handleTerminalToolbarConfigSave,
  handleGitToolbarConfigSave,
  handlePromptSuffixConfigSave,
  handleProjectSettingsSave,
  handleSecretsSave,
  closeToolbarConfigEditor,
  closeTerminalToolbarConfigEditor,
  closeGitToolbarConfigEditor,
  openGitToolbarConfigEditor,
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
  handleChangesPathOpen,
  resetSelectedFile,
  inFileSearchRequestToken,
  gitBranchHighlightRequestToken
} = navigationStore;

const { isTerminalReady, executeToolbarAction } = useAppTerminalStore();

const mainContainer = ref<HTMLElement | null>(null);
const cardBody = ref<HTMLElement | null>(null);
const nonAgentContainer = ref<HTMLElement | null>(null);
const filesContainer = ref<HTMLElement | null>(null);
const changesContainer = ref<HTMLElement | null>(null);

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

const {
  panelWidth: sidebarPanelWidth,
  panelMaxWidth: sidebarPanelMaxWidth,
  isResizeActive: isSidebarResizeActive,
  handleResizePointerDown: handleSidebarResizePointerDown
} = usePanelWidthResize({
  storageKey: "crime:sidebar-panel-width",
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

const { pendingActions: gitSilentPendingActions, runSilentCommand: runSilentGitCommand } =
  useSilentToolbarCommand({ projectPath });

const executeGitToolbarAction = (action: ToolbarAction) => {
  if (action.type === "command") {
    void runSilentGitCommand(action);
    return;
  }

  executeToolbarAction(action);
};

const changesCount = computed(() => gitStatusResponse.value?.entries?.length ?? 0);
const gitMergeState = computed<GitMergeStateKind>(() => gitStatusResponse.value?.mergeState ?? "none");
const gitConflictCount = computed(() =>
  (gitStatusResponse.value?.entries ?? []).filter((entry) => entry.status === "conflict").length
);
const terminalSessionCount = ref(0);

const statusBarStore = useStatusBarStore();
watchEffect(() => {
  const response = gitStatusResponse.value;
  statusBarStore.gitBranch.value = response?.branch ?? null;
  statusBarStore.gitChangesCount.value = response?.entries?.length ?? 0;
});

const toolbarConfigFilePath = computed(
  () => `${projectPath.value}/${settingsDirectoryName}/${toolbarConfigFilename}`
);
const terminalToolbarConfigFilePath = computed(
  () => `${projectPath.value}/${settingsDirectoryName}/${terminalToolbarConfigFilename}`
);
const gitToolbarConfigFilePath = computed(
  () => `${projectPath.value}/${settingsDirectoryName}/${gitToolbarConfigFilename}`
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

const { pushError: pushConflictError, pushToast: pushConflictToast } = useAppToastStore();

type ConflictRegionInfo = { oursStartLine: number; separatorLine: number; theirsEndLine: number };

const pickConflictReplacement = (
  lines: string[],
  region: ConflictRegionInfo,
  mode: "current" | "incoming" | "both"
): string[] => {
  const ours = lines.slice(region.oursStartLine + 1, region.separatorLine);
  const theirs = lines.slice(region.separatorLine + 1, region.theirsEndLine);
  if (mode === "current") { return ours; }
  if (mode === "incoming") { return theirs; }
  return [...ours, ...theirs];
};

const resolveConflictInFile = async (filePath: string, region: ConflictRegionInfo, mode: "current" | "incoming" | "both") => {
  const fileResponse = await window.projectApi.filesystem.readFile(projectPath.value, filePath);
  if (!fileResponse.ok || typeof fileResponse.content !== "string") { pushConflictError("Не удалось прочитать файл."); return; }
  const eol = fileResponse.content.includes("\r\n") ? "\r\n" : "\n";
  const lines = fileResponse.content.split(eol);
  // Validate conflict markers are still at expected positions (TOCTOU guard).
  // Use trimStart() to match the parser in conflict-decorations.ts
  const oursLine = (lines[region.oursStartLine] ?? "").trimStart();
  const separatorLine = (lines[region.separatorLine] ?? "").trimStart();
  const theirsLine = (lines[region.theirsEndLine] ?? "").trimStart();
  if (!oursLine.startsWith("<<<<<<<") || !separatorLine.startsWith("=======") || !theirsLine.startsWith(">>>>>>>")) {
    pushConflictError("Файл изменился — конфликтные маркеры не найдены на ожидаемых позициях.");
    return;
  }
  const replacement = pickConflictReplacement(lines, region, mode);
  const newContent = [...lines.slice(0, region.oursStartLine), ...replacement, ...lines.slice(region.theirsEndLine + 1)].join(eol);
  const writeResponse = await window.projectApi.filesystem.writeFile(projectPath.value, filePath, newContent);
  if (!writeResponse.ok) { pushConflictError("Не удалось записать файл."); return; }
  pushConflictToast("Конфликт разрешён", { tone: "success" });
  void refreshGitStatus();
};

const MODE_MAP: Partial<Record<string, "current" | "incoming" | "both">> = {
  "accept-current": "current", "accept-incoming": "incoming", "accept-both": "both"
};

const handleConflictAction = (action: string, filePath: string, region: ConflictRegionInfo) => {
  const mode = MODE_MAP[action];
  if (mode) { void resolveConflictInFile(filePath, region, mode); }
};
</script>
