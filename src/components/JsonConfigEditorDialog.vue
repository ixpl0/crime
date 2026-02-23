<template>
  <dialog ref="dialogElement" class="modal" @close="$emit('close')">
    <div class="modal-box max-w-3xl">
      <div class="flex items-baseline gap-2">
        <h3 class="text-lg font-bold">{{ title }}</h3>
        <span class="font-mono text-xs text-base-content/50 truncate">{{ filePath }}</span>
      </div>

      <p v-if="description" class="mt-2 text-sm text-base-content/70">
        {{ description }}
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
        <span>{{ validJsonMessage }}</span>
      </div>

      <div class="modal-action">
        <button class="btn btn-ghost" @click="resetToDefault">{{ resetLabel }}</button>
        <div class="flex-1" />
        <button class="btn" @click="$emit('close')">{{ cancelLabel }}</button>
        <button class="btn btn-primary" :disabled="!!validationError || !isDirty" @click="save">
          {{ saveLabel }}
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

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    description?: string;
    filePath: string;
    currentValue: unknown;
    defaultValue: unknown;
    parser: (value: unknown) => object | null;
    invalidStructureMessage: string;
    invalidJsonMessage?: string;
    validJsonMessage?: string;
    resetLabel?: string;
    cancelLabel?: string;
    saveLabel?: string;
  }>(),
  {
    description: "",
    invalidJsonMessage: "Invalid JSON",
    validJsonMessage: "JSON is valid",
    resetLabel: "Reset",
    cancelLabel: "Cancel",
    saveLabel: "Save"
  }
);

const emit = defineEmits<{
  save: [value: object];
  close: [];
}>();

const dialogElement = ref<HTMLDialogElement | null>(null);
const jsonText = ref("");
const validationError = ref("");
const isDirty = ref(false);

function initializeText() {
  jsonText.value = JSON.stringify(props.currentValue, null, 2);
  validationError.value = "";
  isDirty.value = false;
}

function parseCurrentJsonText() {
  try {
    const parsed: unknown = JSON.parse(jsonText.value);
    const nextValue = props.parser(parsed);
    if (nextValue === null) {
      validationError.value = props.invalidStructureMessage;
      return null;
    }

    validationError.value = "";
    return nextValue;
  } catch {
    validationError.value = props.invalidJsonMessage;
    return null;
  }
}

function validateJson() {
  isDirty.value = true;
  parseCurrentJsonText();
}

function save() {
  const parsedValue = parseCurrentJsonText();
  if (parsedValue === null) {
    return;
  }

  emit("save", parsedValue);
}

function resetToDefault() {
  jsonText.value = JSON.stringify(props.defaultValue, null, 2);
  validationError.value = "";
  isDirty.value = true;
}

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
