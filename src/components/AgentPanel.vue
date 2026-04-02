<template>
  <div class="flex min-h-0 flex-1 flex-col gap-4">
    <ToolbarPanel
      class="shrink-0"
      :toolbar-config="toolbarConfig"
      :is-terminal-ready="isTerminalReady"
      @execute-action="executeToolbarAction"
      @open-config-editor="openToolbarConfigEditor"
    />

    <div
      :ref="setTerminalContainer"
      class="terminal-host min-h-0 flex-1 overflow-hidden rounded-box border border-[var(--terminal-bg)] bg-[var(--terminal-bg)]"
      @click="focusTerminal"
      @contextmenu="handleTerminalCopyEvent"
      @auxclick="handleTerminalCopyEvent"
    />

    <form class="flex shrink-0 min-w-0 gap-3" @submit.prevent="sendTextareaToTerminal">
      <div class="flex min-w-0 flex-1 flex-col gap-2">
        <textarea
          :ref="setTerminalInputTextarea"
          :value="terminalInputText"
          class="textarea textarea-bordered w-full resize-none overflow-y-auto"
          rows="4"
          :disabled="!isTerminalReady"
          placeholder="Введите текст для отправки в терминал"
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
              Отправить
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
            @click="sendQuickKey(quickKey)"
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
  terminalInputText,
  quickKeyGridSlots,
  lastPrompt,
  setTerminalContainer,
  setTerminalInputTextarea,
  executeToolbarAction,
  focusTerminal,
  handleTerminalCopyEvent,
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
