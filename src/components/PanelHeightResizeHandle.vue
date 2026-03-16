<template>
  <button
    type="button"
    tabindex="-1"
    class="group hidden h-4 w-full shrink-0 cursor-row-resize items-center justify-center border-0 bg-transparent p-0 lg:flex"
    title="Потяните, чтобы изменить высоту панели"
    aria-label="Изменить высоту панели"
    @pointerdown="$emit('pointerdown', $event)"
  >
    <span
      class="h-0.5 w-[60%] rounded-full transition-colors duration-150"
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
