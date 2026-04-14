<template>
  <div class="space-y-2">
    <div
      v-for="(element, elementIndex) in config.elements"
      :key="elementIndex"
      class="rounded-lg border border-base-300 bg-base-content/2"
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
        <span class="badge badge-xs badge-ghost">
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
      <div v-if="isExpanded(elementIndex)" class="grid grid-cols-[fit-content(33%)_1fr] items-center gap-x-3 gap-y-3 border-t border-base-300 p-3">
        <FieldText label="Название" :model-value="element.label" @update:model-value="updateElementLabel(elementIndex, $event)" />
        <FieldIcon label="Иконка" :model-value="element.icon" @update:model-value="updateElementIcon(elementIndex, $event)" />
        <FieldColor label="Цвет" :model-value="element.color" @update:model-value="updateElementColor(elementIndex, $event)" />

        <!-- Dropdown: nested items -->
        <template v-if="isDropdown(element)">
          <div class="col-span-2 mt-3 space-y-2">
            <div class="text-xs font-semibold uppercase tracking-wide text-base-content/60">
              Элементы ({{ (element as ToolbarDropdown).items.length }})
            </div>
            <div
              v-for="(item, itemIndex) in (element as ToolbarDropdown).items"
              :key="itemIndex"
              class="rounded-lg border border-base-300 bg-base-content/2"
            >
              <!-- Item header -->
              <div
                class="flex cursor-pointer items-center gap-2 p-2"
                @click="toggleExpandItem(elementIndex, itemIndex)"
              >
                <ChevronRight
                  :size="14"
                  class="shrink-0 transition-transform"
                  :class="{ 'rotate-90': isExpandedItem(elementIndex, itemIndex) }"
                />
                <span class="badge badge-xs badge-ghost">
                  {{ isDropdown(item) ? "group" : (item as ToolbarAction).type }}
                </span>
                <span class="flex-1 truncate text-sm font-medium">{{ item.label }}</span>
                <div class="flex gap-1" @click.stop>
                  <button class="btn btn-ghost btn-xs btn-square" tabindex="-1" :disabled="itemIndex === 0" title="Вверх" @click="handleMoveItem(elementIndex, itemIndex, -1)">
                    <ArrowUp :size="12" />
                  </button>
                  <button class="btn btn-ghost btn-xs btn-square" tabindex="-1" :disabled="itemIndex === (element as ToolbarDropdown).items.length - 1" title="Вниз" @click="handleMoveItem(elementIndex, itemIndex, 1)">
                    <ArrowDown :size="12" />
                  </button>
                  <button class="btn btn-ghost btn-xs btn-square text-error" tabindex="-1" title="Удалить" @click="handleRemoveItem(elementIndex, itemIndex)">
                    <X :size="12" />
                  </button>
                </div>
              </div>

              <!-- Sub-dropdown items (expanded) -->
              <div v-if="isExpandedItem(elementIndex, itemIndex) && isDropdown(item)" class="grid grid-cols-[fit-content(33%)_1fr] items-center gap-x-3 gap-y-3 border-t border-base-300 p-3">
                <FieldText label="Название" :model-value="item.label" @update:model-value="updateItemLabel(elementIndex, itemIndex, $event)" />
                <div class="col-span-2 mt-3 space-y-2">
                  <div class="text-xs font-semibold uppercase tracking-wide text-base-content/60">
                    Подэлементы ({{ (item as ToolbarDropdown).items.length }})
                  </div>
                  <div
                    v-for="(subItem, subIndex) in (item as ToolbarDropdown).items"
                    :key="subIndex"
                    class="rounded-lg border border-base-300 bg-base-content/2"
                  >
                    <div
                      class="flex cursor-pointer items-center gap-2 p-2"
                      @click="toggleExpandSubItem(elementIndex, itemIndex, subIndex)"
                    >
                      <ChevronRight
                        :size="14"
                        class="shrink-0 transition-transform"
                        :class="{ 'rotate-90': isExpandedSubItem(elementIndex, itemIndex, subIndex) }"
                      />
                      <span class="badge badge-xs badge-ghost">{{ (subItem as ToolbarAction).type }}</span>
                      <span class="flex-1 truncate text-sm font-medium">{{ subItem.label }}</span>
                      <div class="flex gap-1" @click.stop>
                        <button class="btn btn-ghost btn-xs btn-square" tabindex="-1" :disabled="subIndex === 0" title="Вверх" @click="handleMoveSubItem(elementIndex, itemIndex, subIndex, -1)">
                          <ArrowUp :size="12" />
                        </button>
                        <button class="btn btn-ghost btn-xs btn-square" tabindex="-1" :disabled="subIndex === (item as ToolbarDropdown).items.length - 1" title="Вниз" @click="handleMoveSubItem(elementIndex, itemIndex, subIndex, 1)">
                          <ArrowDown :size="12" />
                        </button>
                        <button class="btn btn-ghost btn-xs btn-square text-error" tabindex="-1" title="Удалить" @click="handleRemoveSubItem(elementIndex, itemIndex, subIndex)">
                          <X :size="12" />
                        </button>
                      </div>
                    </div>
                    <div v-if="isExpandedSubItem(elementIndex, itemIndex, subIndex)" class="border-t border-base-300 p-3">
                      <ToolbarActionEditor
                        :model-value="subItem"
                        @update:model-value="updateSubItem(elementIndex, itemIndex, subIndex, $event)"
                      />
                    </div>
                  </div>
                  <button class="btn btn-ghost btn-xs" tabindex="-1" @click="handleAddSubItem(elementIndex, itemIndex)">
                    <Plus :size="12" />
                    Добавить
                  </button>
                </div>
              </div>

              <!-- Action item fields (expanded) -->
              <div v-else-if="isExpandedItem(elementIndex, itemIndex)" class="border-t border-base-300 p-3">
                <ToolbarActionEditor
                  :model-value="item"
                  @update:model-value="updateItem(elementIndex, itemIndex, $event)"
                />
              </div>
            </div>

            <div class="flex gap-2">
              <button class="btn btn-ghost btn-xs" tabindex="-1" @click="handleAddItem(elementIndex)">
                <Plus :size="12" />
                Добавить
              </button>
              <button class="btn btn-ghost btn-xs" tabindex="-1" @click="handleAddSubDropdown(elementIndex)">
                <Plus :size="12" />
                Добавить подгруппу
              </button>
            </div>
          </div>
        </template>

        <!-- Standalone action -->
        <template v-else>
          <div class="col-span-2">
            <ToolbarActionEditor
              :model-value="element"
              @update:model-value="updateStandaloneAction(elementIndex, $event)"
            />
          </div>
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
import { computed } from "vue";
import { ArrowDown, ArrowUp, ChevronRight, Plus, X } from "lucide-vue-next";
import { type ToolbarAction, type ToolbarConfig, type ToolbarDropdown } from "../../types/toolbar";
import FieldText from "./FieldText.vue";
import FieldColor from "./FieldColor.vue";
import FieldIcon from "./FieldIcon.vue";
import ToolbarActionEditor from "./ToolbarActionEditor.vue";
import { isDropdown, useExpandState, useElementMutations, useItemMutations, useSubItemMutations } from "./use-toolbar-editor";

const props = defineProps<{ modelValue: unknown }>();
const emit = defineEmits<{ "update:modelValue": [value: ToolbarConfig] }>();
const config = computed(() => props.modelValue as ToolbarConfig);

const { isExpanded, isExpandedItem, isExpandedSubItem,
  toggleExpand, toggleExpandItem, toggleExpandSubItem } = useExpandState();
const { updateElement, updateElementLabel, updateElementIcon, updateElementColor, updateStandaloneAction,
  handleMoveElementUp, handleMoveElementDown, handleRemoveElement,
  handleAddDropdown, handleAddAction } = useElementMutations(() => config.value, (c) => { emit("update:modelValue", c); });
const { updateItem, updateItemLabel, handleMoveItem, handleRemoveItem,
  handleAddItem, handleAddSubDropdown } = useItemMutations(updateElement);
const { updateSubItem, handleMoveSubItem, handleRemoveSubItem, handleAddSubItem } = useSubItemMutations(updateElement);
</script>
