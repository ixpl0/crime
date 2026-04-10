import type { ToolbarAction, ToolbarConfig, ToolbarElement } from "../types/toolbar";

const getActionTrackingKey = (action: ToolbarAction): string =>
  action.type === "scenario" ? `scenario:${action.label}` : `${action.type}:${action.value}`;

const collectAllActions = (elements: readonly ToolbarElement[]): readonly ToolbarAction[] =>
  elements.flatMap((element) =>
    "items" in element ? collectAllActions(element.items) : [element]
  );

const mergeActionTracking = (
  defaultAction: ToolbarAction,
  trackingLookup: ReadonlyMap<string, ToolbarAction>
): ToolbarAction => {
  if (defaultAction.lastUsed === undefined && defaultAction.done === undefined) {
    return defaultAction;
  }

  const currentAction = trackingLookup.get(getActionTrackingKey(defaultAction));
  if (!currentAction) {
    return defaultAction;
  }

  return {
    ...defaultAction,
    ...(defaultAction.lastUsed !== undefined && currentAction.lastUsed !== undefined && { lastUsed: currentAction.lastUsed }),
    ...(defaultAction.done !== undefined && currentAction.done !== undefined && { done: currentAction.done })
  };
};

const mergeElementTracking = (
  element: ToolbarElement,
  trackingLookup: ReadonlyMap<string, ToolbarAction>
): ToolbarElement => {
  if ("items" in element) {
    return {
      ...element,
      items: element.items.map((item) => mergeElementTracking(item, trackingLookup))
    };
  }

  return mergeActionTracking(element, trackingLookup);
};

export const mergeToolbarTrackingOnReset = (
  defaultConfig: ToolbarConfig,
  currentConfig: ToolbarConfig
): ToolbarConfig => {
  const trackingLookup = new Map(
    collectAllActions(currentConfig.elements).map((action) => [getActionTrackingKey(action), action])
  );

  return {
    elements: defaultConfig.elements.map((element) => mergeElementTracking(element, trackingLookup))
  };
};
