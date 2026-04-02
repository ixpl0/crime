<template>
  <div class="space-y-4">
    <fieldset class="rounded-lg border border-base-300 p-3 space-y-2">
      <legend class="px-1 text-xs font-semibold uppercase tracking-wide">Слеш-команды</legend>
      <FieldNumber
        label="Задержка символа (мс)"
        :model-value="settings.slashCommand.charDelayMs"
        :min="0"
        @update:model-value="updateSlashCommand('charDelayMs', $event)"
      />
      <FieldNumber
        label="Задержка после слеша (мс)"
        :model-value="settings.slashCommand.afterSlashDelayMs"
        :min="0"
        @update:model-value="updateSlashCommand('afterSlashDelayMs', $event)"
      />
      <FieldNumber
        label="Задержка Enter (мс)"
        :model-value="settings.slashCommand.enterDelayMs"
        :min="0"
        @update:model-value="updateSlashCommand('enterDelayMs', $event)"
      />
      <FieldNumber
        label="Таймаут активности (мс)"
        :model-value="settings.slashCommand.activityTimeoutMs"
        :min="1"
        @update:model-value="updateSlashCommand('activityTimeoutMs', $event)"
      />
      <FieldNumber
        label="Таймаут тишины (мс)"
        :model-value="settings.slashCommand.quietTimeoutMs"
        :min="1"
        @update:model-value="updateSlashCommand('quietTimeoutMs', $event)"
      />
      <FieldNumber
        label="Интервал опроса данных (мс)"
        :model-value="settings.slashCommand.dataPollIntervalMs"
        :min="1"
        @update:model-value="updateSlashCommand('dataPollIntervalMs', $event)"
      />
    </fieldset>

    <fieldset class="rounded-lg border border-base-300 p-3 space-y-2">
      <legend class="px-1 text-xs font-semibold uppercase tracking-wide">Масштаб</legend>
      <FieldNumber
        label="Масштаб IDE"
        :model-value="settings.zoom.ideZoomFactor"
        :min="0.25"
        :max="5"
        :step="0.1"
        @update:model-value="updateZoom('ideZoomFactor', $event)"
      />
      <FieldNumber
        label="Размер шрифта терминала"
        :model-value="settings.zoom.terminalFontSize"
        :min="8"
        :max="32"
        :step="1"
        @update:model-value="updateZoom('terminalFontSize', $event)"
      />
    </fieldset>

  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  type ProjectSettings,
  type SlashCommandSettings,
  type ZoomSettings
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

</script>
