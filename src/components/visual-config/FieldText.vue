<template>
  <label class="flex" :class="multiline ? 'flex-col gap-1' : 'items-center justify-between gap-4'">
    <span v-if="label" class="text-sm whitespace-nowrap">{{ label }}</span>
    <textarea
      v-if="multiline"
      class="textarea textarea-bordered textarea-sm min-w-0 flex-1 font-mono text-sm"
      :value="modelValue"
      :rows="rows"
      :placeholder="placeholder"
      tabindex="-1"
      @input="handleInput"
    />
    <input
      v-else
      type="text"
      class="input input-bordered input-sm min-w-0 flex-1 font-mono"
      :value="modelValue"
      :placeholder="placeholder"
      tabindex="-1"
      @input="handleInput"
    />
  </label>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  label?: string;
  modelValue: string;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
}>(), {
  label: "",
  placeholder: "",
  multiline: false,
  rows: 3
});

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const handleInput = (event: Event) => {
  emit("update:modelValue", (event.target as HTMLInputElement).value);
};
</script>
