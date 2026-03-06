<template>
  <div class="card min-h-0 flex-1 overflow-hidden bg-base-100 shadow-xl">
    <div class="card-body flex min-h-0 flex-col gap-4">
      <div role="tablist" class="tabs tabs-bordered shrink-0">
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
            :git-refresh-token="gitRefreshToken"
            :refresh-git-status="refreshGitStatus"
            @select-file="handleFileSelect"
          />

          <FileContentViewer
            class="h-full min-h-0"
            :project-path="projectPath"
            :file-path="selectedFilePath"
            :target-line="selectedFileTargetLine"
            :target-request-token="selectedFileTargetRequestToken"
            :refresh-token="gitRefreshToken"
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
            :git-refresh-token="gitRefreshToken"
            :refresh-git-status="refreshGitStatus"
            @select-file="handleChangesFileSelect"
            @open-path="handleChangesPathOpen"
            @reset-selected-file="resetChangesSelectedFile"
          />

          <FileContentViewer
            class="h-full min-h-0"
            :project-path="projectPath"
            :file-path="changesSelectedFilePath"
            :refresh-token="gitRefreshToken"
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
</template>

<script setup lang="ts">
import { useAppNavigationStore } from "../navigation/navigation-store";
import ChangesPanel from "./changes/ChangesPanel.vue";
import FileContentViewer from "./FileContentViewer.vue";
import FileManagerPanel from "./file-manager/FileManagerPanel.vue";
import GitGraphPanel from "./git-graph/GitGraphPanel.vue";
import TerminalWorkspacePanel from "./TerminalWorkspacePanel.vue";

defineProps<{
  projectPath: string;
  changesCount: number;
  gitStatusResponse: GitStatusResponse | null;
  gitRefreshToken: number;
  gitRepositoryRefreshToken: number;
  refreshGitStatus: () => Promise<void>;
}>();

const {
  activeTab,
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
} = useAppNavigationStore();
</script>
