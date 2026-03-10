<template>
  <label class="flex items-center justify-between gap-4">
    <span class="text-sm whitespace-nowrap">{{ label }}</span>
    <input
      type="checkbox"
      class="toggle toggle-sm"
      :checked="modelValue"
      tabindex="-1"
      @change="handleChange"
    />
  </label>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  modelValue: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();

const handleChange = (event: Event) => {
  emit("update:modelValue", (event.target as HTMLInputElement).checked);
};
</script>
