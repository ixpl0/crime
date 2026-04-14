<template>
  <AppToastViewport />
  <main class="flex h-screen flex-col overflow-hidden bg-base-200 text-base-content" @mousedown="handleGlobalMousedown">
    <div class="app-drag-region shrink-0 overflow-hidden bg-base-100" :style="titleBarStyle">
      <div class="flex h-8 items-center" :style="titleBarInnerStyle">
        <TitleBar />
      </div>
    </div>
    <section
      class="flex min-h-0 flex-1 flex-col gap-2 p-2"
      :class="projectPath ? 'w-full' : 'mx-auto w-full max-w-5xl'"
    >

      <ProjectPicker
        v-if="isStartupReady && !projectPath"
        :recent-projects="recentProjects"
        :is-opening="isOpening"
        :get-project-name-from-path="getProjectNameFromPath"
        @open-folder="openProjectFolder"
        @create-folder="createProjectFolder"
        @open-project="openProject"
        @remove-project="removeRecentProject"
      />

      <div
        v-if="projectPath"
        ref="outerContainer"
        class="flex min-h-0 flex-1 flex-col"
        :class="{ 'flex-row': !isTodoPanelCollapsed }"
      >
        <template v-if="!isTodoPanelCollapsed">
          <div
            ref="tasksColumnContainer"
            class="flex min-h-0 flex-col panel-w-resizable"
            :style="{ '--panel-w': tasksPanelWidth + 'px', '--panel-max-w': tasksPanelMaxWidth }"
          >
            <TasksPanel class="min-h-0 flex-1" />
            <template v-if="isDebugTodoPanelVisible">
              <PanelHeightResizeHandle
                :is-active="isDebugPanelResizeActive"
                @pointerdown="handleDebugPanelResize"
              />
              <DebugTasksPanel
                class="panel-h-resizable"
                :style="{ '--panel-h': debugPanelHeight + 'px', '--panel-max-h': debugPanelMaxHeight }"
              />
            </template>
          </div>
          <PanelResizeHandle
            :is-active="isTasksPanelResizeActive"
            @pointerdown="handleTasksPanelResize"
          />
        </template>

        <MainPanel class="min-w-0" />
      </div>

      <TipBar v-if="projectPath" />
    </section>
  </main>
</template>

<script setup lang="ts">
import "@xterm/xterm/css/xterm.css";
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useAppShell } from "./app/use-app-shell";
import AppToastViewport from "./components/AppToastViewport.vue";
import { usePanelHeightResize } from "./composables/use-panel-height-resize";
import { usePanelWidthResize } from "./composables/use-panel-width-resize";
import DebugTasksPanel from "./components/DebugTasksPanel.vue";
import MainPanel from "./components/MainPanel.vue";
import PanelHeightResizeHandle from "./components/PanelHeightResizeHandle.vue";
import PanelResizeHandle from "./components/PanelResizeHandle.vue";
import ProjectPicker from "./components/ProjectPicker.vue";
import TasksPanel from "./components/TasksPanel.vue";
import TipBar from "./components/TipBar.vue";
import TitleBar from "./components/TitleBar.vue";

const TASKS_PANEL_DEFAULT_WIDTH = 288;
const DEBUG_PANEL_DEFAULT_HEIGHT = 200;

const {
  isOpening,
  isStartupReady,
  isTodoPanelCollapsed,
  isDebugTodoPanelVisible,
  projectSettings,
  recentProjects,
  getProjectNameFromPath,
  removeRecentProject,
  openProject,
  openProjectFolder,
  createProjectFolder,
  projectPath,
  acknowledgeBellReminder
} = useAppShell();

onMounted(() => {
  window.addEventListener("mousedown", acknowledgeBellReminder, true);
  window.addEventListener("mousemove", acknowledgeBellReminder, true);
  window.addEventListener("wheel", acknowledgeBellReminder, true);
  window.addEventListener("keydown", acknowledgeBellReminder, true);
  window.addEventListener("focus", acknowledgeBellReminder);
});

onUnmounted(() => {
  window.removeEventListener("mousedown", acknowledgeBellReminder, true);
  window.removeEventListener("mousemove", acknowledgeBellReminder, true);
  window.removeEventListener("wheel", acknowledgeBellReminder, true);
  window.removeEventListener("keydown", acknowledgeBellReminder, true);
  window.removeEventListener("focus", acknowledgeBellReminder);
});

const TITLE_BAR_HEIGHT_PX = 32;

const titleBarStyle = computed(() => {
  const zoom = projectSettings.value.zoom.ideZoomFactor;
  if (zoom === 1) {
    return {};
  }
  const inverseZoom = 1 / zoom;
  return {
    height: String(TITLE_BAR_HEIGHT_PX * inverseZoom) + "px",
  };
});

const titleBarInnerStyle = computed(() => {
  const zoom = projectSettings.value.zoom.ideZoomFactor;
  if (zoom === 1) {
    return {};
  }
  const inverseZoom = 1 / zoom;
  return {
    transform: "scale(" + String(inverseZoom) + ")",
    transformOrigin: "top left",
    width: String(zoom * 100) + "%",
    height: String(TITLE_BAR_HEIGHT_PX) + "px",
  };
});

const outerContainer = ref<HTMLElement | null>(null);
const tasksColumnContainer = ref<HTMLElement | null>(null);

const {
  panelWidth: tasksPanelWidth,
  panelMaxWidth: tasksPanelMaxWidth,
  isResizeActive: isTasksPanelResizeActive,
  handleResizePointerDown: handleTasksPanelResizePointerDown
} = usePanelWidthResize({
  storageKey: "crime:tasks-panel-width",
  defaultWidth: TASKS_PANEL_DEFAULT_WIDTH,
  minOppositeWidth: 400
});

const {
  panelHeight: debugPanelHeight,
  panelMaxHeight: debugPanelMaxHeight,
  isResizeActive: isDebugPanelResizeActive,
  handleResizePointerDown: handleDebugPanelResizePointerDown
} = usePanelHeightResize({
  storageKey: "crime:debug-tasks-panel-height",
  defaultHeight: DEBUG_PANEL_DEFAULT_HEIGHT,
  minHeight: 100,
  minOppositeHeight: 100
});

const handleTasksPanelResize = (event: PointerEvent) => {
  if (outerContainer.value) {
    handleTasksPanelResizePointerDown(event, outerContainer.value);
  }
};

const handleDebugPanelResize = (event: PointerEvent) => {
  if (tasksColumnContainer.value) {
    handleDebugPanelResizePointerDown(event, tasksColumnContainer.value);
  }
};

const FOCUSABLE_SELECTOR = "button, label, [tabindex], [role='tab']";

const handleGlobalMousedown = (event: MouseEvent) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement || target instanceof HTMLSelectElement) {
    return;
  }

  if (target.closest(".cm-editor")) {
    return;
  }

  const focusableElement = target.closest(FOCUSABLE_SELECTOR) ?? (target.matches(FOCUSABLE_SELECTOR) ? target : null);
  if (focusableElement && !(focusableElement instanceof HTMLElement && focusableElement.draggable)) {
    event.preventDefault();
  }
};
</script>

<style scoped>
</style>
