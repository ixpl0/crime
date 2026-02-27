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
  type ToolbarAction
} from "../types/toolbar";
import { formatShortcut } from "../toolbar/toolbar-shortcuts";
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

