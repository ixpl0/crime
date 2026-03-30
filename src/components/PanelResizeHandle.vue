<template>
  <button
    type="button"
    tabindex="-1"
    class="group flex w-4 shrink-0 cursor-col-resize items-center justify-center border-0 bg-transparent p-0"
    title="Потяните, чтобы изменить ширину панели"
    aria-label="Изменить ширину панели"
    @pointerdown="$emit('pointerdown', $event)"
  >
    <span
      class="h-[60%] w-0.5 rounded-full transition-colors duration-150"
      :class="isActive ? 'bg-primary' : 'bg-transparent group-hover:bg-base-300'"
    />
  </button>
</template>

<script setup lang="ts">
defineProps<{
  isActive: boolean;
}>();

defineEmits<{
  pointerdown: [event: PointerEvent];
}>();
</script>
