<template>
  <div class="flex items-center gap-2">
    <span v-if="label" class="text-sm whitespace-nowrap">{{ label }}</span>
    <button
      ref="triggerRef"
      type="button"
      class="btn btn-sm btn-ghost gap-1"
      tabindex="-1"
      @click="handleToggle"
    >
      <component v-if="selectedIcon" :is="selectedIcon" :size="16" />
      <span class="text-xs">{{ modelValue ?? '(нет)' }}</span>
      <ChevronDown :size="12" />
    </button>

    <Teleport to="body">
      <div
        v-if="isOpen"
        ref="popoverRef"
        class="fixed z-50 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg"
        :style="popoverStyle"
      >
        <input
          ref="searchInputRef"
          v-model="searchQuery"
          type="text"
          class="input input-bordered input-sm mb-2 w-full"
          placeholder="Поиск иконки..."
          tabindex="-1"
        />
        <div ref="scrollContainerRef" class="grid max-h-64 w-72 grid-cols-9 gap-1 overflow-y-auto">
          <button
            type="button"
            class="flex items-center justify-center rounded p-1.5 text-base-content/40 hover:bg-base-200 hover:text-base-content"
            tabindex="-1"
            title="(нет)"
            @click="selectIcon(undefined)"
          >
            <X :size="16" />
          </button>
          <button
            v-for="name in visibleIcons"
            :key="name"
            type="button"
            class="flex items-center justify-center rounded p-1.5 hover:bg-base-200"
            :class="name === modelValue ? 'bg-primary/20 text-primary' : 'text-base-content/70 hover:text-base-content'"
            tabindex="-1"
            :title="name"
            @click="selectIcon(name)"
          >
            <component :is="resolveLucideIcon(name)" :size="16" />
          </button>
          <div ref="sentinelRef" class="col-span-full h-1" />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, type CSSProperties, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { ChevronDown, X } from "lucide-vue-next";
import { resolveLucideIcon, lucideIconNames } from "../../toolbar/toolbar-icons";

const BATCH_SIZE = 90;
const POPOVER_WIDTH = 308;
const POPOVER_MARGIN = 8;

const props = withDefaults(defineProps<{
  label?: string;
  modelValue?: string;
}>(), {
  label: "",
  modelValue: undefined
});

const emit = defineEmits<{
  "update:modelValue": [value: string | undefined];
}>();

const isOpen = ref(false);
const searchQuery = ref("");
const searchInputRef = ref<HTMLInputElement | null>(null);
const triggerRef = ref<HTMLElement | null>(null);
const popoverRef = ref<HTMLElement | null>(null);
const scrollContainerRef = ref<HTMLElement | null>(null);
const sentinelRef = ref<HTMLElement | null>(null);
const visibleCount = ref(BATCH_SIZE);
const popoverStyle = ref<CSSProperties>({});

const selectedIcon = computed(() => resolveLucideIcon(props.modelValue));

const filteredIcons = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) {
    return lucideIconNames;
  }
  return lucideIconNames.filter((name) => name.toLowerCase().includes(query));
});

const visibleIcons = computed(() =>
  filteredIcons.value.slice(0, visibleCount.value)
);

const loadMore = () => {
  if (visibleCount.value < filteredIcons.value.length) {
    visibleCount.value = visibleCount.value + BATCH_SIZE;
  }
};

let observer: IntersectionObserver | null = null;

const setupObserver = () => {
  cleanupObserver();
  if (!sentinelRef.value || !scrollContainerRef.value) {
    return;
  }
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        loadMore();
      }
    },
    { root: scrollContainerRef.value, rootMargin: "100px" }
  );
  observer.observe(sentinelRef.value);
};

const cleanupObserver = () => {
  observer?.disconnect();
  observer = null;
};

const computePosition = () => {
  if (!triggerRef.value) {
    return;
  }
  const rect = triggerRef.value.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const openAbove = spaceBelow < 300 && rect.top > spaceBelow;

  const left = Math.min(rect.left, window.innerWidth - POPOVER_WIDTH - POPOVER_MARGIN);

  if (openAbove) {
    popoverStyle.value = {
      left: `${String(Math.max(POPOVER_MARGIN, left))}px`,
      bottom: `${String(window.innerHeight - rect.top + 4)}px`,
    };
  } else {
    popoverStyle.value = {
      left: `${String(Math.max(POPOVER_MARGIN, left))}px`,
      top: `${String(rect.bottom + 4)}px`,
    };
  }
};

const handleToggle = () => {
  isOpen.value = !isOpen.value;
};

const handleOutsideClick = (event: MouseEvent) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }
  if (triggerRef.value?.contains(target) || popoverRef.value?.contains(target)) {
    return;
  }
  isOpen.value = false;
};

const selectIcon = (name: string | undefined) => {
  emit("update:modelValue", name);
  isOpen.value = false;
  searchQuery.value = "";
};

watch(isOpen, async (open) => {
  if (open) {
    visibleCount.value = BATCH_SIZE;
    computePosition();
    await nextTick();
    searchInputRef.value?.focus();
    setupObserver();
    document.addEventListener("mousedown", handleOutsideClick);
  } else {
    cleanupObserver();
    document.removeEventListener("mousedown", handleOutsideClick);
  }
});

watch(searchQuery, () => {
  visibleCount.value = BATCH_SIZE;
});

watch(sentinelRef, (el) => {
  if (el && isOpen.value) {
    setupObserver();
  }
});

onBeforeUnmount(() => {
  cleanupObserver();
  document.removeEventListener("mousedown", handleOutsideClick);
});
</script>
