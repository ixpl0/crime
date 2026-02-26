<template>
  <div class="flex flex-wrap items-stretch gap-x-2 gap-y-0">
    <label
      v-for="(item, index) in suffixConfig.items"
      :key="`suffix-${index}`"
      class="label inline-flex h-8 cursor-pointer items-center gap-2 rounded-btn px-2 py-0 whitespace-nowrap hover:bg-base-100/60"
      :title="item.value"
      @click.prevent="$emit('toggle-suffix', index)"
    >
      <span
        class="flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold leading-none"
        :class="suffixIndicatorClass(item.mode)"
      >
        <template v-if="item.mode === 'once'">1</template>
        <template v-else-if="item.mode === 'always'">✓</template>
      </span>
      <span class="label-text text-xs">{{ item.label }}</span>
    </label>

    <button
      type="button"
      class="btn btn-sm btn-square btn-ghost h-8 min-h-8"
      title="Edit suffixes"
      @click="$emit('open-config-editor')"
    >
      <Pencil :size="16" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { type PromptSuffixConfig, type PromptSuffixMode } from "../types/prompt-suffix";
import { Pencil } from "lucide-vue-next";

defineProps<{
  suffixConfig: PromptSuffixConfig;
}>();

defineEmits<{
  "toggle-suffix": [index: number];
  "open-config-editor": [];
}>();

const suffixIndicatorClass = (mode: PromptSuffixMode) => {
  if (mode === "once") {
    return "border-warning bg-warning/20 text-warning-content";
  }
  if (mode === "always") {
    return "border-success bg-success/20 text-success-content";
  }
  return "border-base-content/30";
};
</script>
