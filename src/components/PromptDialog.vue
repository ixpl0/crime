<template>
  <dialog ref="dialogElement" class="modal" @close="handleDialogClose">
    <div class="modal-box max-w-md text-center">
      <h3 class="text-lg font-semibold">{{ pendingState?.title }}</h3>
      <div class="my-4">
        <input
          ref="inputElement"
          v-model="inputValue"
          type="text"
          class="input input-bordered w-full text-sm"
          :placeholder="pendingState?.placeholder"
          @keydown.enter="handleSubmit"
          @keydown.escape="handleCancel"
        />
      </div>
      <div class="modal-action justify-center">
        <button class="btn btn-ghost" tabindex="-1" @click="handleCancel">Отмена</button>
        <button class="btn btn-primary" tabindex="-1" :disabled="inputValue.trim().length === 0" @click="handleSubmit">
          Создать
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button tabindex="-1">close</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { usePromptDialog } from "../utils/dialog-utils";

const { pendingState, resolvePrompt } = usePromptDialog();

const dialogElement = ref<HTMLDialogElement | null>(null);
const inputElement = ref<HTMLInputElement | null>(null);
const inputValue = ref("");

watch(pendingState, (state) => {
  if (state !== null) {
    inputValue.value = "";
    dialogElement.value?.showModal();
    void nextTick(() => {
      inputElement.value?.focus();
    });
  } else {
    dialogElement.value?.close();
  }
});

const handleSubmit = () => {
  const trimmed = inputValue.value.trim();
  if (trimmed.length > 0) {
    resolvePrompt(trimmed);
  }
};

const handleCancel = () => {
  resolvePrompt(null);
};

const handleDialogClose = () => {
  if (pendingState.value !== null) {
    resolvePrompt(null);
  }
};
</script>
