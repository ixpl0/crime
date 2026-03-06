<template>
  <main class="h-screen overflow-hidden bg-base-200 p-6 text-base-content" @mousedown="handleGlobalMousedown">
    <section
      class="flex h-full min-h-0 flex-col gap-6"
      :class="projectPath ? 'w-full' : 'mx-auto w-full max-w-5xl'"
    >
      <template v-if="!projectPath">
        <div class="card bg-base-100 shadow-xl">
          <div class="card-body">
            <h1 class="card-title text-3xl">Dream IDE</h1>
            <p class="opacity-80">Choose a folder to open it as a project.</p>
            <div class="card-actions justify-end">
              <button
                class="btn btn-primary"
                tabindex="-1"
                :class="{ loading: isOpening }"
                :disabled="isOpening"
                @click="openProjectFolder"
              >
                {{ isOpening ? "Opening..." : "Open Folder" }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="errorMessage" class="alert alert-error">
          <span>{{ errorMessage }}</span>
        </div>
      </template>

      <div
        v-if="projectPath"
        ref="outerContainer"
        class="flex min-h-0 flex-1 flex-col gap-4"
        :class="{ 'lg:flex-row lg:gap-0': !isTodoPanelCollapsed }"
      >
        <template v-if="!isTodoPanelCollapsed">
          <TasksPanel
            class="panel-w-resizable"
            :style="{ '--panel-w': tasksPanelWidth + 'px', '--panel-max-w': tasksPanelMaxWidth }"
          />
          <PanelResizeHandle
            :is-active="isTasksPanelResizeActive"
            @pointerdown="handleTasksPanelResize"
          />
        </template>

        <MainPanel class="min-w-0" />
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import "@xterm/xterm/css/xterm.css";
import { ref } from "vue";
import { useAppShell } from "./app/use-app-shell";
import { usePanelWidthResize } from "./composables/use-panel-width-resize";
import MainPanel from "./components/MainPanel.vue";
import PanelResizeHandle from "./components/PanelResizeHandle.vue";
import TasksPanel from "./components/TasksPanel.vue";

const TASKS_PANEL_DEFAULT_WIDTH = 288;

const { errorMessage, isOpening, isTodoPanelCollapsed, openProjectFolder, projectPath } =
  useAppShell();

const outerContainer = ref<HTMLElement | null>(null);

const {
  panelWidth: tasksPanelWidth,
  panelMaxWidth: tasksPanelMaxWidth,
  isResizeActive: isTasksPanelResizeActive,
  handleResizePointerDown: handleTasksPanelResizePointerDown
} = usePanelWidthResize({
  storageKey: "dream-ide:tasks-panel-width",
  defaultWidth: TASKS_PANEL_DEFAULT_WIDTH,
  minOppositeWidth: 400
});

const handleTasksPanelResize = (event: PointerEvent) => {
  if (outerContainer.value) {
    handleTasksPanelResizePointerDown(event, outerContainer.value);
  }
};

const FOCUSABLE_SELECTOR = "button, label, [tabindex], [role='tab']";

const handleGlobalMousedown = (event: MouseEvent) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
    return;
  }

  if (target.closest(".cm-editor")) {
    return;
  }

  if (target.closest(FOCUSABLE_SELECTOR) || target.matches(FOCUSABLE_SELECTOR)) {
    event.preventDefault();
  }
};
</script>

<style scoped>
</style>
