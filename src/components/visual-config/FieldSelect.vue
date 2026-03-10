<template>
  <label class="flex items-center justify-between gap-4">
    <span v-if="label" class="text-sm whitespace-nowrap">{{ label }}</span>
    <select
      class="select select-bordered select-sm"
      :value="modelValue"
      tabindex="-1"
      @change="handleChange"
    >
      <option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
    </select>
  </label>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  label?: string;
  modelValue: string;
  options: readonly { readonly label: string; readonly value: string }[];
}>(), {
  label: ""
});

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const handleChange = (event: Event) => {
  emit("update:modelValue", (event.target as HTMLSelectElement).value);
};
</script>
