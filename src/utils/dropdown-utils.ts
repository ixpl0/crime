import { nextTick, onBeforeUnmount, watch, type Ref } from "vue";

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
