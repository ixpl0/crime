<template>
  <aside class="card min-h-0 bg-base-100 shadow-sm">
    <div class="card-body min-h-0 p-3">
      <div class="flex items-center justify-between gap-2">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-base-content/70">
          Задачи Crime
        </h2>
        <button
          class="icon-btn text-base-content/40 hover:text-info"
          type="button"
          tabindex="-1"
          title="Скрыть панель задач Crime"
          @click="hidePanel"
        >
          <EyeOff :size="14" />
        </button>
      </div>
      <div class="debug-todo-list-scroll mt-2 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
        <div
          v-for="todoDraftView in todoDraftViewItems"
          :key="`debug-todo-draft-${todoDraftView.index}`"
          class="space-y-1 rounded-lg border border-transparent transition-colors"
          :data-debug-todo-textarea-drop="todoDraftView.index"
          :class="{ 'border-primary/40 bg-primary/10': isActiveDropTarget(todoDraftView.index) }"
        >
          <textarea
            :value="todoDraftView.value"
            data-debug-todo-textarea="true"
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
              class="icon-btn cursor-grab! text-base-content/40 hover:text-primary"
              type="button"
              tabindex="-1"
              title="Перетащите для сортировки"
              @mousedown="handleTodoGripMouseDown(todoDraftView.index, $event)"
            >
              <GripVertical :size="14" />
            </button>
            <div class="ml-auto flex items-center gap-3">
              <template v-if="todoDraftView.index !== todoDraftViewItems.length - 1">
                <button
                  class="icon-btn text-base-content/40 hover:text-success"
                  type="button"
                  tabindex="-1"
                  title="Сохранить задачу"
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
              </template>
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
            </div>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { EyeOff, GripVertical, Save, Trash2 } from "lucide-vue-next";
import { useDebugTodoStore } from "../todo/debug-todo-store";

const {
  todoDraftViewItems,
  todoDragSourceIndex,
  todoDragOverIndex,
  shouldShowTodoDragHandle,
  handleTodoGripMouseDown,
  handleTodoTextareaInput,
  handleTodoTextareaKeydown,
  handleTodoTextareaBlur,
  confirmTodoEntry,
  removeTodoEntry,
  forcePersistTodoEntries,
  hidePanel
} = useDebugTodoStore();

const isActiveDropTarget = (index: number) =>
  todoDragOverIndex.value === index &&
  todoDragSourceIndex.value !== null &&
  todoDragSourceIndex.value !== index;
</script>

<style scoped>
.debug-todo-list-scroll {
  overflow-anchor: none;
}
</style>
