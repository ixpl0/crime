<template>
  <aside class="card min-h-0 bg-base-100 shadow-xl">
    <div class="card-body min-h-0 p-3">
      <div class="flex items-center justify-between gap-2">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-base-content/70">
          Задачи
        </h2>
        <div class="flex items-center gap-3">
          <button
            class="icon-btn text-base-content/40 hover:text-primary"
            type="button"
            tabindex="-1"
            :title="isDebugTodoPanelVisible ? 'Скрыть задачи Crime' : 'Показать задачи Crime'"
            @click="toggleDebugTodoPanel"
          >
            <Bug :size="14" :class="{ 'text-primary': isDebugTodoPanelVisible }" />
          </button>
          <button
            class="icon-btn text-base-content/40 hover:text-info"
            type="button"
            tabindex="-1"
            title="Hide todo panel"
            @click="toggleTodoPanelCollapse"
          >
            <EyeOff :size="14" />
          </button>
        </div>
      </div>
      <div class="todo-list-scroll mt-2 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
        <div
          v-for="todoDraftView in todoDraftViewItems"
          :key="`todo-draft-${todoDraftView.index}`"
          class="space-y-1 rounded-lg border border-transparent p-1 transition-colors"
          :class="{ 'border-primary/40 bg-primary/10': isActiveDropTarget(todoDraftView.index) }"
          @dragenter.prevent="handleTodoDragEnter(todoDraftView.index, $event)"
          @dragover.prevent="handleTodoDragOver(todoDraftView.index, $event)"
          @drop.prevent="handleTodoDrop(todoDraftView.index, $event)"
        >
          <textarea
            :value="todoDraftView.value"
            data-todo-textarea="true"
            :data-todo-index="todoDraftView.index"
            class="textarea textarea-autosize-native textarea-bordered h-auto max-h-38 min-h-0 w-full resize-none overflow-y-auto text-sm leading-relaxed"
            rows="1"
            placeholder="Промпт"
            @input="handleTodoTextareaInput(todoDraftView.index, $event)"
            @keydown="handleTodoTextareaKeydown"
            @blur="handleTodoTextareaBlur"
          />
          <div class="flex items-center gap-2">
            <button
              v-if="shouldShowTodoDragHandle(todoDraftView.index)"
              class="icon-btn cursor-grab text-base-content/40 hover:text-primary active:cursor-grabbing"
              type="button"
              tabindex="-1"
              :draggable="canDragTodoDraft(todoDraftView.index)"
              :disabled="!canDragTodoDraft(todoDraftView.index)"
              title="Drag to reorder"
              @dragstart="handleTodoDragStart(todoDraftView.index, $event)"
              @dragend="handleTodoDragEnd"
            >
              <GripVertical :size="14" />
            </button>
            <div class="ml-auto flex items-center gap-3">
              <button
                v-if="todoDraftView.index === todoDraftViewItems.length - 1"
                class="btn btn-ghost btn-xs normal-case text-base-content/70"
                type="button"
                tabindex="-1"
                :disabled="!todoDraftView.value.trim()"
                @click="confirmTodoEntry"
              >
                Создать задачу
              </button>
              <template v-else>
                <button
                  class="icon-btn text-base-content/40 hover:text-success"
                  type="button"
                  tabindex="-1"
                  title="Сохранить задачи"
                  @click="forcePersistTodoEntries"
                >
                  <Save :size="14" />
                </button>
                <button
                  class="icon-btn text-base-content/40 hover:text-error"
                  type="button"
                  tabindex="-1"
                  title="Удалить задачу"
                  @click="removeTodoEntry(todoDraftView.index)"
                >
                  <Trash2 :size="14" />
                </button>
                <button
                  class="btn btn-ghost btn-xs normal-case text-base-content/70"
                  type="button"
                  tabindex="-1"
                  :title="lastPrompt"
                  :disabled="!isTerminalReady || !todoDraftView.value.trim()"
                  @click="sendTodoEntryToTerminal(todoDraftView.index)"
                >
                  Отправить
                </button>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { Bug, EyeOff, GripVertical, Save, Trash2 } from "lucide-vue-next";
import { useAppTerminalStore } from "../terminal/terminal-store";
import { useAppTodoStore } from "../todo/todo-store";

const {
  todoDraftViewItems,
  todoDragSourceIndex,
  todoDragOverIndex,
  toggleTodoPanelCollapse,
  canDragTodoDraft,
  shouldShowTodoDragHandle,
  handleTodoDragStart,
  handleTodoDragEnter,
  handleTodoDragOver,
  handleTodoDragEnd,
  handleTodoDrop,
  handleTodoTextareaInput,
  handleTodoTextareaKeydown,
  handleTodoTextareaBlur,
  confirmTodoEntry,
  removeTodoEntry,
  forcePersistTodoEntries,
  sendTodoEntryToTerminal,
  isDebugTodoPanelVisible,
  toggleDebugTodoPanel
} = useAppTodoStore();
const { isTerminalReady, lastPrompt } = useAppTerminalStore();

function isActiveDropTarget(index: number) {
  return (
    todoDragOverIndex.value === index &&
    todoDragSourceIndex.value !== null &&
    todoDragSourceIndex.value !== index
  );
}
</script>

<style scoped>
.todo-list-scroll {
  overflow-anchor: none;
}
</style>
