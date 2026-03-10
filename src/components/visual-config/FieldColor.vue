<template>
  <div class="flex items-center gap-2">
    <span v-if="label" class="text-sm whitespace-nowrap">{{ label }}</span>
    <select
      class="select select-bordered select-sm"
      :value="selectValue"
      tabindex="-1"
      @change="handleSelectChange"
    >
      <option value="">(none)</option>
      <option v-for="preset in PRESET_COLORS" :key="preset" :value="preset">{{ preset }}</option>
      <option value="__custom__">custom</option>
    </select>
    <input
      v-if="isCustom"
      type="text"
      class="input input-bordered input-sm w-40 font-mono text-xs"
      :value="modelValue ?? ''"
      placeholder="#hex or oklch(...)"
      tabindex="-1"
      @input="handleCustomInput"
    />
    <div
      v-if="modelValue && isCustom"
      class="h-5 w-5 shrink-0 rounded border border-base-300"
      :style="{ backgroundColor: modelValue }"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const PRESET_COLORS = [
  "primary", "secondary", "accent", "info",
  "success", "warning", "error", "neutral", "ghost"
] as const;

const isPreset = (value: string) => (PRESET_COLORS as readonly string[]).includes(value);

const props = withDefaults(defineProps<{
  label?: string;
  modelValue?: string;
}>(), {
  label: "",
  modelValue: undefined
});

const emit = defineEmits<{
  "update:modelValue": [value: string | undefined];
}>();

const isCustom = computed(() =>
  props.modelValue !== undefined && props.modelValue !== "" && !isPreset(props.modelValue)
);

const selectValue = computed(() => {
  if (!props.modelValue) {
    return "";
  }
  if (isPreset(props.modelValue)) {
    return props.modelValue;
  }
  return "__custom__";
});

const handleSelectChange = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value;
  if (value === "") {
    emit("update:modelValue", undefined);
  } else if (value === "__custom__") {
    emit("update:modelValue", "#000000");
  } else {
    emit("update:modelValue", value);
  }
};

const handleCustomInput = (event: Event) => {
  emit("update:modelValue", (event.target as HTMLInputElement).value);
};
</script>
