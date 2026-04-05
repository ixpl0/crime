<template>
  <div v-if="projectPath" class="flex flex-1 items-center gap-3 pl-3 text-xs text-base-content/60">
    <div
      class="dropdown dropdown-bottom manual-dropdown"
      :class="{ 'dropdown-open': isProjectDropdownOpen }"
    >
      <button
        type="button"
        class="cursor-pointer font-medium text-base-content/80 hover:text-base-content"
        tabindex="-1"
        :aria-expanded="isProjectDropdownOpen"
        @click="handleProjectDropdownClick"
        @keydown="handleProjectDropdownKeydown"
      >{{ projectName }}</button>
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

    <button
      v-if="gitBranch"
      type="button"
      class="flex cursor-pointer items-center gap-1 hover:text-base-content"
      tabindex="-1"
      title="Перейти к ветке в Git-графе"
      @click="navigateToBranch"
    >
      <GitBranch :size="12" />
      {{ gitBranch }}
    </button>
    <button
      v-if="gitChangesCount > 0"
      type="button"
      class="flex cursor-pointer items-center gap-1 text-warning hover:text-warning/80"
      tabindex="-1"
      title="Показать изменения"
      @click="setActiveTab('changes')"
    >
      <Pencil :size="11" />
      {{ gitChangesCount }}
    </button>

    <div class="ml-1 flex items-center gap-2">
      <button
        class="icon-btn text-base-content/40 hover:text-accent"
        tabindex="-1"
        title="Поиск файлов"
        @click="openSearchDialog()"
      >
        <Search :size="14" />
      </button>
      <button
        class="icon-btn text-base-content/40 hover:text-warning"
        tabindex="-1"
        :title="currentTheme === 'light' ? 'Тёмная тема' : 'Светлая тема'"
        @click="toggleTheme"
      >
        <Sun v-if="currentTheme === 'dark'" :size="14" />
        <Moon v-else :size="14" />
      </button>
      <button
        class="icon-btn text-base-content/40 hover:text-primary"
        tabindex="-1"
        title="Секреты проекта (.env)"
        @click="openSecretsEditor"
      >
        <KeyRound :size="14" />
      </button>
      <button
        class="icon-btn text-base-content/40 hover:text-info"
        tabindex="-1"
        title="Настройки проекта"
        @click="openProjectSettings"
      >
        <Settings :size="14" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { ExternalLink, FolderPlus, GitBranch, KeyRound, Moon, Pencil, Search, Settings, Sun, X } from "lucide-vue-next";
import { useStatusBarStore } from "../composables/status-bar-store";
import { useAppNavigationStore } from "../navigation/navigation-store";
import { useSearchDialogStore } from "../search/search-dialog-store";
import { useTheme } from "../composables/use-theme";
import { useAppConfigStore } from "../config/config-store";
import { positionFixedDropdown } from "../utils/dropdown-utils";

const {
  projectPath,
  isOpening,
  isProjectDropdownOpen,
  recentProjects,
  getProjectNameFromPath,
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
  navigateToBranch,
  setActiveTab
} = useAppNavigationStore();
const { gitBranch, gitChangesCount } = useStatusBarStore();
const { openSearchDialog } = useSearchDialogStore();
const { currentTheme, toggleTheme } = useTheme();
const { openProjectSettingsEditor: openProjectSettings, openSecretsEditor } = useAppConfigStore();

const projectName = computed(() => {
  const path = projectPath.value;
  if (!path) {
    return "";
  }
  return path.split(/[\\/]/).pop() ?? path;
});

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
</script>
