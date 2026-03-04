import { nextTick, onBeforeUnmount, watch, type Ref } from "vue";

export const DROPDOWN_OPEN_KEYS = new Set(["Enter", " ", "ArrowDown"]);

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
