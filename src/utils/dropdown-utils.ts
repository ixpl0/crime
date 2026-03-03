import { nextTick } from "vue";

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
