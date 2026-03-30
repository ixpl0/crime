<template>
  <div class="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-end p-4">
    <TransitionGroup name="toast-list" tag="div" class="flex w-full max-w-sm flex-col gap-2">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="pointer-events-auto alert cursor-pointer shadow-lg"
        :class="toneClasses(toast.tone)"
        role="status"
        @click="dismissToast(toast.id)"
      >
        <component :is="toneIcon(toast.tone)" :size="18" class="shrink-0" />
        <span class="min-w-0 flex-1 break-words">{{ toast.message }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import {
  CheckCircle2,
  CircleAlert,
  Info,
  TriangleAlert
} from "lucide-vue-next";
import { useAppToastStore, type ToastTone } from "../toast/toast-store";

const { toasts, dismissToast } = useAppToastStore();

function toneClasses(tone: ToastTone) {
  if (tone === "error") {
    return "alert-error";
  }

  if (tone === "success") {
    return "alert-success";
  }

  if (tone === "warning") {
    return "alert-warning";
  }

  return "alert-info";
}

function toneIcon(tone: ToastTone) {
  if (tone === "error") {
    return CircleAlert;
  }

  if (tone === "success") {
    return CheckCircle2;
  }

  if (tone === "warning") {
    return TriangleAlert;
  }

  return Info;
}
</script>

<style scoped>
.toast-list-enter-active,
.toast-list-leave-active {
  transition: all 0.18s ease;
}

.toast-list-enter-from,
.toast-list-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.98);
}

.toast-list-move {
  transition: transform 0.18s ease;
}
</style>
