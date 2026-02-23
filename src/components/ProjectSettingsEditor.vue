<template>
  <dialog ref="dialogElement" class="modal" @close="$emit('close')">
    <div class="modal-box max-w-3xl">
      <div class="flex items-baseline gap-2">
        <h3 class="text-lg font-bold">Project Settings</h3>
        <span class="font-mono text-xs text-base-content/50 truncate">{{ configFilePath }}</span>
      </div>

      <p class="mt-2 text-sm text-base-content/70">
        Configure slash-command timing for this project.
      </p>

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
        <span>JSON is valid</span>
      </div>

      <div class="modal-action">
        <button class="btn btn-ghost" @click="resetToDefault">Reset</button>
        <div class="flex-1" />
        <button class="btn" @click="$emit('close')">Cancel</button>
        <button
          class="btn btn-primary"
          :disabled="!!validationError || !isDirty"
          @click="save"
        >
          Save
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { type ProjectSettings } from "../types/project-settings";
import { defaultProjectSettings, parseProjectSettings } from "../settings/project-settings-storage";

const props = defineProps<{
  currentSettings: ProjectSettings;
  configFilePath: string;
  open: boolean;
}>();

const emit = defineEmits<{
  save: [settings: ProjectSettings];
  close: [];
}>();

const dialogElement = ref<HTMLDialogElement | null>(null);
const jsonText = ref("");
const validationError = ref("");
const isDirty = ref(false);

const initializeText = () => {
  jsonText.value = JSON.stringify(props.currentSettings, null, 2);
  validationError.value = "";
  isDirty.value = false;
};

const validateJson = () => {
  isDirty.value = true;

  try {
    const parsed: unknown = JSON.parse(jsonText.value);
    const settings = parseProjectSettings(parsed);
    if (!settings) {
      validationError.value = "Invalid settings structure";
      return;
    }

    validationError.value = "";
  } catch {
    validationError.value = "Invalid JSON";
  }
};

const save = () => {
  try {
    const parsed: unknown = JSON.parse(jsonText.value);
    const settings = parseProjectSettings(parsed);
    if (settings) {
      emit("save", settings);
    }
  } catch {
    validationError.value = "Invalid JSON";
  }
};

const resetToDefault = () => {
  jsonText.value = JSON.stringify(defaultProjectSettings, null, 2);
  validationError.value = "";
  isDirty.value = true;
};

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      initializeText();
      dialogElement.value?.showModal();
      return;
    }

    dialogElement.value?.close();
  }
);

onMounted(() => {
  if (!props.open) {
    return;
  }

  initializeText();
  dialogElement.value?.showModal();
});
</script>

