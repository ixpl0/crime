<template>
  <div class="space-y-4">
    <fieldset class="rounded-lg border border-base-300 bg-base-content/2 p-3">
      <legend class="px-1 text-xs font-semibold uppercase tracking-wide">Слеш-команды</legend>
      <div class="grid grid-cols-[fit-content(33%)_1fr] items-center gap-x-3 gap-y-2">
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
      </div>
    </fieldset>

    <fieldset class="rounded-lg border border-base-300 bg-base-content/2 p-3">
      <legend class="px-1 text-xs font-semibold uppercase tracking-wide">Масштаб</legend>
      <div class="grid grid-cols-[fit-content(33%)_1fr] items-center gap-x-3 gap-y-2">
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
      </div>
    </fieldset>

    <fieldset class="rounded-lg border border-base-300 bg-base-content/2 p-3">
      <legend class="px-1 text-xs font-semibold uppercase tracking-wide">Напоминание о звонке</legend>
      <div class="grid grid-cols-[fit-content(33%)_1fr] items-center gap-x-3 gap-y-2">
        <FieldCheckbox
          label="Напоминать, если не среагировал на звонок"
          :model-value="settings.bellReminder.enabled"
          @update:model-value="updateBellReminder('enabled', $event)"
        />
        <FieldNumber
          label="Интервал напоминания (сек)"
          :model-value="settings.bellReminder.intervalSeconds"
          :min="5"
          :max="3600"
          :step="5"
          @update:model-value="updateBellReminder('intervalSeconds', $event)"
        />
        <FieldNumber
          label="Прирост интервала (сек)"
          :model-value="settings.bellReminder.intervalDeltaSeconds"
          :min="0"
          :max="60"
          :step="1"
          @update:model-value="updateBellReminder('intervalDeltaSeconds', $event)"
        />
      </div>
    </fieldset>

  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  type BellReminderSettings,
  type ProjectSettings,
  type SlashCommandSettings,
  type ZoomSettings
} from "../../types/project-settings";
import FieldCheckbox from "./FieldCheckbox.vue";
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

const updateBellReminder = (field: keyof BellReminderSettings, value: boolean | number) => {
  emit("update:modelValue", {
    ...settings.value,
    bellReminder: { ...settings.value.bellReminder, [field]: value }
  });
};

</script>
