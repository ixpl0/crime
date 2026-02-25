<template>
  <div class="flex flex-wrap items-stretch gap-x-2 gap-y-0">
    <label
      v-for="(item, index) in suffixConfig.items"
      :key="`suffix-${index}`"
      class="label inline-flex h-8 cursor-pointer items-center gap-2 rounded-btn px-2 py-0 whitespace-nowrap hover:bg-base-100/60"
      :title="item.value"
    >
      <input
        type="checkbox"
        class="checkbox checkbox-xs shrink-0"
        :checked="item.enabled"
        @change="$emit('toggle-suffix', index)"
      >
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
import { type PromptSuffixConfig } from "../types/prompt-suffix";
import { Pencil } from "lucide-vue-next";

defineProps<{
  suffixConfig: PromptSuffixConfig;
}>();

defineEmits<{
  "toggle-suffix": [index: number];
  "open-config-editor": [];
}>();
</script>


