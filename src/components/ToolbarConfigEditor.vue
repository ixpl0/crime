<template>
  <JsonConfigEditorDialog
    :open="open"
    title="Toolbar Settings"
    :file-path="configFilePath"
    :current-value="currentConfig"
    :default-value="defaultToolbarConfig"
    :parser="parseToolbarConfig"
    invalid-structure-message="Invalid toolbar configuration structure"
    @save="handleSave"
    @close="$emit('close')"
  />
</template>

<script setup lang="ts">
import JsonConfigEditorDialog from "./JsonConfigEditorDialog.vue";
import { type ToolbarConfig } from "../types/toolbar";
import { parseToolbarConfig } from "../toolbar/toolbar-storage";
import { defaultToolbarConfig } from "../toolbar/default-toolbar-config";

defineProps<{
  currentConfig: ToolbarConfig;
  configFilePath: string;
  open: boolean;
}>();

const emit = defineEmits<{
  save: [config: ToolbarConfig];
  close: [];
}>();

function handleSave(value: unknown) {
  const config = parseToolbarConfig(value);
  if (!config) {
    return;
  }

  emit("save", config);
}
</script>
