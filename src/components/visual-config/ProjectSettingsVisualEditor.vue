<template>
  <div class="space-y-4">
    <fieldset class="rounded-lg border border-base-300 p-3 space-y-2">
      <legend class="px-1 text-xs font-semibold uppercase tracking-wide">Slash Command</legend>
      <FieldNumber
        label="Char delay (ms)"
        :model-value="settings.slashCommand.charDelayMs"
        :min="0"
        @update:model-value="updateSlashCommand('charDelayMs', $event)"
      />
      <FieldNumber
        label="After-slash delay (ms)"
        :model-value="settings.slashCommand.afterSlashDelayMs"
        :min="0"
        @update:model-value="updateSlashCommand('afterSlashDelayMs', $event)"
      />
      <FieldNumber
        label="Enter delay (ms)"
        :model-value="settings.slashCommand.enterDelayMs"
        :min="0"
        @update:model-value="updateSlashCommand('enterDelayMs', $event)"
      />
      <FieldNumber
        label="Activity timeout (ms)"
        :model-value="settings.slashCommand.activityTimeoutMs"
        :min="1"
        @update:model-value="updateSlashCommand('activityTimeoutMs', $event)"
      />
      <FieldNumber
        label="Quiet timeout (ms)"
        :model-value="settings.slashCommand.quietTimeoutMs"
        :min="1"
        @update:model-value="updateSlashCommand('quietTimeoutMs', $event)"
      />
      <FieldNumber
        label="Data poll interval (ms)"
        :model-value="settings.slashCommand.dataPollIntervalMs"
        :min="1"
        @update:model-value="updateSlashCommand('dataPollIntervalMs', $event)"
      />
    </fieldset>

    <fieldset class="rounded-lg border border-base-300 p-3 space-y-2">
      <legend class="px-1 text-xs font-semibold uppercase tracking-wide">Zoom</legend>
      <FieldNumber
        label="IDE zoom factor"
        :model-value="settings.zoom.ideZoomFactor"
        :min="0.25"
        :max="5"
        :step="0.1"
        @update:model-value="updateZoom('ideZoomFactor', $event)"
      />
      <FieldNumber
        label="Terminal font size"
        :model-value="settings.zoom.terminalFontSize"
        :min="8"
        :max="32"
        :step="1"
        @update:model-value="updateZoom('terminalFontSize', $event)"
      />
    </fieldset>

    <fieldset class="rounded-lg border border-base-300 p-3 space-y-2">
      <legend class="px-1 text-xs font-semibold uppercase tracking-wide">Terminal</legend>
      <FieldNumber
        label="Panel height (px)"
        :model-value="settings.terminal.panelHeight"
        :min="160"
        :max="10000"
        @update:model-value="updateTerminal('panelHeight', $event)"
      />
    </fieldset>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  type ProjectSettings,
  type SlashCommandSettings,
  type ZoomSettings,
  type TerminalSettings
} from "../../types/project-settings";
import FieldNumber from "./FieldNumber.vue";

const props = defineProps<{
  modelValue: unknown;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: ProjectSettings];
}>();

const settings = computed(() => props.modelValue as ProjectSettings);

const updateSlashCommand = (field: keyof SlashCommandSettings, value: number) => {
  emit("update:modelValue", {
    ...settings.value,
    slashCommand: { ...settings.value.slashCommand, [field]: value }
  });
};

const updateZoom = (field: keyof ZoomSettings, value: number) => {
  emit("update:modelValue", {
    ...settings.value,
    zoom: { ...settings.value.zoom, [field]: value }
  });
};

const updateTerminal = (field: keyof TerminalSettings, value: number) => {
  emit("update:modelValue", {
    ...settings.value,
    terminal: { ...settings.value.terminal, [field]: value }
  });
};
</script>
