<template>
  <div class="space-y-3">
    <div
      v-for="(item, index) in config.items"
      :key="index"
      class="rounded-lg border border-base-300 bg-base-content/2 p-3 space-y-2"
    >
      <div class="flex items-center gap-2">
        <input
          type="text"
          class="input input-bordered input-sm min-w-0 flex-1 font-mono"
          :value="item.label"
          placeholder="Название"
          tabindex="-1"
          @input="updateItemField(index, 'label', ($event.target as HTMLInputElement).value)"
        />
        <FieldSelect
          :model-value="item.mode"
          :options="MODE_OPTIONS"
          @update:model-value="updateItemField(index, 'mode', $event)"
        />
        <div class="flex gap-1">
          <button
            class="btn btn-ghost btn-xs btn-square"
            tabindex="-1"
            :disabled="index === 0"
            title="Вверх"
            @click="handleMoveUp(index)"
          >
            <ArrowUp :size="12" />
          </button>
          <button
            class="btn btn-ghost btn-xs btn-square"
            tabindex="-1"
            :disabled="index === config.items.length - 1"
            title="Вниз"
            @click="handleMoveDown(index)"
          >
            <ArrowDown :size="12" />
          </button>
          <button
            class="btn btn-ghost btn-xs btn-square text-error"
            tabindex="-1"
            title="Удалить"
            @click="handleRemove(index)"
          >
            <X :size="12" />
          </button>
        </div>
      </div>
      <FieldText
        :model-value="item.value"
        placeholder="Текст суффикса"
        multiline
        :rows="2"
        @update:model-value="updateItemField(index, 'value', $event)"
      />
    </div>

    <button class="btn btn-ghost btn-sm" tabindex="-1" @click="handleAdd">
      <Plus :size="14" />
      Добавить суффикс
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-vue-next";
import { type PromptSuffixConfig, type PromptSuffixItem } from "../../types/prompt-suffix";
import { moveItemUp, moveItemDown, removeItem } from "./list-utils";
import FieldText from "./FieldText.vue";
import FieldSelect from "./FieldSelect.vue";

const MODE_OPTIONS = [
  { label: "off", value: "off" },
  { label: "once", value: "once" },
  { label: "always", value: "always" }
] as const;

const props = defineProps<{
  modelValue: unknown;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: PromptSuffixConfig];
}>();

const config = computed(() => props.modelValue as PromptSuffixConfig);

const emitItems = (items: readonly PromptSuffixItem[]) => {
  emit("update:modelValue", { items });
};

const updateItemField = (index: number, field: keyof PromptSuffixItem, value: string) => {
  const newItems = config.value.items.map((item, i) =>
    i === index ? { ...item, [field]: value } : item
  );
  emitItems(newItems);
};

const handleMoveUp = (index: number) => {
  emitItems(moveItemUp(config.value.items, index));
};

const handleMoveDown = (index: number) => {
  emitItems(moveItemDown(config.value.items, index));
};

const handleRemove = (index: number) => {
  emitItems(removeItem(config.value.items, index));
};

const handleAdd = () => {
  emitItems([...config.value.items, { label: "", value: "", mode: "off" }]);
};
</script>
