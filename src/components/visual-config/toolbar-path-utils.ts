import {
  type ToolbarAction,
  type ToolbarConfig,
  type ToolbarDropdown,
  type ToolbarElement
} from "../../types/toolbar";
import { moveItemDown, moveItemUp, removeItem } from "./list-utils";

export type ToolbarPath = readonly number[];

export const isDropdown = (element: ToolbarElement): element is ToolbarDropdown =>
  "items" in element;

export const getElementAt = (
  config: ToolbarConfig,
  path: ToolbarPath
): ToolbarElement | null => {
  if (path.length === 0) {
    return null;
  }
  const walk = (elements: readonly ToolbarElement[], depth: number): ToolbarElement | null => {
    const index = path[depth];
    if (index < 0 || index >= elements.length) {
      return null;
    }
    const current = elements[index];
    if (depth === path.length - 1) {
      return current;
    }
    if (!isDropdown(current)) {
      return null;
    }
    return walk(current.items, depth + 1);
  };
  return walk(config.elements, 0);
};

export const getSiblingsAt = (
  config: ToolbarConfig,
  path: ToolbarPath
): readonly ToolbarElement[] => {
  if (path.length === 0) {
    return [];
  }
  const walk = (elements: readonly ToolbarElement[], depth: number): readonly ToolbarElement[] => {
    if (depth === path.length - 1) {
      return elements;
    }
    const index = path[depth];
    if (index < 0 || index >= elements.length) {
      return [];
    }
    const current = elements[index];
    if (!isDropdown(current)) {
      return [];
    }
    return walk(current.items, depth + 1);
  };
  return walk(config.elements, 0);
};

const mapElementsAtPath = (
  elements: readonly ToolbarElement[],
  path: ToolbarPath,
  depth: number,
  transform: (list: readonly ToolbarElement[], index: number) => readonly ToolbarElement[]
): readonly ToolbarElement[] => {
  const targetIndex = path[depth];
  if (depth === path.length - 1) {
    return transform(elements, targetIndex);
  }
  return elements.map((element, index) => {
    if (index !== targetIndex) {
      return element;
    }
    if (!isDropdown(element)) {
      return element;
    }
    return { ...element, items: mapElementsAtPath(element.items, path, depth + 1, transform) };
  });
};

export const updateAt = (
  config: ToolbarConfig,
  path: ToolbarPath,
  updater: (element: ToolbarElement) => ToolbarElement
): ToolbarConfig => {
  if (path.length === 0) {
    return config;
  }
  const elements = mapElementsAtPath(config.elements, path, 0, (list, index) =>
    list.map((element, idx) => (idx === index ? updater(element) : element))
  );
  return { elements };
};

export const removeAt = (config: ToolbarConfig, path: ToolbarPath): ToolbarConfig => {
  if (path.length === 0) {
    return config;
  }
  const elements = mapElementsAtPath(config.elements, path, 0, (list, index) =>
    removeItem(list, index)
  );
  return { elements };
};

export const moveAt = (
  config: ToolbarConfig,
  path: ToolbarPath,
  direction: -1 | 1
): ToolbarConfig => {
  if (path.length === 0) {
    return config;
  }
  const elements = mapElementsAtPath(config.elements, path, 0, (list, index) =>
    direction === -1 ? moveItemUp(list, index) : moveItemDown(list, index)
  );
  return { elements };
};

export const appendInside = (
  config: ToolbarConfig,
  dropdownPath: ToolbarPath,
  newElement: ToolbarElement
): ToolbarConfig => {
  if (dropdownPath.length === 0) {
    return { elements: [...config.elements, newElement] };
  }
  return updateAt(config, dropdownPath, (element) => {
    if (!isDropdown(element)) {
      return element;
    }
    return { ...element, items: [...element.items, newElement] };
  });
};

export const pathStartsWith = (path: ToolbarPath, prefix: ToolbarPath): boolean => {
  if (prefix.length > path.length) {
    return false;
  }
  return prefix.every((value, index) => path[index] === value);
};

export const pathsEqual = (a: ToolbarPath, b: ToolbarPath): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

export const parentPath = (path: ToolbarPath): ToolbarPath => path.slice(0, -1);

export const lastIndex = (path: ToolbarPath): number => path[path.length - 1] ?? -1;

export const createDropdown = (): ToolbarDropdown => ({ label: "Новая группа", items: [] });

export const createAction = (): ToolbarAction => ({
  label: "Новая кнопка",
  value: "",
  type: "command"
});
