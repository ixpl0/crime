<template>
  <main class="min-h-screen bg-base-200 p-6 text-base-content">
    <section class="mx-auto max-w-3xl space-y-6">
      <div class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <h1 class="card-title text-3xl">Dream IDE</h1>
          <p class="opacity-80">Выберите папку, чтобы открыть её как проект.</p>
          <div class="card-actions justify-end">
            <button
              class="btn btn-primary"
              :class="{ loading: isOpening }"
              :disabled="isOpening"
              @click="openProjectFolder"
            >
              {{ isOpening ? "Открываем..." : "Открыть папку" }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="projectPath" class="alert alert-success">
        <span>Проект открыт: <code>{{ projectPath }}</code></span>
      </div>

      <div v-else class="alert alert-info">
        <span>Папка проекта пока не выбрана.</span>
      </div>

      <div v-if="errorMessage" class="alert alert-error">
        <span>{{ errorMessage }}</span>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref } from "vue";

const isOpening = ref(false);
const projectPath = ref<string | null>(null);
const errorMessage = ref("");

async function openProjectFolder() {
  isOpening.value = true;
  errorMessage.value = "";

  try {
    const selectedPath = await window.projectApi.openFolder();
    if (selectedPath) {
      projectPath.value = selectedPath;
    }
  } catch (error) {
    errorMessage.value = "Не удалось открыть окно выбора папки.";
    console.error(error);
  } finally {
    isOpening.value = false;
  }
}

</script>
