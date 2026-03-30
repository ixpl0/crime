<template>
  <div class="space-y-2">
    <FieldText label="Название" :model-value="action.label" @update:model-value="updateField('label', $event)" />
    <FieldSelect label="Тип" :model-value="action.type" :options="ACTION_TYPE_OPTIONS" @update:model-value="handleTypeChange" />

    <FieldText
      v-if="action.type !== 'scenario'"
      label="Значение"
      :model-value="action.value"
      :multiline="action.type === 'prompt'"
      :rows="3"
      :placeholder="valuePlaceholder"
      @update:model-value="updateField('value', $event)"
    />

    <FieldColor label="Цвет" :model-value="action.color" @update:model-value="updateField('color', $event)" />
    <FieldText label="Шорткат" :model-value="action.shortcut ?? ''" placeholder="e.g. ctrl+1" @update:model-value="updateOptionalString('shortcut', $event)" />
    <FieldCheckbox label="Сбросить терминал" :model-value="action.resetTerminal ?? false" @update:model-value="updateOptionalBool('resetTerminal', $event)" />
    <FieldCheckbox v-if="action.done !== undefined" label="Готово" :model-value="action.done ?? false" @update:model-value="updateOptionalBool('done', $event)" />

    <!-- Scenario steps -->
    <div v-if="action.type === 'scenario' && action.steps" class="mt-3">
      <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-base-content/60">Шаги</div>
      <div
        v-for="(step, stepIndex) in action.steps"
        :key="stepIndex"
        class="mb-1 flex flex-wrap items-center gap-2 rounded border border-base-300 p-2"
      >
        <select
          class="select select-bordered select-xs"
          :value="step.type"
          tabindex="-1"
          @change="updateStepType(stepIndex, ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="opt in STEP_TYPE_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>

        <input
          v-if="stepHasValue(step.type)"
          type="text"
          class="input input-bordered input-xs min-w-0 flex-1 font-mono"
          :value="step.value ?? ''"
          placeholder="Значение"
          tabindex="-1"
          @input="updateStepField(stepIndex, 'value', ($event.target as HTMLInputElement).value)"
        />

        <label v-if="step.type === 'command'" class="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            class="toggle toggle-xs"
            :checked="step.resetTerminal ?? false"
            tabindex="-1"
            @change="updateStepBool(stepIndex, 'resetTerminal', ($event.target as HTMLInputElement).checked)"
          />
          reset
        </label>

        <input
          v-if="step.type === 'wait-for'"
          type="text"
          class="input input-bordered input-xs w-24 font-mono"
          :value="step.pattern ?? ''"
          placeholder="pattern"
          tabindex="-1"
          @input="updateStepField(stepIndex, 'pattern', ($event.target as HTMLInputElement).value)"
        />

        <label v-if="step.type === 'wait'" class="flex items-center gap-1 text-xs">
          quiet
          <input
            type="number"
            class="input input-bordered input-xs w-20 font-mono"
            :value="step.quietMs ?? 0"
            :min="0"
            tabindex="-1"
            @input="updateStepNumber(stepIndex, 'quietMs', $event)"
          />
        </label>

        <label v-if="step.type === 'wait' || step.type === 'wait-for'" class="flex items-center gap-1 text-xs">
          timeout
          <input
            type="number"
            class="input input-bordered input-xs w-20 font-mono"
            :value="step.timeoutMs ?? 0"
            :min="0"
            tabindex="-1"
            @input="updateStepNumber(stepIndex, 'timeoutMs', $event)"
          />
        </label>

        <label v-if="step.type === 'delay'" class="flex items-center gap-1 text-xs">
          delay
          <input
            type="number"
            class="input input-bordered input-xs w-20 font-mono"
            :value="step.delayMs ?? 0"
            :min="0"
            tabindex="-1"
            @input="updateStepNumber(stepIndex, 'delayMs', $event)"
          />
        </label>

        <div class="ml-auto flex gap-1">
          <button class="btn btn-ghost btn-xs btn-square" tabindex="-1" :disabled="stepIndex === 0" @click="moveStepUp(stepIndex)">
            <ArrowUp :size="10" />
          </button>
          <button class="btn btn-ghost btn-xs btn-square" tabindex="-1" :disabled="stepIndex === (action.steps?.length ?? 0) - 1" @click="moveStepDown(stepIndex)">
            <ArrowDown :size="10" />
          </button>
          <button class="btn btn-ghost btn-xs btn-square text-error" tabindex="-1" @click="removeStep(stepIndex)">
            <X :size="10" />
          </button>
        </div>
      </div>

      <button class="btn btn-ghost btn-xs mt-1" tabindex="-1" @click="addStep">
        <Plus :size="12" />
        Добавить шаг
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-vue-next";
import {
  type ToolbarAction,
  type ToolbarActionType,
  type ScenarioStep,
  type ScenarioStepType
} from "../../types/toolbar";
import { moveItemUp, moveItemDown, removeItem } from "./list-utils";
import FieldText from "./FieldText.vue";
import FieldSelect from "./FieldSelect.vue";
import FieldCheckbox from "./FieldCheckbox.vue";
import FieldColor from "./FieldColor.vue";

const ACTION_TYPE_OPTIONS = [
  { label: "command", value: "command" },
  { label: "prompt", value: "prompt" },
  { label: "raw-input", value: "raw-input" },
  { label: "scenario", value: "scenario" }
] as const;

const STEP_TYPE_OPTIONS = [
  { label: "command", value: "command" },
  { label: "prompt", value: "prompt" },
  { label: "raw-input", value: "raw-input" },
  { label: "wait", value: "wait" },
  { label: "wait-for", value: "wait-for" },
  { label: "delay", value: "delay" }
] as const;

const stepHasValue = (type: ScenarioStepType) =>
  type === "command" || type === "prompt" || type === "raw-input";

const props = defineProps<{
  modelValue: unknown;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: ToolbarAction];
}>();

const action = computed(() => props.modelValue as ToolbarAction);

const valuePlaceholder = computed(() => {
  if (action.value.type === "command") {
    return "Команда";
  }
  if (action.value.type === "prompt") {
    return "Текст промпта";
  }
  return "Прямой ввод";
});

const updateField = (field: string, value: unknown) => {
  emit("update:modelValue", { ...action.value, [field]: value });
};

const updateOptionalString = (field: string, value: string) => {
  emit("update:modelValue", {
    ...action.value,
    [field]: value || undefined
  });
};

const updateOptionalBool = (field: string, value: boolean) => {
  emit("update:modelValue", {
    ...action.value,
    [field]: value || undefined
  });
};

const handleTypeChange = (newType: string) => {
  if (newType === "scenario" && !action.value.steps?.length) {
    emit("update:modelValue", {
      ...action.value,
      type: newType as ToolbarActionType,
      value: "",
      steps: [{ type: "command" as ScenarioStepType, value: "" }]
    });
  } else {
    emit("update:modelValue", {
      ...action.value,
      type: newType as ToolbarActionType
    });
  }
};

// --- Scenario steps ---

const updateSteps = (newSteps: readonly ScenarioStep[]) => {
  emit("update:modelValue", { ...action.value, steps: newSteps });
};

const updateStepType = (stepIndex: number, newType: string) => {
  const steps = action.value.steps ?? [];
  const newSteps = steps.map((step, i) =>
    i === stepIndex ? { type: newType as ScenarioStepType } : step
  );
  updateSteps(newSteps);
};

const updateStepField = (stepIndex: number, field: string, value: string) => {
  const steps = action.value.steps ?? [];
  const newSteps = steps.map((step, i) =>
    i === stepIndex ? { ...step, [field]: value || undefined } : step
  );
  updateSteps(newSteps);
};

const updateStepBool = (stepIndex: number, field: string, value: boolean) => {
  const steps = action.value.steps ?? [];
  const newSteps = steps.map((step, i) =>
    i === stepIndex ? { ...step, [field]: value || undefined } : step
  );
  updateSteps(newSteps);
};

const updateStepNumber = (stepIndex: number, field: string, event: Event) => {
  const num = Number((event.target as HTMLInputElement).value);
  if (!Number.isFinite(num)) {
    return;
  }
  const steps = action.value.steps ?? [];
  const newSteps = steps.map((step, i) =>
    i === stepIndex ? { ...step, [field]: num > 0 ? num : undefined } : step
  );
  updateSteps(newSteps);
};

const moveStepUp = (index: number) => {
  updateSteps(moveItemUp(action.value.steps ?? [], index));
};

const moveStepDown = (index: number) => {
  updateSteps(moveItemDown(action.value.steps ?? [], index));
};

const removeStep = (index: number) => {
  const newSteps = removeItem(action.value.steps ?? [], index);
  if (newSteps.length === 0) {
    // Scenario must have at least one step; switch to command
    emit("update:modelValue", {
      ...action.value,
      type: "command" as ToolbarActionType,
      steps: undefined
    });
  } else {
    updateSteps(newSteps);
  }
};

const addStep = () => {
  const steps = action.value.steps ?? [];
  updateSteps([...steps, { type: "command" as ScenarioStepType, value: "" }]);
};
</script>
