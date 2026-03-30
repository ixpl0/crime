<template>
  <div class="flex flex-wrap items-center gap-2 py-1">
    <template v-for="(element, elementIndex) in toolbarConfig.elements" :key="`element-${elementIndex}`">
      <div
        v-if="'items' in element"
        class="dropdown manual-dropdown"
        :class="{ 'dropdown-open': openDropdownIndex === elementIndex }"
      >
        <button
          type="button"
          class="btn btn-sm"
          tabindex="-1"
          :class="getToolbarButtonColorClass(element.color)"
          :style="getToolbarButtonCustomStyle(element.color)"
          :aria-expanded="openDropdownIndex === elementIndex"
          @click="handleDropdownToggleClick($event, elementIndex)"
          @keydown="handleDropdownTriggerKeydown($event, elementIndex)"
        >
          {{ element.label }}
          <ChevronDown :size="14" />
        </button>
        <ul
          class="dropdown-content menu bg-base-100 rounded-box z-10 min-w-52 p-0 shadow"
          @keydown.esc.stop.prevent="openDropdownIndex = null"
        >
          <li v-for="(item, itemIndex) in element.items" :key="`item-${elementIndex}-${itemIndex}`">
            <button
              :disabled="isActionDisabled(item, isTerminalReady)"
              tabindex="-1"
              :title="getActionTitle(item)"
              class="flex justify-between whitespace-nowrap"
              @click="handleDropdownActionClick(item)"
            >
              <span class="flex min-w-0 items-center gap-1.5">
                <CircleAlert v-if="isTrackingAlert(item)" :size="14" class="shrink-0 text-error" />
                <CircleCheck v-else-if="isTrackingSuccess(item)" :size="14" class="shrink-0 text-success" />
                <span v-else-if="getTrackingDaysLabel(item)" class="shrink-0 text-xs font-semibold text-warning">
                  {{ getTrackingDaysLabel(item) }}
                </span>
                <span class="truncate">{{ item.label }}</span>
              </span>
              <kbd v-if="item.shortcut" class="kbd kbd-xs">{{ formatShortcut(item.shortcut) }}</kbd>
            </button>
          </li>
        </ul>
      </div>

      <button
        v-else
        class="btn btn-sm"
        tabindex="-1"
        :class="getToolbarButtonColorClass(element.color)"
        :style="getToolbarButtonCustomStyle(element.color)"
        :disabled="isActionDisabled(element, isTerminalReady)"
        :title="getActionTitle(element)"
        @click="$emit('execute-action', element)"
      >
        {{ element.label }}
        <kbd v-if="element.shortcut" class="kbd kbd-xs ml-1">{{ formatShortcut(element.shortcut) }}</kbd>
      </button>
    </template>

    <button
      type="button"
      class="icon-btn text-base-content/40 hover:text-warning"
      tabindex="-1"
      title="Редактировать панель"
      @click="$emit('open-config-editor')"
    >
      <Pencil :size="16" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import {
  type ToolbarConfig,
  type ToolbarAction
} from "../types/toolbar";
import {
  getToolbarButtonColorClass,
  getToolbarButtonCustomStyle
} from "../toolbar/toolbar-button-styles";
import { formatShortcut } from "../toolbar/toolbar-shortcuts";
import { computeDaysSinceLastUsed, isLastUsedWithinOneDay } from "../toolbar/toolbar-tracking";
import { DROPDOWN_OPEN_KEYS, focusFirstDropdownItem, positionFixedDropdown, useDropdownClickOutside } from "../utils/dropdown-utils";
import { ChevronDown, CircleAlert, CircleCheck, Pencil } from "lucide-vue-next";

defineProps<{
  toolbarConfig: ToolbarConfig;
  isTerminalReady: boolean;
}>();

const emit = defineEmits<{
  "execute-action": [action: ToolbarAction];
  "open-config-editor": [];
}>();

const openDropdownIndex = ref<number | null>(null);
const isAnyDropdownOpen = computed(() => openDropdownIndex.value !== null);
useDropdownClickOutside(isAnyDropdownOpen, () => { openDropdownIndex.value = null; });

function isTrackingAlert(action: ToolbarAction): boolean {
  if (action.done === false) {
    return true;
  }
  if (action.lastUsed === null) {
    return true;
  }
  return false;
}

function isTrackingSuccess(action: ToolbarAction): boolean {
  if (action.done === true) {
    return true;
  }
  if (action.lastUsed !== undefined && action.lastUsed !== null) {
    return isLastUsedWithinOneDay(action.lastUsed, new Date());
  }
  return false;
}

function getTrackingDaysLabel(action: ToolbarAction): string | null {
  if (action.lastUsed === undefined || action.lastUsed === null) {
    return null;
  }
  const days = computeDaysSinceLastUsed(action.lastUsed, new Date());
  if (days === null || days < 1) {
    return null;
  }
  return `${String(days)}d`;
}

function handleDropdownToggleClick(event: MouseEvent, index: number) {
  openDropdownIndex.value = openDropdownIndex.value === index ? null : index;
  if (openDropdownIndex.value !== null) {
    positionFixedDropdown(event.currentTarget);
  }
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
  positionFixedDropdown(event.currentTarget);
  if (event.key === "ArrowDown") {
    focusFirstDropdownItem(event.currentTarget);
  }
}

function handleDropdownActionClick(action: ToolbarAction) {
  openDropdownIndex.value = null;
  emit("execute-action", action);
}

function isActionDisabled(action: ToolbarAction, isTerminalReady: boolean) {
  return !isTerminalReady && !action.resetTerminal;
}

function getActionTitle(action: ToolbarAction): string | undefined {
  const titleParts: string[] = [];
  if (action.resetTerminal) {
    const hasValue = typeof action.value === "string" && action.value.length > 0;
    titleParts.push(hasValue ? "Сброс терминала перед действием" : "Сброс терминала");
  }
  if (action.value) {
    titleParts.push(action.value);
  }
  if (action.shortcut) {
    titleParts.push(formatShortcut(action.shortcut));
  }

  return titleParts.length > 0 ? titleParts.join("\n") : undefined;
}
</script>
