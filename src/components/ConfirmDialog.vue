<template>
  <dialog ref="dialogElement" class="modal" @close="handleDialogClose">
    <div class="modal-box max-w-md text-center">
      <h3 class="text-lg font-semibold">{{ pendingState?.title }}</h3>
      <p v-if="pendingState?.body" class="my-4 whitespace-pre-line text-sm text-base-content/70">
        {{ pendingState.body }}
      </p>
      <div class="modal-action justify-center">
        <button class="btn btn-ghost" @click="handleCancel">Отмена</button>
        <button class="btn btn-error" @click="handleConfirm">Подтвердить</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useConfirmDialog } from "../utils/dialog-utils";

const { pendingState, resolveConfirm } = useConfirmDialog();

const dialogElement = ref<HTMLDialogElement | null>(null);

watch(pendingState, (state) => {
  if (state !== null) {
    dialogElement.value?.showModal();
  } else {
    dialogElement.value?.close();
  }
});

const handleConfirm = () => {
  resolveConfirm(true);
};

const handleCancel = () => {
  resolveConfirm(false);
};

const handleDialogClose = () => {
  if (pendingState.value !== null) {
    resolveConfirm(false);
  }
};
</script>
