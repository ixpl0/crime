<template>
  <JsonConfigEditorDialog
    :open="open"
    title="Настройки проекта"
    description="Задержки слеш-команд и масштаб проекта."
    :file-path="configFilePath"
    :current-value="currentSettings"
    :default-value="defaultProjectSettings"
    :parser="parseProjectSettings"
    invalid-structure-message="Некорректная структура настроек"
    @save="handleSave"
    @close="$emit('close')"
  >
    <template #visual="{ model, onUpdate }">
      <ProjectSettingsVisualEditor :model-value="model" @update:model-value="onUpdate" />
    </template>
  </JsonConfigEditorDialog>
</template>

<script setup lang="ts">
import JsonConfigEditorDialog from "./JsonConfigEditorDialog.vue";
import ProjectSettingsVisualEditor from "./visual-config/ProjectSettingsVisualEditor.vue";
import { type ProjectSettings } from "../types/project-settings";
import { defaultProjectSettings, parseProjectSettings } from "../settings/project-settings-storage";

defineProps<{
  currentSettings: ProjectSettings;
  configFilePath: string;
  open: boolean;
}>();

const emit = defineEmits<{
  save: [settings: ProjectSettings];
  close: [];
}>();

function handleSave(value: unknown) {
  const settings = parseProjectSettings(value);
  if (!settings) {
    return;
  }

  emit("save", settings);
}
</script>
