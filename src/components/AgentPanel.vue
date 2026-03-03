<template>
  <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
    <ToolbarPanel
      :toolbar-config="toolbarConfig"
      :is-terminal-ready="isTerminalReady"
      @execute-action="executeToolbarAction"
      @open-config-editor="openToolbarConfigEditor"
    />

    <div>
      <div
        :ref="setTerminalContainer"
        class="terminal-host w-full overflow-hidden rounded-box border border-[#05070d] bg-[#05070d]"
        :style="{ height: `${terminalPanelHeight}px` }"
        @click="focusTerminal"
        @contextmenu="handleTerminalContextMenu"
        @auxclick="handleTerminalAuxClick"
      />
      <button
        type="button"
        tabindex="-1"
        class="terminal-resize-handle group relative -mt-[6px] flex h-3 w-full cursor-ns-resize items-center justify-center border-0 bg-transparent p-0"
        title="&#1055;&#1086;&#1090;&#1103;&#1085;&#1080;&#1090;&#1077;, &#1095;&#1090;&#1086;&#1073;&#1099; &#1080;&#1079;&#1084;&#1077;&#1085;&#1080;&#1090;&#1100; &#1074;&#1099;&#1089;&#1086;&#1090;&#1091; &#1090;&#1077;&#1088;&#1084;&#1080;&#1085;&#1072;&#1083;&#1072;"
        aria-label="&#1048;&#1079;&#1084;&#1077;&#1085;&#1080;&#1090;&#1100; &#1074;&#1099;&#1089;&#1086;&#1090;&#1091; &#1090;&#1077;&#1088;&#1084;&#1080;&#1085;&#1072;&#1083;&#1072;"
        @pointerdown="handleTerminalPanelResizePointerDown"
      >
        <span
          class="h-1 w-[17%] rounded-full transition-colors duration-150"
          :class="
            isTerminalPanelResizeActive
              ? 'bg-[#6b7280]'
              : 'bg-[#374151] group-hover:bg-[#4b5563] group-focus-visible:bg-[#4b5563]'
          "
        />
      </button>
    </div>

    <form class="flex min-w-0 gap-3" @submit.prevent="sendTextareaToTerminal">
      <div class="flex min-w-0 flex-1 flex-col gap-2">
        <textarea
          :ref="setTerminalInputTextarea"
          :value="terminalInputText"
          class="textarea textarea-autosize-native textarea-bordered h-auto max-h-38 min-h-0 w-full resize-none overflow-y-auto"
          rows="1"
          :disabled="!isTerminalReady"
          placeholder="&#1042;&#1074;&#1077;&#1076;&#1080;&#1090;&#1077; &#1090;&#1077;&#1082;&#1089;&#1090; &#1076;&#1083;&#1103; &#1086;&#1090;&#1087;&#1088;&#1072;&#1074;&#1082;&#1080; &#1074; &#1090;&#1077;&#1088;&#1084;&#1080;&#1085;&#1072;&#1083;"
          @keydown="handleTextareaKeydown"
          @input="handleTerminalInput"
          @paste="handleTextareaPaste"
        />
        <div class="flex min-w-0 items-start gap-2">
          <PromptSuffixPanel
            class="min-w-0 flex-1"
            :suffix-config="promptSuffixConfig"
            @toggle-suffix="handlePromptSuffixToggle"
            @open-config-editor="openPromptSuffixConfigEditor"
          />
          <div :title="lastPrompt" class="shrink-0 self-start">
            <button
              class="btn btn-sm"
              type="submit"
              :disabled="!isTerminalReady || !terminalInputText.trim()"
            >
              &#1054;&#1090;&#1087;&#1088;&#1072;&#1074;&#1080;&#1090;&#1100;
            </button>
          </div>
        </div>
      </div>

      <div class="grid shrink-0 grid-cols-4 gap-1 self-start">
        <template v-for="(quickKey, index) in quickKeyGridSlots" :key="`quick-key-${index}`">
          <button
            v-if="quickKey"
            type="button"
            tabindex="-1"
            class="btn btn-sm min-w-0 px-2"
            :disabled="!isTerminalReady"
            :title="quickKey.accelerator"
            @mousedown.prevent="focusTextarea"
            @click="sendQuickKey(quickKey.input)"
          >
            <ArrowUp v-if="quickKey.icon === 'arrow-up'" :size="14" />
            <ArrowDown v-else-if="quickKey.icon === 'arrow-down'" :size="14" />
            <ArrowLeft v-else-if="quickKey.icon === 'arrow-left'" :size="14" />
            <ArrowRight v-else-if="quickKey.icon === 'arrow-right'" :size="14" />
            <CornerDownLeft v-else-if="quickKey.icon === 'enter'" :size="14" />
            <template v-else>{{ quickKey.label }}</template>
          </button>
          <span v-else />
        </template>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CornerDownLeft
} from "lucide-vue-next";
import { useAppConfigStore } from "../config/config-store";
import { useAppTerminalStore } from "../terminal/terminal-store";
import PromptSuffixPanel from "./PromptSuffixPanel.vue";
import ToolbarPanel from "./ToolbarPanel.vue";

const {
  toolbarConfig,
  promptSuffixConfig,
  openToolbarConfigEditor,
  openPromptSuffixConfigEditor,
  handlePromptSuffixToggle
} = useAppConfigStore();
const {
  isTerminalReady,
  terminalPanelHeight,
  isTerminalPanelResizeActive,
  terminalInputText,
  quickKeyGridSlots,
  lastPrompt,
  setTerminalContainer,
  setTerminalInputTextarea,
  executeToolbarAction,
  focusTerminal,
  handleTerminalContextMenu,
  handleTerminalAuxClick,
  handleTerminalPanelResizePointerDown,
  setTerminalInputText,
  handleTextareaKeydown,
  handleTextareaInput,
  handleTextareaPaste,
  sendTextareaToTerminal,
  sendQuickKey,
  focusTextarea
} = useAppTerminalStore();

function handleTerminalInput(event: Event) {
  const target = event.currentTarget;
  if (target instanceof HTMLTextAreaElement) {
    setTerminalInputText(target.value);
  }
  handleTextareaInput(event);
}
</script>

<style scoped>
.terminal-resize-handle {
  touch-action: none;
}

.terminal-resize-handle:focus-visible {
  outline: none;
}

.terminal-host :deep(.xterm) {
  border-radius: inherit;
}
</style>
