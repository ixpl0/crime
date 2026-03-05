<template>
  <div class="flex items-center gap-2">
    <div role="tablist" class="tabs tabs-bordered">
      <template v-if="isAgentDetached">
        <span class="tab tab-active">Агент</span>
        <button
          type="button"
          class="tab px-1"
          tabindex="-1"
          title="Вернуть во вкладку"
          @click="dockAgent"
        >
          <PanelLeftClose :size="14" />
        </button>
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
          type="button"
          class="tab px-1"
          tabindex="-1"
          title="Открепить вкладки в отдельную панель"
          @click="detachAgent"
        >
          <PanelRightOpen :size="14" />
        </button>
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
      </template>
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
          @click="toggleProjectDropdown"
          @keydown="handleProjectDropdownTriggerKeydown"
        >
          &#1055;&#1088;&#1086;&#1077;&#1082;&#1090;
          <ChevronDown :size="14" class="ml-1" />
        </button>
        <ul
          class="dropdown-content menu bg-base-100 rounded-box z-10 w-72 p-0 shadow"
          @keydown.esc.stop.prevent="setProjectDropdownOpen(false)"
        >
          <li>
            <button
              :disabled="isOpening"
              tabindex="-1"
              @click="openProjectFolder"
            >
              &#1054;&#1090;&#1082;&#1088;&#1099;&#1090;&#1100;...
            </button>
          </li>
          <template v-if="recentProjects.length > 0">
            <div class="divider my-0"></div>
            <li v-for="recent in recentProjects" :key="recent">
              <button
                :disabled="isOpening"
                tabindex="-1"
                class="flex flex-col items-start gap-0 py-2"
                @click="openRecentProject(recent)"
              >
                <span class="font-medium text-base-content">{{ getProjectNameFromPath(recent) }}</span>
                <span class="w-full truncate text-[10px] opacity-50" :title="recent">{{ recent }}</span>
              </button>
            </li>
          </template>
        </ul>
      </div>

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
    </div>

    <div
      v-if="hiddenPanelOptions.length > 0"
      class="dropdown dropdown-end manual-dropdown"
      :class="{ 'dropdown-open': isHiddenPanelsDropdownOpen }"
    >
      <button
        type="button"
        class="btn btn-sm btn-ghost"
        tabindex="-1"
        :aria-expanded="isHiddenPanelsDropdownOpen"
        title="&#1055;&#1086;&#1082;&#1072;&#1079;&#1072;&#1090;&#1100; &#1089;&#1082;&#1088;&#1099;&#1090;&#1099;&#1077; &#1087;&#1072;&#1085;&#1077;&#1083;&#1080;"
        @click="toggleHiddenPanelsDropdown"
        @keydown="handleHiddenPanelsDropdownTriggerKeydown"
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
      class="btn btn-sm btn-ghost"
      tabindex="-1"
      :title="currentTheme === 'light' ? 'Тёмная тема' : 'Светлая тема'"
      @click="toggleTheme"
    >
      <Sun v-if="currentTheme === 'dark'" :size="16" />
      <Moon v-else :size="16" />
    </button>

    <button
      class="btn btn-sm btn-ghost"
      tabindex="-1"
      title="&#1053;&#1072;&#1089;&#1090;&#1088;&#1086;&#1081;&#1082;&#1080; &#1087;&#1088;&#1086;&#1077;&#1082;&#1090;&#1072;"
      @click="openProjectSettings"
    >
      <Settings :size="16" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { ChevronDown, Eye, Moon, PanelLeftClose, PanelRightOpen, Settings, Sun } from "lucide-vue-next";
import { useAppConfigStore } from "../config/config-store";
import { useAppNavigationStore } from "../navigation/navigation-store";
import { useTheme } from "../composables/use-theme";

defineProps<{
  changesCount: number;
}>();

const { currentTheme, toggleTheme } = useTheme();

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
  dockAgent,
  toggleProjectDropdown,
  handleProjectDropdownTriggerKeydown,
  setProjectDropdownOpen,
  openProjectFolder,
  openRecentProject,
  toggleHiddenPanelsDropdown,
  handleHiddenPanelsDropdownTriggerKeydown,
  setHiddenPanelsDropdownOpen,
  showHiddenPanel
} = useAppNavigationStore();
const {
  openProjectSettingsEditor: openProjectSettings,
  openSecretsEditor
} = useAppConfigStore();
</script>
