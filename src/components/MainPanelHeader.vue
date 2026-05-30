<template>
  <div role="tablist" class="tabs tabs-bordered tabs-sm flex-wrap gap-y-1">
      <template v-if="isAgentDetached">
        <span role="tab" class="tab tab-active gap-1"><Bot :size="14" class="text-base-content/40" /> Агент</span>
      </template>
      <template v-else>
        <div
          v-for="tab in MAIN_TABS"
          :key="tab.id"
          role="tab"
          class="tab gap-1"
          tabindex="-1"
          :class="{ 'tab-active': activeTab === tab.id }"
          @click="setActiveTab(tab.id)"
        >
          <component :is="tab.icon" :size="14" class="text-base-content/40" />
          {{ tab.label }}
          <span v-if="tab.id === 'terminal' && terminalSessionCount > 0" class="badge badge-xs badge-secondary ml-1">{{ terminalSessionCount }}</span>
          <template v-if="tab.id === 'terminal' && terminalSessionCount > 0">
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
      </template>

    <button
      v-if="!isAgentDetached"
      class="icon-btn ml-2 text-base-content/40 hover:text-primary"
      tabindex="-1"
      title="Открепить вкладки в отдельную панель"
      @click="detachAgent"
    >
      <PanelRightOpen :size="16" class="rotate-180" />
    </button>

  </div>
</template>

<script setup lang="ts">
import { Bot, PanelRightOpen, RotateCw, Terminal, X } from "lucide-vue-next";
import { useAppNavigationStore } from "../navigation/navigation-store";
import { useTerminalWorkspaceActionsStore } from "../terminal/terminal-workspace-actions-store";

const MAIN_TABS = [
  { id: "agent" as const, label: "Агент", icon: Bot },
  { id: "terminal" as const, label: "Терминал", icon: Terminal },
];

defineProps<{
  terminalSessionCount: number;
}>();

const {
  activeTab,
  isAgentDetached,
  setActiveTab,
  detachAgent
} = useAppNavigationStore();

const workspaceActionsStore = useTerminalWorkspaceActionsStore();

const restartAllTerminals = () => {
  void workspaceActionsStore.value?.restartAllSessions();
};

const closeAllTerminals = () => {
  void workspaceActionsStore.value?.closeAllSessions();
};
</script>
