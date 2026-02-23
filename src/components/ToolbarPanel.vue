<template>
  <div class="flex items-center gap-2">
    <template v-for="element in toolbarConfig.elements" :key="element.id">
      <div v-if="element.type === 'dropdown'" class="dropdown">
        <div tabindex="0" role="button" class="btn btn-sm">{{ element.label }} <ChevronDown :size="14" /></div>
        <ul
          tabindex="0"
          class="dropdown-content menu bg-base-100 rounded-box z-10 w-52 shadow"
        >
          <li v-for="item in element.items" :key="item.id">
            <button
              :disabled="!isTerminalReady"
              class="flex justify-between"
              @click="$emit('execute-action', item.action)"
            >
              <span>{{ item.label }}</span>
              <kbd v-if="item.shortcut" class="kbd kbd-xs">{{ formatShortcut(item.shortcut) }}</kbd>
            </button>
          </li>
        </ul>
      </div>

      <button
        v-else-if="element.type === 'button'"
        class="btn btn-sm"
        :disabled="!isTerminalReady"
        :title="element.shortcut ? formatShortcut(element.shortcut) : undefined"
        @click="$emit('execute-action', element.action)"
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
import { type ToolbarConfig, type ToolbarAction } from "../types/toolbar";
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
</script>

