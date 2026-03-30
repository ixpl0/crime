<template>
  <div class="space-y-2">
    <div
      v-for="(element, elementIndex) in config.elements"
      :key="elementIndex"
      class="rounded-lg border border-base-300"
    >
      <!-- Element header -->
      <div
        class="flex cursor-pointer items-center gap-2 p-2"
        @click="toggleExpand(elementIndex)"
      >
        <ChevronRight
          :size="14"
          class="shrink-0 transition-transform"
          :class="{ 'rotate-90': isExpanded(elementIndex) }"
        />
        <span
          class="badge badge-xs"
          :class="isDropdown(element) ? 'badge-info' : 'badge-ghost'"
        >
          {{ isDropdown(element) ? "group" : (element as ToolbarAction).type }}
        </span>
        <span class="flex-1 truncate text-sm font-medium">{{ element.label }}</span>
        <span v-if="element.color" class="truncate text-xs opacity-50">{{ element.color }}</span>

        <div class="flex gap-1" @click.stop>
          <button class="btn btn-ghost btn-xs btn-square" tabindex="-1" :disabled="elementIndex === 0" title="Вверх" @click="handleMoveElementUp(elementIndex)">
            <ArrowUp :size="12" />
          </button>
          <button class="btn btn-ghost btn-xs btn-square" tabindex="-1" :disabled="elementIndex === config.elements.length - 1" title="Вниз" @click="handleMoveElementDown(elementIndex)">
            <ArrowDown :size="12" />
          </button>
          <button class="btn btn-ghost btn-xs btn-square text-error" tabindex="-1" title="Удалить" @click="handleRemoveElement(elementIndex)">
            <X :size="12" />
          </button>
        </div>
      </div>

      <!-- Expanded content -->
      <div v-if="isExpanded(elementIndex)" class="space-y-3 border-t border-base-300 p-3">
        <FieldText label="Название" :model-value="element.label" @update:model-value="updateElementLabel(elementIndex, $event)" />
        <FieldColor label="Цвет" :model-value="element.color" @update:model-value="updateElementColor(elementIndex, $event)" />

        <!-- Dropdown: nested items -->
        <template v-if="isDropdown(element)">
          <div class="mt-3">
            <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-base-content/60">
              Элементы ({{ (element as ToolbarDropdown).items.length }})
            </div>
            <div
              v-for="(item, itemIndex) in (element as ToolbarDropdown).items"
              :key="itemIndex"
              class="mb-2 ml-2 border-l-2 border-base-300 pl-3"
            >
              <!-- Item header -->
              <div
                class="flex cursor-pointer items-center gap-2"
                @click="toggleExpandItem(elementIndex, itemIndex)"
              >
                <ChevronRight
                  :size="12"
                  class="shrink-0 transition-transform"
                  :class="{ 'rotate-90': isExpandedItem(elementIndex, itemIndex) }"
                />
                <span class="badge badge-xs">{{ item.type }}</span>
                <span class="flex-1 truncate text-sm">{{ item.label }}</span>
                <div class="flex gap-1" @click.stop>
                  <button class="btn btn-ghost btn-xs btn-square" tabindex="-1" :disabled="itemIndex === 0" @click="handleMoveItem(elementIndex, itemIndex, -1)">
                    <ArrowUp :size="10" />
                  </button>
                  <button class="btn btn-ghost btn-xs btn-square" tabindex="-1" :disabled="itemIndex === (element as ToolbarDropdown).items.length - 1" @click="handleMoveItem(elementIndex, itemIndex, 1)">
                    <ArrowDown :size="10" />
                  </button>
                  <button class="btn btn-ghost btn-xs btn-square text-error" tabindex="-1" @click="handleRemoveItem(elementIndex, itemIndex)">
                    <X :size="10" />
                  </button>
                </div>
              </div>

              <!-- Item fields (expanded) -->
              <div v-if="isExpandedItem(elementIndex, itemIndex)" class="mt-2 ml-4">
                <ToolbarActionEditor
                  :model-value="item"
                  @update:model-value="updateItem(elementIndex, itemIndex, $event)"
                />
              </div>
            </div>

            <button class="btn btn-ghost btn-xs ml-2 mt-1" tabindex="-1" @click="handleAddItem(elementIndex)">
              <Plus :size="12" />
              Добавить
            </button>
          </div>
        </template>

        <!-- Standalone action -->
        <template v-else>
          <ToolbarActionEditor
            :model-value="element"
            @update:model-value="updateStandaloneAction(elementIndex, $event)"
          />
        </template>
      </div>
    </div>

    <!-- Add element buttons -->
    <div class="flex gap-2 pt-1">
      <button class="btn btn-ghost btn-sm" tabindex="-1" @click="handleAddDropdown">
        <Plus :size="14" />
        Добавить группу
      </button>
      <button class="btn btn-ghost btn-sm" tabindex="-1" @click="handleAddAction">
        <Plus :size="14" />
        Добавить кнопку
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { ArrowDown, ArrowUp, ChevronRight, Plus, X } from "lucide-vue-next";
import {
  type ToolbarAction,
  type ToolbarButtonColor,
  type ToolbarConfig,
  type ToolbarDropdown,
  type ToolbarElement
} from "../../types/toolbar";
import { moveItemUp, moveItemDown, removeItem } from "./list-utils";
import FieldText from "./FieldText.vue";
import FieldColor from "./FieldColor.vue";
import ToolbarActionEditor from "./ToolbarActionEditor.vue";

const props = defineProps<{
  modelValue: unknown;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: ToolbarConfig];
}>();

const config = computed(() => props.modelValue as ToolbarConfig);

const isDropdown = (element: ToolbarElement): element is ToolbarDropdown =>
  "items" in element;

// --- Expand/collapse state ---

const expandedKeys = ref<Set<string>>(new Set());

const keyForElement = (index: number) => `e-${String(index)}`;
const keyForItem = (elementIndex: number, itemIndex: number) => `i-${String(elementIndex)}-${String(itemIndex)}`;

const isExpanded = (index: number) => expandedKeys.value.has(keyForElement(index));
const isExpandedItem = (elementIndex: number, itemIndex: number) =>
  expandedKeys.value.has(keyForItem(elementIndex, itemIndex));

const toggleExpand = (index: number) => {
  const key = keyForElement(index);
  const next = new Set(expandedKeys.value);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  expandedKeys.value = next;
};

const toggleExpandItem = (elementIndex: number, itemIndex: number) => {
  const key = keyForItem(elementIndex, itemIndex);
  const next = new Set(expandedKeys.value);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  expandedKeys.value = next;
};

// --- Element mutations ---

const emitElements = (elements: readonly ToolbarElement[]) => {
  emit("update:modelValue", { elements });
};

const updateElement = (index: number, updater: (el: ToolbarElement) => ToolbarElement) => {
  emitElements(config.value.elements.map((el, i) => (i === index ? updater(el) : el)));
};

const updateElementLabel = (index: number, label: string) => {
  updateElement(index, (el) => ({ ...el, label }));
};

const updateElementColor = (index: number, color: string | undefined) => {
  const buttonColor = color as ToolbarButtonColor | undefined;
  updateElement(index, (el): ToolbarElement => {
    if (isDropdown(el)) {
      return { ...el, color: buttonColor };
    }
    return { ...el, color: buttonColor };
  });
};

const updateStandaloneAction = (index: number, action: ToolbarAction) => {
  emitElements(config.value.elements.map((el, i) => (i === index ? action : el)));
};

const handleMoveElementUp = (index: number) => {
  emitElements(moveItemUp(config.value.elements, index));
};

const handleMoveElementDown = (index: number) => {
  emitElements(moveItemDown(config.value.elements, index));
};

const handleRemoveElement = (index: number) => {
  emitElements(removeItem(config.value.elements, index));
};

const handleAddDropdown = () => {
  const newDropdown: ToolbarDropdown = { label: "Новая группа", items: [] };
  emitElements([...config.value.elements, newDropdown]);
};

const handleAddAction = () => {
  const newAction: ToolbarAction = { label: "Новая кнопка", value: "", type: "command" };
  emitElements([...config.value.elements, newAction]);
};

// --- Dropdown item mutations ---

const updateItem = (elementIndex: number, itemIndex: number, action: ToolbarAction) => {
  updateElement(elementIndex, (el) => {
    if (!isDropdown(el)) {
      return el;
    }
    const newItems = el.items.map((item, i) => (i === itemIndex ? action : item));
    return { ...el, items: newItems };
  });
};

const handleMoveItem = (elementIndex: number, itemIndex: number, direction: -1 | 1) => {
  updateElement(elementIndex, (el) => {
    if (!isDropdown(el)) {
      return el;
    }
    const moveFn = direction === -1 ? moveItemUp : moveItemDown;
    return { ...el, items: moveFn(el.items, itemIndex) };
  });
};

const handleRemoveItem = (elementIndex: number, itemIndex: number) => {
  updateElement(elementIndex, (el) => {
    if (!isDropdown(el)) {
      return el;
    }
    return { ...el, items: removeItem(el.items, itemIndex) };
  });
};

const handleAddItem = (elementIndex: number) => {
  updateElement(elementIndex, (el) => {
    if (!isDropdown(el)) {
      return el;
    }
    const newAction: ToolbarAction = { label: "Новое действие", value: "", type: "command" };
    return { ...el, items: [...el.items, newAction] };
  });
};
</script>
