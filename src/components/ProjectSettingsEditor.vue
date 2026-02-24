<template>
  <JsonConfigEditorDialog
    :open="open"
    title="Project Settings"
    description="Configure slash-command timing and zoom for this project."
    :file-path="configFilePath"
    :current-value="currentSettings"
    :default-value="defaultProjectSettings"
    :parser="parseProjectSettings"
    invalid-structure-message="Invalid settings structure"
    @save="handleSave"
    @close="$emit('close')"
  />
</template>

<script setup lang="ts">
import JsonConfigEditorDialog from "./JsonConfigEditorDialog.vue";
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
