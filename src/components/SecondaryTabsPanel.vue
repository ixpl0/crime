<template>
  <div class="card min-h-0 flex-1 overflow-hidden bg-base-100 shadow-sm">
    <div class="card-body flex min-h-0 flex-col gap-2 p-3">
      <div role="tablist" class="tabs tabs-bordered tabs-sm shrink-0 flex-wrap">
        <button
          type="button"
          class="icon-btn mr-2 text-base-content/40 hover:text-primary"
          tabindex="-1"
          title="Вернуть во вкладку"
          @click="dockAgent"
        >
          <PanelLeftClose :size="16" />
        </button>
        <div
            role="tab"
            class="tab gap-1"
            tabindex="-1"
            :class="{ 'tab-active': activeTab === 'terminal' }"
            @click="setActiveTab('terminal')"
          >
            <Terminal :size="14" class="text-base-content/40" />
            Терминал
            <span v-if="terminalSessionCount > 0" class="badge badge-xs badge-secondary ml-1">{{ terminalSessionCount }}</span>
            <template v-if="terminalSessionCount > 0">
              <button
                type="button"
                class="icon-btn ml-1 text-base-content/40 hover:text-primary"
                tabindex="-1"
                title="Перезапустить все терминалы"
                @click.stop="restartAllTerminals"
              >
                <RotateCw :size="14" />
              </button>
              <button
                type="button"
                class="icon-btn text-base-content/40 hover:text-error"
                tabindex="-1"
                title="Закрыть все терминалы"
                @click.stop="closeAllTerminals"
              >
                <X :size="14" />
              </button>
            </template>
          </div>
          <button
            role="tab"
            class="tab gap-1"
            tabindex="-1"
            :class="{ 'tab-active': activeTab === 'files' }"
            @click="setActiveTab('files')"
          >
            <FolderOpen :size="14" class="text-base-content/40" />
            Файлы
          </button>
          <button
            role="tab"
            class="tab gap-1"
            tabindex="-1"
            :class="{ 'tab-active': activeTab === 'changes' }"
            @click="setActiveTab('changes')"
          >
            <GitCompareArrows :size="14" class="text-base-content/40" />
            Изменения
            <span v-if="changesCount > 0" class="badge badge-xs badge-primary ml-1">{{ changesCount }}</span>
          </button>
          <button
            role="tab"
            class="tab gap-1"
            tabindex="-1"
            :class="{ 'tab-active': activeTab === 'git' }"
            @click="setActiveTab('git')"
          >
            <GitGraph :size="14" class="text-base-content/40" />
            Гит
            <span v-if="conflictCount > 0" class="badge badge-xs badge-warning ml-1">{{ conflictCount }}</span>
          </button>
      </div>

      <!-- Teleport target: non-agent tab content is teleported here when detached -->
      <div id="secondary-tabs-content" class="flex min-h-0 flex-1 flex-col gap-2" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { FolderOpen, GitCompareArrows, GitGraph, PanelLeftClose, RotateCw, Terminal, X } from "lucide-vue-next";
import { useAppNavigationStore } from "../navigation/navigation-store";
import { useTerminalWorkspaceActionsStore } from "../terminal/terminal-workspace-actions-store";

defineProps<{
  changesCount: number;
  terminalSessionCount: number;
  conflictCount: number;
}>();

const { activeTab, setActiveTab, dockAgent } = useAppNavigationStore();
const workspaceActionsStore = useTerminalWorkspaceActionsStore();

const restartAllTerminals = () => {
  void workspaceActionsStore.value?.restartAllSessions();
};

const closeAllTerminals = () => {
  void workspaceActionsStore.value?.closeAllSessions();
};
</script>
