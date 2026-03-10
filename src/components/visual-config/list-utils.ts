export const moveItemUp = <T>(items: readonly T[], index: number): readonly T[] =>
  index <= 0
    ? items
    : [...items.slice(0, index - 1), items[index], items[index - 1], ...items.slice(index + 1)];

export const moveItemDown = <T>(items: readonly T[], index: number): readonly T[] =>
  index >= items.length - 1
    ? items
    : [...items.slice(0, index), items[index + 1], items[index], ...items.slice(index + 2)];

export const removeItem = <T>(items: readonly T[], index: number): readonly T[] =>
  items.filter((_, i) => i !== index);
