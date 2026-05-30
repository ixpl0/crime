<template>
  <div
    class="dropdown manual-dropdown flex items-center"
    :class="{ 'dropdown-open': isHiddenPanelsDropdownOpen }"
  >
    <button
      ref="triggerRef"
      type="button"
      class="icon-btn text-base-content/40 hover:text-info"
      tabindex="-1"
      :aria-expanded="isHiddenPanelsDropdownOpen"
      title="Видимость панелей"
      @click="handleDropdownClick"
      @keydown="handleDropdownKeydown"
    >
      <Eye :size="14" />
    </button>
    <Teleport to="body">
      <ul
        v-show="isHiddenPanelsDropdownOpen"
        ref="contentRef"
        class="menu bg-base-100 rounded-box z-10 w-56 p-1 shadow"
        @mousedown.stop
        @keydown.esc.stop.prevent="setHiddenPanelsDropdownOpen(false)"
      >
        <li v-for="panelOption in panelVisibilityOptions" :key="panelOption.id">
          <button
            type="button"
            class="flex items-center justify-between gap-3"
            tabindex="-1"
            @click="togglePanelVisibility(panelOption.id)"
          >
            <span>{{ panelOption.title }}</span>
            <component
              :is="panelVisibilityIcon(panelOption.isVisible)"
              :size="14"
              :class="panelOption.isVisible ? 'text-success' : 'text-base-content/40'"
            />
          </button>
        </li>
      </ul>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { Eye, EyeOff } from "lucide-vue-next";
import { useAppNavigationStore } from "../navigation/navigation-store";

const {
  isHiddenPanelsDropdownOpen,
  panelVisibilityOptions,
  toggleHiddenPanelsDropdown,
  handleHiddenPanelsDropdownTriggerKeydown,
  setHiddenPanelsDropdownOpen,
  togglePanelVisibility
} = useAppNavigationStore();

const triggerRef = ref<HTMLElement | null>(null);
const contentRef = ref<HTMLElement | null>(null);

const panelVisibilityIcon = (isVisible: boolean) => (isVisible ? Eye : EyeOff);

const positionDropdownContent = () => {
  const trigger = triggerRef.value;
  const content = contentRef.value;
  if (!trigger || !content) {
    return;
  }
  const rect = trigger.getBoundingClientRect();
  content.style.position = "fixed";
  content.style.top = `${String(rect.bottom)}px`;
  content.style.left = `${String(rect.left)}px`;
  content.style.right = "auto";
};

const handleDropdownClick = () => {
  toggleHiddenPanelsDropdown();
  if (isHiddenPanelsDropdownOpen.value) {
    positionDropdownContent();
  }
};

const handleDropdownKeydown = (event: KeyboardEvent) => {
  handleHiddenPanelsDropdownTriggerKeydown(event);
  if (isHiddenPanelsDropdownOpen.value) {
    positionDropdownContent();
  }
};
</script>
