<template>
  <label class="contents">
    <span class="self-center text-right text-sm">{{ label }}</span>
    <input
      type="number"
      class="input input-bordered input-sm w-28 justify-self-start text-right font-mono"
      :value="modelValue"
      :min="min"
      :max="max"
      :step="step"
      tabindex="-1"
      @input="handleInput"
    />
  </label>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  modelValue: number;
  min?: number;
  max?: number;
  step?: number;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: number];
}>();

const handleInput = (event: Event) => {
  const value = Number((event.target as HTMLInputElement).value);
  if (Number.isFinite(value)) {
    emit("update:modelValue", value);
  }
};
</script>
