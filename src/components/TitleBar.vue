<template>
  <div v-if="projectPath" class="flex flex-1 items-center gap-3 pl-3 text-xs text-base-content/60">
    <div
      class="dropdown dropdown-bottom manual-dropdown"
      :class="{ 'dropdown-open': isProjectDropdownOpen }"
    >
      <button
        ref="dropdownTriggerRef"
        type="button"
        class="cursor-pointer rounded-md border border-transparent px-2 py-0.5 font-medium text-base-content transition-colors hover:brightness-110"
        :style="projectNameStyle"
        tabindex="-1"
        :aria-expanded="isProjectDropdownOpen"
        :title="isAutoColor ? 'Авто-цвет по имени (ПКМ — изменить)' : 'ПКМ — изменить цвет'"
        @click="handleProjectDropdownClick"
        @keydown="handleProjectDropdownKeydown"
        @contextmenu="openColorMenuAt"
      >{{ projectName }}</button>
    </div>
    <Teleport to="body">
      <div
        v-if="colorMenu"
        ref="colorMenuElement"
        class="fixed z-50 flex flex-col gap-2 rounded-box border border-base-300 bg-base-100 p-2 shadow-xl"
        :style="{ left: `${String(colorMenu.x)}px`, top: `${String(colorMenu.y)}px` }"
        @mousedown.stop
        @contextmenu.prevent
      >
        <button
          type="button"
          class="flex items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-base-200"
          tabindex="-1"
          @click="handleSelectAutoColor"
        >
          <span
            class="h-4 w-4 shrink-0 rounded-full border border-base-300"
            :style="{ backgroundColor: autoColor }"
          />
          <span class="flex-1 text-left">Авто по имени</span>
          <Check v-if="isAutoColor" :size="12" class="text-base-content/70" />
        </button>
        <div class="grid grid-cols-4 gap-1.5">
          <button
            v-for="preset in PROJECT_COLOR_PRESETS"
            :key="preset"
            type="button"
            class="relative h-6 w-6 cursor-pointer rounded-full border-2 transition-transform hover:scale-110"
            :class="storedColor === preset ? 'border-base-content' : 'border-base-300/60'"
            :style="{ backgroundColor: `var(--color-${preset})` }"
            :title="preset"
            tabindex="-1"
            @click="handleSelectPreset(preset)"
          />
        </div>
        <div class="border-t border-base-300" />
        <button
          type="button"
          class="flex items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-base-200"
          tabindex="-1"
          @click="handleOpenSettingsForCustomColor"
        >
          <Settings :size="12" />
          <span>Свой цвет в настройках...</span>
        </button>
      </div>
    </Teleport>
    <Teleport to="body">
      <ul
        v-show="isProjectDropdownOpen"
        ref="dropdownContentRef"
        class="menu bg-base-100 rounded-box z-10 w-72 p-0 shadow"
        @mousedown.stop
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
    </Teleport>

    <div class="ml-1 flex items-center gap-2">
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
        class="icon-btn text-base-content/40"
        :class="isSoundEnabled ? 'hover:text-success' : 'hover:text-error'"
        tabindex="-1"
        :title="isSoundEnabled ? 'Звук оповещений включён' : 'Звук оповещений выключен'"
        @click="toggleSound"
      >
        <span class="relative inline-flex">
          <Music :size="14" />
          <template v-if="!isSoundEnabled">
            <span class="pointer-events-none absolute left-1/2 top-1/2 h-[3px] w-[19px] -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-base-100" />
            <span class="pointer-events-none absolute left-1/2 top-1/2 h-[1.5px] w-[19px] -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-current" />
          </template>
        </span>
      </button>
      <button
        class="icon-btn text-base-content/40 hover:text-primary"
        tabindex="-1"
        title="Секреты проекта (.env)"
        @click="openSecretsEditor"
      >
        <KeyRound :size="14" />
      </button>
      <PanelVisibilityMenu />
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
import { computed, ref } from "vue";
import { Check, ExternalLink, FolderPlus, KeyRound, Moon, Music, Settings, Sun, X } from "lucide-vue-next";
import PanelVisibilityMenu from "./PanelVisibilityMenu.vue";
import { useAppNavigationStore } from "../navigation/navigation-store";
import { useTheme } from "../composables/use-theme";
import { useSoundSettings } from "../composables/use-sound-settings";
import { useAppConfigStore } from "../config/config-store";
import { PROJECT_COLOR_PRESETS, useProjectColorMenu } from "../composables/use-project-color-menu";

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
  openProjectInNewWindow
} = useAppNavigationStore();
const { currentTheme, toggleTheme } = useTheme();
const { isSoundEnabled, toggleSound } = useSoundSettings();
const {
  openProjectSettingsEditor: openProjectSettings,
  openSecretsEditor,
  projectSettings,
  handleProjectSettingsSave
} = useAppConfigStore();

const dropdownTriggerRef = ref<HTMLElement | null>(null);
const dropdownContentRef = ref<HTMLElement | null>(null);

const projectName = computed(() => {
  const path = projectPath.value;
  if (!path) {
    return "";
  }
  return path.split(/[\\/]/).pop() ?? path;
});

const {
  colorMenu,
  colorMenuElement,
  storedColor,
  isAutoColor,
  autoColor,
  projectNameStyle,
  openColorMenuAt,
  handleSelectAutoColor,
  handleSelectPreset,
  handleOpenSettingsForCustomColor
} = useProjectColorMenu({
  projectName,
  projectSettings,
  saveProjectSettings: handleProjectSettingsSave,
  closeProjectDropdown: () => { setProjectDropdownOpen(false); },
  openSettingsEditor: openProjectSettings
});

const positionDropdownContent = () => {
  const trigger = dropdownTriggerRef.value;
  const content = dropdownContentRef.value;
  if (!trigger || !content) {
    return;
  }
  const rect = trigger.getBoundingClientRect();
  content.style.position = "fixed";
  content.style.top = `${String(rect.bottom)}px`;
  content.style.left = `${String(rect.left)}px`;
};

const handleProjectDropdownClick = () => {
  toggleProjectDropdown();
  if (isProjectDropdownOpen.value) {
    positionDropdownContent();
  }
};

const handleProjectDropdownKeydown = (event: KeyboardEvent) => {
  handleProjectDropdownTriggerKeydown(event);
  if (isProjectDropdownOpen.value) {
    positionDropdownContent();
  }
};
</script>
