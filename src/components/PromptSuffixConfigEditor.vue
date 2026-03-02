<template>
  <JsonConfigEditorDialog
    :open="open"
    title="Prompt Suffix Settings"
    :file-path="configFilePath"
    :current-value="currentConfig"
    :default-value="defaultPromptSuffixConfig"
    :parser="parsePromptSuffixConfig"
    invalid-structure-message="Invalid prompt suffix configuration structure"
    @save="handleSave"
    @close="$emit('close')"
  />
</template>

<script setup lang="ts">
import JsonConfigEditorDialog from "./JsonConfigEditorDialog.vue";
import { type PromptSuffixConfig } from "../types/prompt-suffix";
import { defaultPromptSuffixConfig, parsePromptSuffixConfig } from "../prompt-suffix/prompt-suffix-storage";

defineProps<{
  currentConfig: PromptSuffixConfig;
  configFilePath: string;
  open: boolean;
}>();

const emit = defineEmits<{
  save: [config: PromptSuffixConfig];
  close: [];
}>();

function handleSave(value: unknown) {
  const config = parsePromptSuffixConfig(value);
  if (!config) {
    return;
  }

  emit("save", config);
}
</script>
