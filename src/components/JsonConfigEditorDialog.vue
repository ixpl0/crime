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

      <!-- Mode tabs (only when visual slot exists) -->
      <div v-if="hasVisualSlot" role="tablist" class="tabs tabs-bordered mt-4">
        <button
          role="tab"
          class="tab"
          :class="{ 'tab-active': editorMode === 'visual' }"
          tabindex="-1"
          @click="switchToVisual"
        >
          Визуально
        </button>
        <button
          role="tab"
          class="tab"
          :class="{ 'tab-active': editorMode === 'json' }"
          tabindex="-1"
          @click="switchToJson"
        >
          JSON
        </button>
      </div>

      <!-- Visual editor (slot) -->
      <div v-if="hasVisualSlot && editorMode === 'visual' && visualModel" class="mt-4 max-h-96 overflow-y-auto pr-1">
        <slot name="visual" :model="visualModel" :on-update="handleVisualUpdate" />
      </div>

      <!-- JSON editor (textarea) -->
      <div v-if="!hasVisualSlot || editorMode === 'json'" class="form-control mt-4">
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

      <div v-if="!validationError && isDirty && editorMode === 'json'" class="alert alert-success mt-2 text-sm">
        <span>{{ validJsonMessage }}</span>
      </div>

      <div class="modal-action">
        <button class="btn btn-ghost" tabindex="-1" @click="resetToDefault">{{ resetLabel }}</button>
        <div class="flex-1" />
        <button class="btn" tabindex="-1" @click="$emit('close')">{{ cancelLabel }}</button>
        <button class="btn btn-primary" tabindex="-1" :disabled="!!validationError || !isDirty" @click="save">
          {{ saveLabel }}
        </button>
      </div>
    </div>

    <form method="dialog" class="modal-backdrop">
      <button tabindex="-1">close</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, useSlots, watch } from "vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    description?: string;
    filePath: string;
    currentValue: unknown;
    defaultValue: unknown;
    parser: (value: unknown) => object | null;
    serializer?: (value: unknown) => unknown;
    invalidStructureMessage: string;
    invalidJsonMessage?: string;
    validJsonMessage?: string;
    resetLabel?: string;
    cancelLabel?: string;
    saveLabel?: string;
  }>(),
  {
    description: "",
    serializer: undefined,
    invalidJsonMessage: "Некорректный JSON",
    validJsonMessage: "JSON корректен",
    resetLabel: "Сброс",
    cancelLabel: "Отмена",
    saveLabel: "Сохранить"
  }
);

const emit = defineEmits<{
  save: [value: object];
  close: [];
}>();

const slots = useSlots();
const hasVisualSlot = computed(() => !!slots.visual);

const dialogElement = ref<HTMLDialogElement | null>(null);
const jsonText = ref("");
const validationError = ref("");
const isDirty = ref(false);
const editorMode = ref<"visual" | "json">("visual");
const visualModel = ref<object | null>(null);

function initializeText() {
  jsonText.value = JSON.stringify(props.currentValue, null, 2);
  validationError.value = "";
  isDirty.value = false;

  if (hasVisualSlot.value) {
    const parsed = props.parser(props.currentValue);
    if (parsed) {
      visualModel.value = parsed;
      editorMode.value = "visual";
    } else {
      editorMode.value = "json";
    }
  } else {
    editorMode.value = "json";
  }
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

function handleVisualUpdate(newModel: object) {
  visualModel.value = newModel;
  isDirty.value = true;
  validationError.value = "";
}

function switchToVisual() {
  if (editorMode.value === "visual") {
    return;
  }

  try {
    const parsed = props.parser(JSON.parse(jsonText.value));
    if (!parsed) {
      validationError.value = props.invalidStructureMessage;
      return;
    }
    visualModel.value = parsed;
    validationError.value = "";
    editorMode.value = "visual";
  } catch {
    validationError.value = props.invalidJsonMessage;
  }
}

function switchToJson() {
  if (editorMode.value === "json") {
    return;
  }

  if (visualModel.value) {
    const serialized = props.serializer
      ? props.serializer(visualModel.value)
      : visualModel.value;
    jsonText.value = JSON.stringify(serialized, null, 2);
  }

  validationError.value = "";
  editorMode.value = "json";
}

function save() {
  if (hasVisualSlot.value && editorMode.value === "visual") {
    if (!visualModel.value) {
      return;
    }
    const validated = props.parser(visualModel.value);
    if (!validated) {
      validationError.value = props.invalidStructureMessage;
      return;
    }
    emit("save", validated);
    return;
  }

  const parsedValue = parseCurrentJsonText();
  if (parsedValue === null) {
    return;
  }

  emit("save", parsedValue);
}

function resetToDefault() {
  if (hasVisualSlot.value && editorMode.value === "visual") {
    const parsed = props.parser(props.defaultValue);
    if (parsed) {
      visualModel.value = parsed;
      isDirty.value = true;
      validationError.value = "";
      return;
    }
    // Parser failed — fall back to JSON mode
    editorMode.value = "json";
  }

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
