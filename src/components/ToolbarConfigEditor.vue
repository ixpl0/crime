<template>
  <JsonConfigEditorDialog
    :open="props.open"
    :title="props.title"
    :file-path="props.configFilePath"
    :current-value="serializeToolbarConfig(props.currentConfig)"
    :default-value="serializeToolbarConfig(props.defaultConfig)"
    :parser="parseToolbarConfig"
    :serializer="toolbarSerializer"
    invalid-structure-message="Invalid toolbar configuration structure"
    @save="handleSave"
    @close="$emit('close')"
  >
    <template #visual="{ model, onUpdate }">
      <ToolbarVisualEditor :model-value="model" @update:model-value="onUpdate" />
    </template>
  </JsonConfigEditorDialog>
</template>

<script setup lang="ts">
import JsonConfigEditorDialog from "./JsonConfigEditorDialog.vue";
import ToolbarVisualEditor from "./visual-config/ToolbarVisualEditor.vue";
import { type ToolbarConfig } from "../types/toolbar";
import { defaultToolbarConfig, parseToolbarConfig, serializeToolbarConfig } from "../toolbar/toolbar-storage";

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

const toolbarSerializer = (value: unknown) => serializeToolbarConfig(value as ToolbarConfig);

function handleSave(value: unknown) {
  const config = parseToolbarConfig(value);
  if (!config) {
    return;
  }

  emit("save", config);
}
</script>
