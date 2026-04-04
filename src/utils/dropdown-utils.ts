import { computed, nextTick, onBeforeUnmount, watch, type Ref } from "vue";

export const DROPDOWN_OPEN_KEYS = new Set(["Enter", " ", "ArrowDown"]);

/**
 * Position dropdown-content as position:fixed so it escapes overflow:hidden ancestors.
 * Call this right after opening the dropdown.
 */
export const positionFixedDropdown = (triggerElement: EventTarget | null): void => {
  if (!(triggerElement instanceof HTMLElement)) {
    return;
  }

  const dropdown = triggerElement.closest(".manual-dropdown");
  if (!dropdown) {
    return;
  }

  const content = dropdown.querySelector<HTMLElement>(":scope > .dropdown-content");
  if (!content) {
    return;
  }

  const triggerRect = triggerElement.getBoundingClientRect();
  const isEnd = dropdown.classList.contains("dropdown-end");

  content.style.position = "fixed";
  content.style.top = `${String(triggerRect.bottom)}px`;
  content.style.bottom = "auto";
  content.style.translate = "none";
  content.style.insetInlineEnd = "auto";

  if (isEnd) {
    content.style.left = "auto";
    content.style.right = `${String(window.innerWidth - triggerRect.right)}px`;
  } else {
    content.style.left = `${String(triggerRect.left)}px`;
    content.style.right = "auto";
  }
};

export const focusFirstDropdownItem = (triggerTarget: EventTarget | null): void => {
  const trigger = triggerTarget instanceof HTMLElement ? triggerTarget : null;
  const dropdownRoot = trigger?.closest(".manual-dropdown");
  const firstItem = dropdownRoot?.querySelector<HTMLButtonElement>(
    ".dropdown-content button:not(:disabled)"
  );
  if (!firstItem) {
    return;
  }

  void nextTick(() => {
    firstItem.focus();
  });
};

const DROPDOWN_OPEN_SELECTOR = ".manual-dropdown.dropdown-open";

/**
 * Creates a transparent full-window backdrop with `-webkit-app-region: no-drag`
 * so that click-outside works even when the click lands on a drag-region area.
 * The backdrop sits below dropdown-content (z-10) and context-menus (z-50).
 */
export const useDragRegionBackdrop = (
  isVisible: Ref<boolean>,
  onBackdropClick: () => void
): void => {
  let backdrop: HTMLElement | null = null;

  const createBackdrop = () => {
    backdrop = document.createElement("div");
    backdrop.style.cssText = "position:fixed;inset:0;z-index:8;-webkit-app-region:no-drag;";
    backdrop.addEventListener("mousedown", onBackdropClick);
    document.body.appendChild(backdrop);
  };

  const removeBackdrop = () => {
    if (backdrop) {
      backdrop.remove();
      backdrop = null;
    }
  };

  watch(isVisible, (visible) => {
    if (visible) {
      createBackdrop();
    } else {
      removeBackdrop();
    }
  });

  onBeforeUnmount(removeBackdrop);
};

export const useDropdownClickOutside = (
  isOpen: Ref<boolean>,
  close: () => void
): void => {
  const handleDocumentMousedown = (event: MouseEvent) => {
    const target = event.target;
    if (target instanceof Element && target.closest(DROPDOWN_OPEN_SELECTOR)) {
      return;
    }
    close();
  };

  useDragRegionBackdrop(isOpen, close);

  watch(isOpen, (open) => {
    if (open) {
      document.addEventListener("mousedown", handleDocumentMousedown);
    } else {
      document.removeEventListener("mousedown", handleDocumentMousedown);
    }
  });

  onBeforeUnmount(() => {
    document.removeEventListener("mousedown", handleDocumentMousedown);
  });
};

/**
 * Creates a computed boolean from a nullable ref and wires up a drag-region backdrop.
 * Use this for context menus where the state is `Ref<T | null>`.
 */
export const useContextMenuDragRegionBackdrop = <T>(
  contextMenu: Ref<T | null>,
  close: () => void
): void => {
  const isOpen = computed(() => contextMenu.value !== null);
  useDragRegionBackdrop(isOpen, close);
};
