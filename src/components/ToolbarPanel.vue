<template>
  <div class="flex items-center gap-2">
    <template v-for="(element, elementIndex) in toolbarConfig.elements" :key="`element-${elementIndex}`">
      <div v-if="'items' in element" class="dropdown">
        <div tabindex="0" role="button" class="btn btn-sm">{{ element.label }} <ChevronDown :size="14" /></div>
        <ul
          tabindex="0"
          class="dropdown-content menu bg-base-100 rounded-box z-10 w-52 p-0 shadow"
        >
          <li v-for="(item, itemIndex) in element.items" :key="`item-${elementIndex}-${itemIndex}`">
            <button
              :disabled="!isTerminalReady"
              :title="getActionTitle(item)"
              class="flex justify-between"
              @click="$emit('execute-action', item)"
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

defineEmits<{
  "execute-action": [action: ToolbarAction];
  "open-config-editor": [];
}>();

function getActionTitle(action: ToolbarAction): string | undefined {
  const valueTitle = action.value;
  const shortcutTitle = action.shortcut ? formatShortcut(action.shortcut) : undefined;

  if (valueTitle && shortcutTitle) {
    return `${valueTitle}\n${shortcutTitle}`;
  }

  return valueTitle || shortcutTitle;
}
</script>

