<template>
  <label class="contents">
    <span
      v-if="label"
      class="text-right text-sm"
      :class="multiline ? 'self-start pt-2' : 'self-center'"
    >{{ label }}</span>
    <textarea
      v-if="multiline"
      class="textarea textarea-bordered textarea-sm min-w-0 font-mono text-sm"
      :value="modelValue"
      :rows="rows"
      :placeholder="placeholder"
      tabindex="-1"
      @input="handleInput"
    />
    <input
      v-else
      type="text"
      class="input input-bordered input-sm min-w-0 font-mono"
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
