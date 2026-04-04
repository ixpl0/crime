import { ref } from "vue";
import {
  type ToolbarAction,
  type ToolbarButtonColor,
  type ToolbarConfig,
  type ToolbarDropdown,
  type ToolbarElement
} from "../../types/toolbar";
import { moveItemUp, moveItemDown, removeItem } from "./list-utils";

export const isDropdown = (element: ToolbarElement): element is ToolbarDropdown =>
  "items" in element;

export const useExpandState = () => {
  const expandedKeys = ref<Set<string>>(new Set());

  const toggleKey = (key: string) => {
    const next = new Set(expandedKeys.value);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    expandedKeys.value = next;
  };

  const eKey = (i: number) => `e-${String(i)}`;
  const iKey = (ei: number, ii: number) => `i-${String(ei)}-${String(ii)}`;
  const sKey = (ei: number, ii: number, si: number) => `s-${String(ei)}-${String(ii)}-${String(si)}`;

  return {
    isExpanded: (index: number) => expandedKeys.value.has(eKey(index)),
    isExpandedItem: (ei: number, ii: number) => expandedKeys.value.has(iKey(ei, ii)),
    isExpandedSubItem: (ei: number, ii: number, si: number) => expandedKeys.value.has(sKey(ei, ii, si)),
    toggleExpand: (index: number) => { toggleKey(eKey(index)); },
    toggleExpandItem: (ei: number, ii: number) => { toggleKey(iKey(ei, ii)); },
    toggleExpandSubItem: (ei: number, ii: number, si: number) => { toggleKey(sKey(ei, ii, si)); }
  };
};

export const useElementMutations = (
  getConfig: () => ToolbarConfig,
  emitConfig: (config: ToolbarConfig) => void
) => {
  const emitElements = (elements: readonly ToolbarElement[]) => { emitConfig({ elements }); };

  const updateElement = (index: number, updater: (el: ToolbarElement) => ToolbarElement) => {
    emitElements(getConfig().elements.map((el, i) => (i === index ? updater(el) : el)));
  };

  return {
    emitElements,
    updateElement,
    updateElementLabel: (i: number, label: string) => { updateElement(i, (el) => ({ ...el, label })); },
    updateElementColor: (i: number, color: string | undefined) => {
      updateElement(i, (el) => ({ ...el, color: color as ToolbarButtonColor | undefined }));
    },
    updateStandaloneAction: (i: number, action: ToolbarAction) => {
      emitElements(getConfig().elements.map((el, idx) => (idx === i ? action : el)));
    },
    handleMoveElementUp: (i: number) => { emitElements(moveItemUp(getConfig().elements, i)); },
    handleMoveElementDown: (i: number) => { emitElements(moveItemDown(getConfig().elements, i)); },
    handleRemoveElement: (i: number) => { emitElements(removeItem(getConfig().elements, i)); },
    handleAddDropdown: () => { emitElements([...getConfig().elements, { label: "Новая группа", items: [] }]); },
    handleAddAction: () => { emitElements([...getConfig().elements, { label: "Новая кнопка", value: "", type: "command" as const }]); }
  };
};

export const useItemMutations = (
  updateElement: (index: number, updater: (el: ToolbarElement) => ToolbarElement) => void
) => {
  const updateDropdownItems = (ei: number, updater: (items: readonly ToolbarElement[]) => readonly ToolbarElement[]) => {
    updateElement(ei, (el) => isDropdown(el) ? { ...el, items: updater(el.items) } : el);
  };

  return {
    updateItem: (ei: number, ii: number, action: ToolbarAction) => {
      updateDropdownItems(ei, (items) => items.map((item, i) => (i === ii ? action : item)));
    },
    updateItemLabel: (ei: number, ii: number, label: string) => {
      updateDropdownItems(ei, (items) => items.map((item, i) => (i === ii ? { ...item, label } : item)));
    },
    handleMoveItem: (ei: number, ii: number, dir: -1 | 1) => {
      updateDropdownItems(ei, (items) => (dir === -1 ? moveItemUp : moveItemDown)(items, ii));
    },
    handleRemoveItem: (ei: number, ii: number) => { updateDropdownItems(ei, (items) => removeItem(items, ii)); },
    handleAddItem: (ei: number) => {
      updateDropdownItems(ei, (items) => [...items, { label: "Новое действие", value: "", type: "command" as const }]);
    },
    handleAddSubDropdown: (ei: number) => {
      updateDropdownItems(ei, (items) => [...items, { label: "Новая подгруппа", items: [] } as ToolbarDropdown]);
    }
  };
};

export const useSubItemMutations = (
  updateElement: (index: number, updater: (el: ToolbarElement) => ToolbarElement) => void
) => {
  const updateDropdownItem = (ei: number, ii: number, updater: (dd: ToolbarDropdown) => ToolbarDropdown) => {
    updateElement(ei, (el) => {
      if (!isDropdown(el)) {
        return el;
      }
      return { ...el, items: el.items.map((item, i) => (i === ii && isDropdown(item) ? updater(item) : item)) };
    });
  };

  return {
    updateSubItem: (ei: number, ii: number, si: number, action: ToolbarAction) => {
      updateDropdownItem(ei, ii, (dd) => ({ ...dd, items: dd.items.map((s, i) => (i === si ? action : s)) }));
    },
    handleMoveSubItem: (ei: number, ii: number, si: number, dir: -1 | 1) => {
      updateDropdownItem(ei, ii, (dd) => ({ ...dd, items: (dir === -1 ? moveItemUp : moveItemDown)(dd.items, si) }));
    },
    handleRemoveSubItem: (ei: number, ii: number, si: number) => {
      updateDropdownItem(ei, ii, (dd) => ({ ...dd, items: removeItem(dd.items, si) }));
    },
    handleAddSubItem: (ei: number, ii: number) => {
      updateDropdownItem(ei, ii, (dd) => ({ ...dd, items: [...dd.items, { label: "Новое действие", value: "", type: "command" as const }] }));
    }
  };
};
