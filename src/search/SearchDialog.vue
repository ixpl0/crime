<template>
  <dialog ref="dialogElement" class="modal items-start" @close="handleDialogClose">
    <div class="modal-box mt-[10vh] max-w-2xl p-0">
      <div class="flex items-center gap-3 border-b border-base-300 px-4 py-3">
        <Search :size="16" class="shrink-0 text-base-content/40" />
        <input
          ref="inputElement"
          v-model="query"
          type="text"
          class="w-full bg-transparent text-sm outline-none placeholder:text-base-content/30"
          :placeholder="searchMode === 'names' ? 'Имя файла или папки...' : 'Текст в файлах...'"
          @keydown.escape="closeSearchDialog"
          @keydown.arrow-down.prevent="moveSelection(1)"
          @keydown.arrow-up.prevent="moveSelection(-1)"
          @keydown.enter.prevent="confirmSelection"
        />
      </div>

      <div class="flex items-center gap-1 border-b border-base-300 px-4 py-1.5">
        <button
          type="button"
          class="btn btn-xs"
          tabindex="-1"
          :class="searchMode === 'names' ? 'btn-primary' : 'btn-ghost'"
          @click="setSearchMode('names')"
        >
          Имена файлов
        </button>
        <button
          type="button"
          class="btn btn-xs"
          tabindex="-1"
          :class="searchMode === 'content' ? 'btn-primary' : 'btn-ghost'"
          @click="setSearchMode('content')"
        >
          В файлах
        </button>
        <label
          tabindex="-1"
          class="label ml-auto inline-flex h-8 cursor-pointer select-none items-center gap-2 rounded-btn px-2 py-0 whitespace-nowrap hover:bg-base-100/60"
          @click.prevent="toggleIncludeIgnored"
        >
          <span
            class="flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold leading-none"
            :class="includeIgnored
              ? 'border-success bg-success/20 text-success'
              : 'border-base-content/30'"
          >
            <template v-if="includeIgnored">✓</template>
          </span>
          <span class="label-text text-xs">Игнорируемые</span>
        </label>
      </div>

      <div class="relative max-h-[50vh] overflow-y-auto">
        <div
          v-if="showSpinner"
          class="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-center py-6"
        >
          <span class="loading loading-spinner loading-sm" />
        </div>

        <div
          v-if="hasQuery && !showSpinner && currentResultCount === 0"
          class="px-4 py-6 text-center text-sm text-base-content/40"
        >
          Ничего не найдено
        </div>

        <template v-if="searchMode === 'names'">
          <button
            v-for="(result, index) in fileResults"
            :key="result.relativePath"
            :ref="(element) => setResultRef(index, element)"
            type="button"
            class="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm transition-colors hover:bg-base-200"
            :class="{ 'bg-base-200': index === selectedIndex }"
            tabindex="-1"
            @click="openFileResult(result)"
            @mouseenter="selectedIndex = index"
          >
            <component :is="result.isDirectory ? Folder : File" :size="14" class="shrink-0 text-base-content/40" />
            <span class="min-w-0 truncate">
              <span class="font-medium">{{ getBasename(result.relativePath) }}</span>
              <span class="ml-2 text-xs text-base-content/40">{{ getDirectory(result.relativePath) }}</span>
            </span>
          </button>
        </template>

        <template v-if="searchMode === 'content'">
          <button
            v-for="(result, index) in contentResults"
            :key="`${result.relativePath}:${result.line}`"
            :ref="(element) => setResultRef(index, element)"
            type="button"
            class="flex w-full flex-col gap-0.5 px-4 py-2 text-left transition-colors hover:bg-base-200"
            :class="{ 'bg-base-200': index === selectedIndex }"
            tabindex="-1"
            @click="openContentResult(result)"
            @mouseenter="selectedIndex = index"
          >
            <span class="flex items-center gap-2 text-sm">
              <File :size="14" class="shrink-0 text-base-content/40" />
              <span class="min-w-0 truncate font-medium">{{ result.relativePath }}</span>
              <span class="shrink-0 text-xs text-base-content/40">:{{ result.line }}</span>
            </span>
            <span class="truncate pl-[22px] text-xs text-base-content/50">{{ result.text.trim() }}</span>
          </button>
        </template>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button tabindex="-1">close</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch, type ComponentPublicInstance } from "vue";
import { File, Folder, Search } from "lucide-vue-next";
import { useSearchDialogStore, type SearchMode } from "./search-dialog-store";
import { useFileSearch } from "./use-file-search";
import { useAppNavigationStore } from "../navigation/navigation-store";

const props = defineProps<{
  projectPath: string;
}>();

const { isOpen, pendingMode, closeSearchDialog, openSearchDialog } = useSearchDialogStore();
const { navigateToFile, navigateToDirectory } = useAppNavigationStore();

const dialogElement = ref<HTMLDialogElement | null>(null);
const inputElement = ref<HTMLInputElement | null>(null);
const searchMode = ref<SearchMode>("names");
const includeIgnored = ref(false);

const projectPathRef = computed(() => props.projectPath);

const {
  query, selectedIndex, showSpinner, hasQuery,
  currentResultCount, fileResults, contentResults,
  scheduleSearch, performSearch, resetSearchState
} = useFileSearch({ projectPath: projectPathRef, searchMode, includeIgnored });

const resultElements = new Map<number, HTMLElement>();

const setResultRef = (index: number, element: Element | ComponentPublicInstance | null) => {
  if (element instanceof HTMLElement) {
    resultElements.set(index, element);
  } else {
    resultElements.delete(index);
  }
};

const getBasename = (path: string): string => {
  const lastSlash = path.lastIndexOf("/");
  return lastSlash >= 0 ? path.substring(lastSlash + 1) : path;
};

const getDirectory = (path: string): string => {
  const lastSlash = path.lastIndexOf("/");
  return lastSlash >= 0 ? path.substring(0, lastSlash) : "";
};

const scrollSelectedIntoView = () => {
  const element = resultElements.get(selectedIndex.value);
  element?.scrollIntoView({ block: "nearest" });
};

const moveSelection = (delta: number) => {
  if (currentResultCount.value === 0) {
    return;
  }

  selectedIndex.value = (selectedIndex.value + delta + currentResultCount.value) % currentResultCount.value;
  void nextTick(scrollSelectedIntoView);
};

const toAbsolutePath = (relativePath: string): string => {
  const separator = props.projectPath.includes("\\") ? "\\" : "/";
  return `${props.projectPath}${separator}${relativePath.replace(/\//g, separator)}`;
};

const openFileResult = (result: FileSearchResult) => {
  closeSearchDialog();
  const absolutePath = toAbsolutePath(result.relativePath);
  if (result.isDirectory) {
    navigateToDirectory(absolutePath);
  } else {
    navigateToFile(absolutePath);
  }
};

const openContentResult = (result: ContentSearchResult) => {
  closeSearchDialog();
  navigateToFile(toAbsolutePath(result.relativePath), result.line);
};

const confirmSelection = () => {
  if (searchMode.value === "names" && selectedIndex.value < fileResults.value.length) {
    openFileResult(fileResults.value[selectedIndex.value]);
  } else if (searchMode.value === "content" && selectedIndex.value < contentResults.value.length) {
    openContentResult(contentResults.value[selectedIndex.value]);
  }
};

const setSearchMode = (mode: SearchMode) => {
  searchMode.value = mode;
  selectedIndex.value = 0;
  void performSearch(query.value, mode);
  void nextTick(() => { inputElement.value?.focus(); });
};

const toggleIncludeIgnored = () => {
  includeIgnored.value = !includeIgnored.value;
  if (query.value.trim().length > 0) {
    void performSearch(query.value, searchMode.value);
  }
};

const handleGlobalKeydown = (event: KeyboardEvent) => {
  const isModifierActive = event.ctrlKey || event.metaKey;
  if (event.code === "KeyF" && isModifierActive && !event.altKey) {
    event.preventDefault();
    event.stopPropagation();
    openSearchDialog(event.shiftKey ? "content" : "names");
  }
};

watch(query, scheduleSearch);

watch(isOpen, (open) => {
  if (open) {
    if (pendingMode.value !== null) {
      searchMode.value = pendingMode.value;
    }
    dialogElement.value?.showModal();
    void nextTick(() => { inputElement.value?.focus(); });
  } else {
    dialogElement.value?.close();
  }
});

const handleDialogClose = () => {
  if (isOpen.value) {
    closeSearchDialog();
  }
  resetSearchState();
  resultElements.clear();
};

onMounted(() => { window.addEventListener("keydown", handleGlobalKeydown, true); });
onUnmounted(() => { window.removeEventListener("keydown", handleGlobalKeydown, true); });
</script>
