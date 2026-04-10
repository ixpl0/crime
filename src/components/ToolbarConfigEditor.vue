<template>
  <JsonConfigEditorDialog
    :open="props.open"
    :title="props.title"
    :file-path="props.configFilePath"
    :current-value="serializeToolbarConfig(props.currentConfig)"
    :default-value="serializeToolbarConfig(props.defaultConfig)"
    :parser="parseToolbarConfig"
    :serializer="toolbarSerializer"
    :build-reset-value="buildResetValue"
    invalid-structure-message="Некорректная структура конфигурации панели"
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
import { mergeToolbarTrackingOnReset } from "../toolbar/toolbar-tracking-merge";

const props = withDefaults(defineProps<{
  currentConfig: ToolbarConfig;
  configFilePath: string;
  open: boolean;
  title?: string;
  defaultConfig?: ToolbarConfig;
}>(), {
  title: "Настройки панели",
  defaultConfig: () => defaultToolbarConfig
});

const emit = defineEmits<{
  save: [config: ToolbarConfig];
  close: [];
}>();

const toolbarSerializer = (value: unknown) => serializeToolbarConfig(value as ToolbarConfig);

const buildResetValue = (defaultValue: unknown, currentValue: unknown) => {
  const defaultConfig = parseToolbarConfig(defaultValue);
  const currentConfig = parseToolbarConfig(currentValue);
  if (!defaultConfig || !currentConfig) {
    return defaultValue;
  }
  return serializeToolbarConfig(mergeToolbarTrackingOnReset(defaultConfig, currentConfig));
};

function handleSave(value: unknown) {
  const config = parseToolbarConfig(value);
  if (!config) {
    return;
  }

  emit("save", config);
}
</script>
