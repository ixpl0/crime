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
        class="terminal-host w-full overflow-hidden rounded-box border border-[var(--terminal-bg)] bg-[var(--terminal-bg)]"
        :style="{ height: `${terminalPanelHeight}px` }"
        @click="focusTerminal"
        @contextmenu="handleTerminalContextMenu"
        @auxclick="handleTerminalAuxClick"
      />
      <button
        type="button"
        tabindex="-1"
        class="terminal-resize-handle group -mt-2 flex h-4 w-full touch-none cursor-ns-resize items-center justify-center border-0 bg-transparent p-0 focus-visible:outline-none"
        title="Потяните, чтобы изменить высоту терминала"
        aria-label="Изменить высоту терминала"
        @pointerdown="handleTerminalPanelResizePointerDown"
      >
        <span
          class="h-0.5 w-[60%] rounded-full transition-colors duration-150"
          :class="isTerminalPanelResizeActive ? 'bg-primary' : 'bg-transparent group-hover:bg-base-300'"
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
              tabindex="-1"
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
  sendQuickKey
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
.terminal-host :deep(.xterm) {
  border-radius: inherit;
}
</style>
