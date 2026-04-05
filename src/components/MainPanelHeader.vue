<template>
  <div role="tablist" class="tabs tabs-bordered tabs-sm flex-wrap gap-y-1">
      <template v-if="isAgentDetached">
        <span role="tab" class="tab tab-active gap-1"><Bot :size="14" class="text-base-content/40" /> Агент</span>
      </template>
      <template v-else>
        <button
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
          <span v-if="tab.id === 'changes' && changesCount > 0" class="badge badge-xs badge-primary ml-1">{{ changesCount }}</span>
        </button>
      </template>
    <div
      v-if="hiddenPanelOptions.length > 0"
      class="dropdown dropdown-end manual-dropdown ml-4 self-center"
      :class="{ 'dropdown-open': isHiddenPanelsDropdownOpen }"
    >
      <button
        type="button"
        class="icon-btn flex items-center gap-0.5 text-base-content/40 hover:text-info"
        tabindex="-1"
        :aria-expanded="isHiddenPanelsDropdownOpen"
        title="Показать скрытые панели"
        @click="handleHiddenPanelsDropdownClick"
        @keydown="handleHiddenPanelsDropdownKeydown"
      >
        <Eye :size="16" />
        <ChevronDown :size="14" />
      </button>
      <ul
        class="dropdown-content menu bg-base-100 rounded-box z-10 mt-1 w-56 p-1 shadow"
        @keydown.esc.stop.prevent="setHiddenPanelsDropdownOpen(false)"
      >
        <li v-for="panelOption in hiddenPanelOptions" :key="panelOption.id">
          <button
            type="button"
            tabindex="-1"
            @click="showHiddenPanel(panelOption.id)"
          >
            {{ panelOption.title }}
          </button>
        </li>
      </ul>
    </div>

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
import { Bot, ChevronDown, Eye, FolderOpen, GitCompareArrows, GitGraph, PanelRightOpen, Terminal } from "lucide-vue-next";
import { useAppNavigationStore } from "../navigation/navigation-store";
import { positionFixedDropdown } from "../utils/dropdown-utils";

const MAIN_TABS = [
  { id: "agent" as const, label: "Агент", icon: Bot },
  { id: "terminal" as const, label: "Терминал", icon: Terminal },
  { id: "files" as const, label: "Файлы", icon: FolderOpen },
  { id: "changes" as const, label: "Изменения", icon: GitCompareArrows },
  { id: "git" as const, label: "Гит", icon: GitGraph },
];

defineProps<{
  changesCount: number;
  terminalSessionCount: number;
}>();

const {
  activeTab,
  isAgentDetached,
  isHiddenPanelsDropdownOpen,
  hiddenPanelOptions,
  setActiveTab,
  detachAgent,
  toggleHiddenPanelsDropdown,
  handleHiddenPanelsDropdownTriggerKeydown,
  setHiddenPanelsDropdownOpen,
  showHiddenPanel
} = useAppNavigationStore();

const handleHiddenPanelsDropdownClick = (event: MouseEvent) => {
  toggleHiddenPanelsDropdown();
  if (isHiddenPanelsDropdownOpen.value) {
    positionFixedDropdown(event.currentTarget);
  }
};

const handleHiddenPanelsDropdownKeydown = (event: KeyboardEvent) => {
  handleHiddenPanelsDropdownTriggerKeydown(event);
  if (isHiddenPanelsDropdownOpen.value) {
    positionFixedDropdown(event.currentTarget);
  }
};
</script>
