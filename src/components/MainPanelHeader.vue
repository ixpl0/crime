<template>
  <div role="tablist" class="tabs tabs-bordered tabs-sm flex-wrap gap-y-1">
      <template v-if="isAgentDetached">
        <span role="tab" class="tab tab-active">Агент</span>
      </template>
      <template v-else>
        <button
          role="tab"
          class="tab"
          tabindex="-1"
          :class="{ 'tab-active': activeTab === 'agent' }"
          @click="setActiveTab('agent')"
        >
          Агент
        </button>
        <button
          role="tab"
          class="tab"
          tabindex="-1"
          :class="{ 'tab-active': activeTab === 'terminal' }"
          @click="setActiveTab('terminal')"
        >
          Терминал
          <span v-if="terminalSessionCount > 0" class="badge badge-xs badge-secondary ml-1">{{ terminalSessionCount }}</span>
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
      </template>
      <button
        type="button"
        role="tab"
        class="tab"
        tabindex="-1"
        title="Секреты проекта (.env)"
        @click="openSecretsEditor"
      >
        Секреты
      </button>

      <div
        class="dropdown dropdown-bottom manual-dropdown"
        :class="{ 'dropdown-open': isProjectDropdownOpen }"
      >
        <button
          type="button"
          role="tab"
          class="tab"
          tabindex="-1"
          :aria-expanded="isProjectDropdownOpen"
          @click="handleProjectDropdownClick"
          @keydown="handleProjectDropdownKeydown"
        >
          Проект
          <ChevronDown :size="14" class="ml-1" />
        </button>
        <ul
          class="dropdown-content menu bg-base-100 rounded-box z-10 w-72 p-0 shadow"
          @keydown.esc.stop.prevent="setProjectDropdownOpen(false)"
        >
          <li class="relative">
            <button
              :disabled="isOpening"
              tabindex="-1"
              class="pr-9"
              @click="openProjectFolder"
            >
              Открыть...
            </button>
            <button
              tabindex="-1"
              class="icon-btn absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-base-content/30 hover:text-primary"
              title="Открыть в новом окне"
              @click.stop="openProjectFolderInNewWindow"
            >
              <ExternalLink :size="14" />
            </button>
          </li>
          <li class="relative">
            <button
              :disabled="isOpening"
              tabindex="-1"
              class="pr-9"
              @click="createProjectFolder"
            >
              <FolderPlus :size="14" />
              Создать...
            </button>
            <button
              tabindex="-1"
              class="icon-btn absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-base-content/30 hover:text-primary"
              title="Создать в новом окне"
              @click.stop="createProjectInNewWindow"
            >
              <ExternalLink :size="14" />
            </button>
          </li>
          <li>
            <button
              tabindex="-1"
              @click="closeProject"
            >
              Закрыть проект
            </button>
          </li>
          <template v-if="recentProjects.length > 0">
            <div class="divider my-0"></div>
            <li v-for="recent in recentProjects" :key="recent" class="relative">
              <button
                :disabled="isOpening"
                tabindex="-1"
                class="flex flex-col items-start gap-0 py-2 pr-16"
                @click="openRecentProject(recent)"
              >
                <span class="font-medium text-base-content">{{ getProjectNameFromPath(recent) }}</span>
                <span class="w-full truncate text-[10px] opacity-50" :title="recent">{{ recent }}</span>
              </button>
              <button
                tabindex="-1"
                class="icon-btn absolute right-8 top-1/2 -translate-y-1/2 p-1.5 text-base-content/30 hover:text-error"
                title="Убрать из списка"
                @click.stop="removeRecentProject(recent)"
              >
                <X :size="14" />
              </button>
              <button
                tabindex="-1"
                class="icon-btn absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-base-content/30 hover:text-primary"
                title="Открыть в новом окне"
                @click.stop="openProjectInNewWindow(recent)"
              >
                <ExternalLink :size="14" />
              </button>
            </li>
          </template>
        </ul>
      </div>

    <div
      v-if="hiddenPanelOptions.length > 0"
      class="dropdown dropdown-end manual-dropdown ml-4"
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

    <button
      class="icon-btn ml-2 text-base-content/40 hover:text-accent"
      tabindex="-1"
      title="Поиск файлов"
      @click="openSearchDialog()"
    >
      <Search :size="16" />
    </button>

    <button
      class="icon-btn ml-2 text-base-content/40 hover:text-warning"
      tabindex="-1"
      :title="currentTheme === 'light' ? 'Тёмная тема' : 'Светлая тема'"
      @click="toggleTheme"
    >
      <Sun v-if="currentTheme === 'dark'" :size="16" />
      <Moon v-else :size="16" />
    </button>

    <button
      class="icon-btn ml-2 text-base-content/40 hover:text-info"
      tabindex="-1"
      title="Настройки проекта"
      @click="openProjectSettings"
    >
      <Settings :size="16" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { ChevronDown, ExternalLink, Eye, FolderPlus, Moon, PanelRightOpen, Search, Settings, Sun, X } from "lucide-vue-next";
import { useSearchDialogStore } from "../search/search-dialog-store";
import { useAppConfigStore } from "../config/config-store";
import { useAppNavigationStore } from "../navigation/navigation-store";
import { useTheme } from "../composables/use-theme";
import { positionFixedDropdown } from "../utils/dropdown-utils";

defineProps<{
  changesCount: number;
  terminalSessionCount: number;
}>();

const { currentTheme, toggleTheme } = useTheme();
const { openSearchDialog } = useSearchDialogStore();

const {
  activeTab,
  isAgentDetached,
  isOpening,
  isProjectDropdownOpen,
  isHiddenPanelsDropdownOpen,
  hiddenPanelOptions,
  recentProjects,
  getProjectNameFromPath,
  setActiveTab,
  detachAgent,
  toggleProjectDropdown,
  handleProjectDropdownTriggerKeydown,
  setProjectDropdownOpen,
  openProjectFolder,
  openProjectFolderInNewWindow,
  createProjectFolder,
  createProjectInNewWindow,
  closeProject,
  openRecentProject,
  removeRecentProject,
  openProjectInNewWindow,
  toggleHiddenPanelsDropdown,
  handleHiddenPanelsDropdownTriggerKeydown,
  setHiddenPanelsDropdownOpen,
  showHiddenPanel
} = useAppNavigationStore();
const {
  openProjectSettingsEditor: openProjectSettings,
  openSecretsEditor
} = useAppConfigStore();

const handleProjectDropdownClick = (event: MouseEvent) => {
  toggleProjectDropdown();
  if (isProjectDropdownOpen.value) {
    positionFixedDropdown(event.currentTarget);
  }
};

const handleProjectDropdownKeydown = (event: KeyboardEvent) => {
  handleProjectDropdownTriggerKeydown(event);
  if (isProjectDropdownOpen.value) {
    positionFixedDropdown(event.currentTarget);
  }
};

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
