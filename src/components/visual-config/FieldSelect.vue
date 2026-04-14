<template>
  <label class="contents">
    <span v-if="label" class="self-center text-right text-sm">{{ label }}</span>
    <select
      class="select select-bordered select-sm justify-self-start"
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
