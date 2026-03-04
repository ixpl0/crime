<template>
  <dialog ref="dialogElement" class="modal" @close="$emit('close')">
    <div class="modal-box max-w-3xl">
      <div class="flex items-baseline gap-2">
        <h3 class="text-lg font-bold">{{ title }}</h3>
        <span class="font-mono text-xs text-base-content/50 truncate">{{ filePath }}</span>
      </div>

      <p class="mt-2 text-sm text-base-content/70">
        Укажите секреты (например, API ключи) в формате KEY=VALUE.
      </p>

      <div class="form-control mt-4">
        <textarea
          v-model="textContent"
          class="textarea textarea-bordered font-mono text-sm h-96 w-full resize-y"
          spellcheck="false"
          @input="onInput"
        />
      </div>

      <div class="modal-action">
        <button class="btn btn-ghost" tabindex="-1" @click="resetToDefault">Сброс</button>
        <div class="flex-1" />
        <button class="btn" tabindex="-1" @click="$emit('close')">Отмена</button>
        <button class="btn btn-primary" tabindex="-1" :disabled="!isDirty" @click="save">
          Сохранить
        </button>
      </div>
    </div>

    <form method="dialog" class="modal-backdrop">
      <button tabindex="-1">close</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from "vue";

const props = defineProps<{
  open: boolean;
  title: string;
  filePath: string;
  currentValue: string;
  defaultValue: string;
}>();

const emit = defineEmits<{
  save: [value: string];
  close: [];
}>();

const dialogElement = ref<HTMLDialogElement | null>(null);
const textContent = ref("");
const isDirty = ref(false);

function initializeText() {
  textContent.value = props.currentValue;
  isDirty.value = false;
}

function onInput() {
  isDirty.value = true;
}

function save() {
  emit("save", textContent.value);
}

function resetToDefault() {
  textContent.value = props.defaultValue;
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
