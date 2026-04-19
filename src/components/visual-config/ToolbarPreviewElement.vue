<template>
  <!-- Top-level action -->
  <button
    v-if="variant === 'top' && !isDropdownElement"
    type="button"
    class="btn btn-sm"
    tabindex="-1"
    :class="[
      getToolbarButtonColorClass(element.color),
      isSelected ? 'outline outline-2 outline-primary outline-offset-2' : ''
    ]"
    :style="getToolbarButtonCustomStyle(element.color)"
    @click.stop="selectSelf"
  >
    <component v-if="resolveLucideIcon(element.icon)" :is="resolveLucideIcon(element.icon)" :size="14" class="shrink-0" />
    {{ element.label }}
  </button>

  <!-- Top-level dropdown -->
  <div
    v-else-if="variant === 'top' && isDropdownElement"
    class="inline-flex flex-col items-start"
  >
    <button
      type="button"
      class="btn btn-sm"
      tabindex="-1"
      :class="[
        getToolbarButtonColorClass(element.color),
        isSelected ? 'outline outline-2 outline-primary outline-offset-2' : ''
      ]"
      :style="getToolbarButtonCustomStyle(element.color)"
      @click.stop="selectSelf"
    >
      <component v-if="resolveLucideIcon(element.icon)" :is="resolveLucideIcon(element.icon)" :size="14" class="shrink-0" />
      {{ element.label }}
      <ChevronDown :size="14" class="-mr-px translate-y-px" />
    </button>
    <ul
      v-if="isForceOpen"
      class="menu bg-base-100 rounded-box mt-1 min-w-52 p-0 shadow"
    >
      <ToolbarPreviewElement
        v-for="(item, itemIndex) in dropdownElement.items"
        :key="itemIndex"
        :element="item"
        :path="[...path, itemIndex]"
        :selected-path="selectedPath"
        variant="menu"
        @select="forwardSelect"
      />
    </ul>
  </div>

  <!-- Nested action -->
  <li v-else-if="variant === 'menu' && !isDropdownElement">
    <button
      tabindex="-1"
      class="flex justify-between whitespace-nowrap"
      :class="{ 'outline outline-2 -outline-offset-2 outline-primary': isSelected }"
      @click.stop="selectSelf"
    >
      <span class="flex min-w-0 items-center gap-1.5">
        <component v-if="resolveLucideIcon(element.icon)" :is="resolveLucideIcon(element.icon)" :size="14" class="shrink-0 opacity-50" />
        <span class="truncate">{{ element.label }}</span>
      </span>
      <kbd v-if="actionShortcut" class="kbd kbd-xs">{{ formatShortcut(actionShortcut) }}</kbd>
    </button>
  </li>

  <!-- Nested dropdown (rendered inline as tree, not absolute) -->
  <li v-else>
    <button
      tabindex="-1"
      class="flex w-full justify-between whitespace-nowrap"
      :class="{ 'outline outline-2 -outline-offset-2 outline-primary': isSelected }"
      @click.stop="selectSelf"
    >
      <span class="flex items-center gap-1.5">
        <component v-if="resolveLucideIcon(element.icon)" :is="resolveLucideIcon(element.icon)" :size="14" class="shrink-0 opacity-50" />
        <span class="truncate">{{ element.label }}</span>
      </span>
      <ChevronRight
        :size="14"
        class="shrink-0 opacity-50 transition-transform"
        :class="{ 'rotate-90': isForceOpen }"
      />
    </button>
    <ul v-if="isForceOpen" class="menu p-0">
      <ToolbarPreviewElement
        v-for="(item, itemIndex) in dropdownElement.items"
        :key="itemIndex"
        :element="item"
        :path="[...path, itemIndex]"
        :selected-path="selectedPath"
        variant="menu"
        @select="forwardSelect"
      />
    </ul>
  </li>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { ChevronDown, ChevronRight } from "lucide-vue-next";
import { type ToolbarAction, type ToolbarDropdown, type ToolbarElement } from "../../types/toolbar";
import { resolveLucideIcon } from "../../toolbar/toolbar-icons";
import {
  getToolbarButtonColorClass,
  getToolbarButtonCustomStyle
} from "../../toolbar/toolbar-button-styles";
import { formatShortcut } from "../../toolbar/toolbar-shortcuts";
import { isDropdown, pathsEqual, pathStartsWith, type ToolbarPath } from "./toolbar-path-utils";

defineOptions({ name: "ToolbarPreviewElement" });

const props = defineProps<{
  element: ToolbarElement;
  path: ToolbarPath;
  selectedPath: ToolbarPath;
  variant: "top" | "menu";
}>();

const emit = defineEmits<{
  select: [path: ToolbarPath];
}>();

const isDropdownElement = computed(() => isDropdown(props.element));
const dropdownElement = computed(() => props.element as ToolbarDropdown);
const actionShortcut = computed(() =>
  isDropdownElement.value ? undefined : (props.element as ToolbarAction).shortcut
);
const isSelected = computed(() => pathsEqual(props.selectedPath, props.path));
const isForceOpen = computed(
  () =>
    isDropdownElement.value &&
    props.selectedPath.length > 0 &&
    pathStartsWith(props.selectedPath, props.path)
);

const selectSelf = () => {
  emit("select", props.path);
};

const forwardSelect = (path: ToolbarPath) => {
  emit("select", path);
};
</script>
