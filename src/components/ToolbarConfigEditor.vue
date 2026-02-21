<template>
  <dialog ref="dialogElement" class="modal" @close="$emit('close')">
    <div class="modal-box max-w-3xl">
      <h3 class="text-lg font-bold">Настройки панели инструментов</h3>

      <div class="form-control mt-4">
        <textarea
          v-model="jsonText"
          class="textarea textarea-bordered font-mono text-sm h-96 w-full resize-y"
          spellcheck="false"
          @input="validateJson"
        />
      </div>

      <div v-if="validationError" class="alert alert-error mt-2 text-sm">
        <span>{{ validationError }}</span>
      </div>

      <div v-if="!validationError && isDirty" class="alert alert-success mt-2 text-sm">
        <span>JSON валиден</span>
      </div>

      <div class="modal-action">
        <button class="btn btn-ghost" @click="resetToDefault">
          Сбросить
        </button>
        <div class="flex-1" />
        <button class="btn" @click="$emit('close')">
          Отмена
        </button>
        <button
          class="btn btn-primary"
          :disabled="!!validationError || !isDirty"
          @click="save"
        >
          Сохранить
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { type ToolbarConfig } from "../types/toolbar";
import { parseToolbarConfig } from "../toolbar/toolbar-storage";
import { defaultToolbarConfig } from "../toolbar/default-toolbar-config";

const props = defineProps<{
  currentConfig: ToolbarConfig;
  open: boolean;
}>();

const emit = defineEmits<{
  save: [config: ToolbarConfig];
  close: [];
}>();

const dialogElement = ref<HTMLDialogElement | null>(null);
const jsonText = ref("");
const validationError = ref("");
const isDirty = ref(false);

const initializeText = () => {
  jsonText.value = JSON.stringify(props.currentConfig, null, 2);
  validationError.value = "";
  isDirty.value = false;
};

const validateJson = () => {
  isDirty.value = true;

  try {
    const parsed: unknown = JSON.parse(jsonText.value);
    const config = parseToolbarConfig(parsed);
    if (!config) {
      validationError.value = "Невалидная структура конфигурации";
      return;
    }
    validationError.value = "";
  } catch {
    validationError.value = "Невалидный JSON";
  }
};

const save = () => {
  try {
    const parsed: unknown = JSON.parse(jsonText.value);
    const config = parseToolbarConfig(parsed);
    if (config) {
      emit("save", config);
    }
  } catch {
    validationError.value = "Невалидный JSON";
  }
};

const resetToDefault = () => {
  jsonText.value = JSON.stringify(defaultToolbarConfig, null, 2);
  validationError.value = "";
  isDirty.value = true;
};

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    initializeText();
    dialogElement.value?.showModal();
  } else {
    dialogElement.value?.close();
  }
});

onMounted(() => {
  if (props.open) {
    initializeText();
    dialogElement.value?.showModal();
  }
});
</script>
