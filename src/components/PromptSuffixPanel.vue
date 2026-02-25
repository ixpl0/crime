<template>
  <div class="flex flex-wrap items-center gap-2">
    <label
      v-for="(item, index) in suffixConfig.items"
      :key="`suffix-${index}`"
      class="label cursor-pointer gap-2 rounded-btn px-2 py-1 hover:bg-base-100/60"
      :title="item.value"
    >
      <input
        type="checkbox"
        class="checkbox checkbox-sm"
        :checked="item.enabled"
        @change="$emit('toggle-suffix', index)"
      >
      <span class="label-text text-sm">{{ item.label }}</span>
    </label>

    <button
      class="btn btn-sm btn-ghost"
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


