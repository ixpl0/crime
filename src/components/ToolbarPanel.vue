<template>
  <div class="flex items-center gap-2 py-1">
    <template v-for="(element, elementIndex) in toolbarConfig.elements" :key="`element-${elementIndex}`">
      <div
        v-if="'items' in element"
        class="dropdown manual-dropdown"
        :class="{ 'dropdown-open': openDropdownIndex === elementIndex }"
        @focusout="handleDropdownFocusOut($event, elementIndex)"
      >
        <button
          type="button"
          class="btn btn-sm"
          :class="getColorClass(element.color)"
          :style="getCustomColorStyle(element.color)"
          :aria-expanded="openDropdownIndex === elementIndex"
          @click="toggleDropdownTabNavigation(elementIndex)"
          @keydown="handleDropdownTriggerKeydown($event, elementIndex)"
        >
          {{ element.label }}
          <ChevronDown :size="14" />
        </button>
        <ul
          class="dropdown-content menu bg-base-100 rounded-box z-10 w-52 p-0 shadow"
          @keydown.esc.stop.prevent="openDropdownIndex = null"
        >
          <li v-for="(item, itemIndex) in element.items" :key="`item-${elementIndex}-${itemIndex}`">
            <button
              :disabled="!isTerminalReady"
              :tabindex="openDropdownIndex === elementIndex ? 0 : -1"
              :title="getActionTitle(item)"
              class="flex justify-between"
              @click="handleDropdownActionClick(item)"
            >
              <span>{{ item.label }}</span>
              <kbd v-if="item.shortcut" class="kbd kbd-xs">{{ formatShortcut(item.shortcut) }}</kbd>
            </button>
          </li>
        </ul>
      </div>

      <button
        v-else
        class="btn btn-sm"
        :class="getColorClass(element.color)"
        :style="getCustomColorStyle(element.color)"
        :disabled="!isTerminalReady"
        :title="getActionTitle(element)"
        @click="$emit('execute-action', element)"
      >
        {{ element.label }}
        <kbd v-if="element.shortcut" class="kbd kbd-xs ml-1">{{ formatShortcut(element.shortcut) }}</kbd>
      </button>
    </template>

    <button
      class="btn btn-sm btn-ghost"
      title="Edit toolbar"
      @click="$emit('open-config-editor')"
    >
      <Pencil :size="16" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from "vue";
import {
  type ToolbarConfig,
  type ToolbarAction,
  type ToolbarButtonColor,
  type ToolbarPresetColor
} from "../types/toolbar";
import { formatShortcut } from "../toolbar/toolbar-shortcuts";
import { isToolbarPresetColor } from "../toolbar/toolbar-storage";
import { ChevronDown, Pencil } from "lucide-vue-next";

defineProps<{
  toolbarConfig: ToolbarConfig;
  isTerminalReady: boolean;
}>();

const emit = defineEmits<{
  "execute-action": [action: ToolbarAction];
  "open-config-editor": [];
}>();

const openDropdownIndex = ref<number | null>(null);
const DROPDOWN_OPEN_KEYS = new Set(["Enter", " ", "ArrowDown"]);

function toggleDropdownTabNavigation(index: number) {
  openDropdownIndex.value = openDropdownIndex.value === index ? null : index;
}

function focusFirstDropdownItem(triggerTarget: EventTarget | null) {
  const trigger = triggerTarget instanceof HTMLElement ? triggerTarget : null;
  const dropdownRoot = trigger?.closest(".manual-dropdown");
  const firstItem = dropdownRoot?.querySelector<HTMLButtonElement>(
    ".dropdown-content button:not(:disabled)"
  );
  if (!firstItem) {
    return;
  }

  void nextTick(() => {
    firstItem.focus();
  });
}

function handleDropdownTriggerKeydown(event: KeyboardEvent, index: number) {
  if (event.key === "Escape") {
    openDropdownIndex.value = null;
    return;
  }

  if (!DROPDOWN_OPEN_KEYS.has(event.key)) {
    return;
  }

  event.preventDefault();
  openDropdownIndex.value = index;
  if (event.key === "ArrowDown") {
    focusFirstDropdownItem(event.currentTarget);
  }
}

function handleDropdownFocusOut(event: FocusEvent, index: number) {
  if (openDropdownIndex.value !== index) {
    return;
  }

  const currentDropdown = event.currentTarget;
  if (!(currentDropdown instanceof HTMLElement)) {
    openDropdownIndex.value = null;
    return;
  }

  const nextFocused = event.relatedTarget;
  if (nextFocused instanceof Node && currentDropdown.contains(nextFocused)) {
    return;
  }

  openDropdownIndex.value = null;
}

function handleDropdownActionClick(action: ToolbarAction) {
  openDropdownIndex.value = null;
  emit("execute-action", action);
}

const presetClassMap: Record<ToolbarPresetColor, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  accent: "btn-accent",
  info: "btn-info",
  success: "btn-success",
  warning: "btn-warning",
  error: "btn-error",
  neutral: "btn-neutral",
  ghost: "btn-ghost"
};

const getColorClass = (color?: ToolbarButtonColor): string =>
  color && isToolbarPresetColor(color) ? presetClassMap[color] : "";

const parseHexToRgb = (hex: string): readonly [number, number, number] => {
  const normalized = hex.length === 4
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    : hex;
  const value = parseInt(normalized.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
};

const linearizeChannel = (channel: number): number => {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
};

const getContrastingTextColor = (hex: string): string => {
  const [red, green, blue] = parseHexToRgb(hex);
  const luminance =
    0.2126 * linearizeChannel(red) +
    0.7152 * linearizeChannel(green) +
    0.0722 * linearizeChannel(blue);
  return luminance > 0.179 ? "#000000" : "#ffffff";
};

const getCustomColorStyle = (color?: ToolbarButtonColor): Record<string, string> | undefined => {
  if (!color || isToolbarPresetColor(color)) {
    return undefined;
  }
  return {
    backgroundColor: color,
    color: getContrastingTextColor(color),
    borderColor: color
  };
};

function getActionTitle(action: ToolbarAction): string | undefined {
  const valueTitle = action.value;
  const shortcutTitle = action.shortcut ? formatShortcut(action.shortcut) : undefined;

  if (valueTitle && shortcutTitle) {
    return `${valueTitle}\n${shortcutTitle}`;
  }

  return valueTitle || shortcutTitle;
}
</script>

<style scoped>
.manual-dropdown:not(.dropdown-open):focus-within .dropdown-content {
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
}
</style>

