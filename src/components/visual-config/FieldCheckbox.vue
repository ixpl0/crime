<template>
  <label class="contents">
    <span class="self-center text-right text-sm">{{ label }}</span>
    <input
      type="checkbox"
      class="toggle toggle-sm justify-self-start"
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
