<template>
  <JsonConfigEditorDialog
    :open="props.open"
    :title="props.title"
    :file-path="props.configFilePath"
    :current-value="serializeToolbarConfig(props.currentConfig)"
    :default-value="serializeToolbarConfig(props.defaultConfig)"
    :parser="parseToolbarConfig"
    invalid-structure-message="Invalid toolbar configuration structure"
    @save="handleSave"
    @close="$emit('close')"
  />
</template>

<script setup lang="ts">
import JsonConfigEditorDialog from "./JsonConfigEditorDialog.vue";
import { type ToolbarConfig } from "../types/toolbar";
import { parseToolbarConfig, serializeToolbarConfig } from "../toolbar/toolbar-storage";
import { defaultToolbarConfig } from "../toolbar/default-toolbar-config";

const props = withDefaults(defineProps<{
  currentConfig: ToolbarConfig;
  configFilePath: string;
  open: boolean;
  title?: string;
  defaultConfig?: ToolbarConfig;
}>(), {
  title: "Toolbar Settings",
  defaultConfig: () => defaultToolbarConfig
});

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
