<template>
  <main class="h-screen overflow-hidden bg-base-200 p-6 text-base-content">
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
        class="grid min-h-0 flex-1 gap-4"
        :class="{ 'lg:grid-cols-[18rem_minmax(0,1fr)]': !isTodoPanelCollapsed }"
      >
        <TasksPanel v-if="!isTodoPanelCollapsed" />

        <MainPanel />
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import "@xterm/xterm/css/xterm.css";
import { useAppShell } from "./app/use-app-shell";
import MainPanel from "./components/MainPanel.vue";
import TasksPanel from "./components/TasksPanel.vue";

const { errorMessage, isOpening, isTodoPanelCollapsed, openProjectFolder, projectPath } =
  useAppShell();

</script>

<style scoped>
</style>
