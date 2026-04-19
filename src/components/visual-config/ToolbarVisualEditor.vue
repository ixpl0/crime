<template>
  <div class="space-y-3">
    <!-- Preview -->
    <div
      class="min-h-16 overflow-visible rounded-lg border border-base-300 bg-base-100 p-3"
      @click.self="clearSelection"
    >
      <div class="flex flex-wrap items-start gap-2" @click.self="clearSelection">
        <ToolbarPreviewElement
          v-for="(element, elementIndex) in config.elements"
          :key="elementIndex"
          :element="element"
          :path="[elementIndex]"
          :selected-path="selectedPath"
          variant="top"
          @select="handleSelect"
        />
        <div v-if="config.elements.length === 0" class="text-sm italic opacity-60">
          Пусто. Добавьте кнопку или группу ниже.
        </div>
      </div>
    </div>

    <!-- Action bar -->
    <div class="flex flex-wrap items-center gap-2">
      <div class="flex min-w-0 items-center gap-2 text-xs">
        <span class="opacity-60">Выбрано:</span>
        <span v-if="breadcrumb" class="truncate font-medium">{{ breadcrumb }}</span>
        <span v-else class="italic opacity-50">—</span>
      </div>
      <div class="ml-auto flex flex-wrap gap-1">
        <template v-if="selectedPath.length > 0">
          <button
            class="btn btn-ghost btn-xs btn-square"
            tabindex="-1"
            title="Вверх"
            :disabled="!canMoveUp"
            @click="handleMoveSelected(-1)"
          >
            <ArrowUp :size="14" />
          </button>
          <button
            class="btn btn-ghost btn-xs btn-square"
            tabindex="-1"
            title="Вниз"
            :disabled="!canMoveDown"
            @click="handleMoveSelected(1)"
          >
            <ArrowDown :size="14" />
          </button>
          <button
            class="btn btn-ghost btn-xs btn-square text-error"
            tabindex="-1"
            title="Удалить"
            @click="handleRemoveSelected"
          >
            <X :size="14" />
          </button>
          <button
            class="btn btn-ghost btn-xs"
            tabindex="-1"
            title="Снять выбор"
            @click="clearSelection"
          >
            Снять выбор
          </button>
        </template>
        <button class="btn btn-ghost btn-xs" tabindex="-1" @click="handleAddAction">
          <Plus :size="14" />
          {{ addLabelAction }}
        </button>
        <button class="btn btn-ghost btn-xs" tabindex="-1" @click="handleAddDropdown">
          <Plus :size="14" />
          {{ addLabelDropdown }}
        </button>
      </div>
    </div>

    <!-- Properties -->
    <div
      v-if="selectedElement"
      class="rounded-lg border border-base-300 bg-base-content/2 p-4"
    >
      <div
        v-if="isSelectedDropdown"
        class="grid grid-cols-[fit-content(33%)_1fr] items-center gap-x-3 gap-y-3"
      >
        <FieldText
          label="Название"
          :model-value="selectedElement.label"
          @update:model-value="updateSelectedLabel"
        />
        <FieldIcon
          label="Иконка"
          :model-value="selectedElement.icon"
          @update:model-value="updateSelectedIcon"
        />
        <FieldColor
          label="Цвет"
          :model-value="selectedElement.color"
          @update:model-value="updateSelectedColor"
        />
      </div>
      <ToolbarActionEditor
        v-else
        :model-value="selectedElement"
        @update:model-value="updateSelectedAction"
      />
    </div>
    <div v-else class="text-sm italic opacity-60">
      Выберите элемент панели, чтобы редактировать его свойства.
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-vue-next";
import {
  type ToolbarAction,
  type ToolbarButtonColor,
  type ToolbarConfig,
  type ToolbarElement
} from "../../types/toolbar";
import FieldText from "./FieldText.vue";
import FieldColor from "./FieldColor.vue";
import FieldIcon from "./FieldIcon.vue";
import ToolbarActionEditor from "./ToolbarActionEditor.vue";
import ToolbarPreviewElement from "./ToolbarPreviewElement.vue";
import {
  appendInside,
  createAction,
  createDropdown,
  getElementAt,
  getSiblingsAt,
  isDropdown,
  lastIndex,
  moveAt,
  parentPath,
  removeAt,
  type ToolbarPath,
  updateAt
} from "./toolbar-path-utils";

const props = defineProps<{ modelValue: unknown }>();
const emit = defineEmits<{ "update:modelValue": [value: ToolbarConfig] }>();

const config = computed(() => props.modelValue as ToolbarConfig);

const selectedPath = ref<ToolbarPath>([]);

const selectedElement = computed(() => getElementAt(config.value, selectedPath.value));
const isSelectedDropdown = computed(
  () => selectedElement.value !== null && isDropdown(selectedElement.value)
);

watch(
  () => props.modelValue,
  () => {
    if (selectedPath.value.length > 0 && selectedElement.value === null) {
      selectedPath.value = [];
    }
  }
);

const collectLabels = (
  elements: readonly ToolbarElement[],
  depth: number,
  acc: readonly string[]
): readonly string[] => {
  if (depth >= selectedPath.value.length) {
    return acc;
  }
  const index = selectedPath.value[depth];
  if (index < 0 || index >= elements.length) {
    return acc;
  }
  const element = elements[index];
  const next = [...acc, element.label];
  if (!isDropdown(element)) {
    return next;
  }
  return collectLabels(element.items, depth + 1, next);
};

const breadcrumb = computed(() => {
  if (selectedPath.value.length === 0) {
    return "";
  }
  return collectLabels(config.value.elements, 0, []).join(" › ");
});

const canMoveUp = computed(() => {
  if (selectedPath.value.length === 0) {
    return false;
  }
  return lastIndex(selectedPath.value) > 0;
});

const canMoveDown = computed(() => {
  if (selectedPath.value.length === 0) {
    return false;
  }
  const siblings = getSiblingsAt(config.value, selectedPath.value);
  return lastIndex(selectedPath.value) < siblings.length - 1;
});

const addTargetPath = computed<ToolbarPath>(() =>
  isSelectedDropdown.value ? selectedPath.value : []
);

const addLabelAction = computed(() =>
  addTargetPath.value.length === 0 ? "Кнопка" : "Кнопка внутрь"
);

const addLabelDropdown = computed(() =>
  addTargetPath.value.length === 0 ? "Группа" : "Группа внутрь"
);

const emitConfig = (next: ToolbarConfig) => {
  emit("update:modelValue", next);
};

const handleSelect = (path: ToolbarPath) => {
  selectedPath.value = path;
};

const clearSelection = () => {
  selectedPath.value = [];
};

const handleMoveSelected = (direction: -1 | 1) => {
  if (selectedPath.value.length === 0) {
    return;
  }
  const currentIndex = lastIndex(selectedPath.value);
  const next = moveAt(config.value, selectedPath.value, direction);
  emitConfig(next);
  selectedPath.value = [...parentPath(selectedPath.value), currentIndex + direction];
};

const handleRemoveSelected = () => {
  if (selectedPath.value.length === 0) {
    return;
  }
  emitConfig(removeAt(config.value, selectedPath.value));
  selectedPath.value = [];
};

const computeAppendedPath = (parent: ToolbarPath): ToolbarPath => {
  if (parent.length === 0) {
    return [config.value.elements.length];
  }
  const parentElement = getElementAt(config.value, parent);
  if (!parentElement || !isDropdown(parentElement)) {
    return parent;
  }
  return [...parent, parentElement.items.length];
};

const handleAddAction = () => {
  const parent = addTargetPath.value;
  const newPath = computeAppendedPath(parent);
  emitConfig(appendInside(config.value, parent, createAction()));
  selectedPath.value = newPath;
};

const handleAddDropdown = () => {
  const parent = addTargetPath.value;
  const newPath = computeAppendedPath(parent);
  emitConfig(appendInside(config.value, parent, createDropdown()));
  selectedPath.value = newPath;
};

const updateSelectedLabel = (label: string) => {
  if (selectedPath.value.length === 0) {
    return;
  }
  emitConfig(updateAt(config.value, selectedPath.value, (element) => ({ ...element, label })));
};

const updateSelectedIcon = (icon: string | undefined) => {
  if (selectedPath.value.length === 0) {
    return;
  }
  emitConfig(updateAt(config.value, selectedPath.value, (element) => ({ ...element, icon })));
};

const updateSelectedColor = (color: string | undefined) => {
  if (selectedPath.value.length === 0) {
    return;
  }
  emitConfig(
    updateAt(config.value, selectedPath.value, (element) => ({
      ...element,
      color: color as ToolbarButtonColor | undefined
    }))
  );
};

const updateSelectedAction = (action: ToolbarAction) => {
  if (selectedPath.value.length === 0) {
    return;
  }
  emitConfig(updateAt(config.value, selectedPath.value, () => action));
};
</script>
