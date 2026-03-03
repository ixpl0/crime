import {
  type ToolbarAction,
  type ToolbarConfig,
  type ToolbarElement
} from "../types/toolbar";

const MILLISECONDS_PER_DAY = 86_400_000;

const formatTrackingDatetime = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${String(year)}-${month}-${day} ${hours}:${minutes}`;
};

const updateTrackedAction = (
  action: ToolbarAction,
  now: Date
): ToolbarAction | null => {
  const updatedLastUsed =
    action.lastUsed !== undefined
      ? formatTrackingDatetime(now)
      : undefined;

  const updatedDone =
    action.done === false
      ? true
      : undefined;

  if (updatedLastUsed === undefined && updatedDone === undefined) {
    return null;
  }

  return {
    ...action,
    ...(updatedLastUsed !== undefined && { lastUsed: updatedLastUsed }),
    ...(updatedDone !== undefined && { done: updatedDone })
  };
};

interface TrackingUpdateResult<T> {
  readonly items: readonly T[];
  readonly changed: boolean;
}

const updateDropdownItemsTracking = (
  items: readonly ToolbarAction[],
  executedAction: ToolbarAction,
  now: Date
): TrackingUpdateResult<ToolbarAction> =>
  items.reduce<TrackingUpdateResult<ToolbarAction>>(
    (accumulator, item) => {
      if (item !== executedAction) {
        return { ...accumulator, items: [...accumulator.items, item] };
      }
      const updated = updateTrackedAction(item, now);
      return updated
        ? { items: [...accumulator.items, updated], changed: true }
        : { ...accumulator, items: [...accumulator.items, item] };
    },
    { items: [], changed: false }
  );

const updateElementTracking = (
  element: ToolbarElement,
  executedAction: ToolbarAction,
  now: Date
): { readonly element: ToolbarElement; readonly changed: boolean } => {
  if (!("items" in element)) {
    if (element !== executedAction) {
      return { element, changed: false };
    }
    const updated = updateTrackedAction(element, now);
    return updated
      ? { element: updated, changed: true }
      : { element, changed: false };
  }

  const updateResult = updateDropdownItemsTracking(element.items, executedAction, now);
  return updateResult.changed
    ? { element: { ...element, items: updateResult.items }, changed: true }
    : { element, changed: false };
};

export const applyToolbarActionTracking = (
  config: ToolbarConfig,
  executedAction: ToolbarAction
): ToolbarConfig | null => {
  const now = new Date();

  const updateResult = config.elements.reduce<{
    readonly elements: readonly ToolbarElement[];
    readonly changed: boolean;
  }>(
    (accumulator, element) => {
      const result = updateElementTracking(element, executedAction, now);
      return {
        elements: [...accumulator.elements, result.element],
        changed: accumulator.changed || result.changed
      };
    },
    { elements: [], changed: false }
  );

  return updateResult.changed ? { elements: updateResult.elements } : null;
};

export const isLastUsedWithinOneDay = (
  lastUsed: string,
  now: Date
): boolean => {
  const parsed = new Date(lastUsed.replace(" ", "T"));
  const diffMs = now.getTime() - parsed.getTime();
  return diffMs >= 0 && diffMs < MILLISECONDS_PER_DAY;
};

export const computeDaysSinceLastUsed = (
  lastUsed: string,
  now: Date
): number | null => {
  const parsed = new Date(lastUsed.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return Math.floor((now.getTime() - parsed.getTime()) / MILLISECONDS_PER_DAY);
};
