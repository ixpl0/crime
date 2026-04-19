import { computed, nextTick, ref, type Ref } from "vue";
import { type ProjectSettings } from "../types/project-settings";
import { clampContextMenuX, clampContextMenuY } from "../utils/context-menu-utils";
import { useDragRegionBackdrop } from "../utils/dropdown-utils";
import { computeAutoProjectColor, resolveProjectColorCss } from "../utils/project-color";

export const PROJECT_COLOR_PRESETS = [
  "primary", "secondary", "accent", "info",
  "success", "warning", "error", "neutral"
] as const;

interface UseProjectColorMenuOptions {
  projectName: Ref<string>;
  projectSettings: Ref<ProjectSettings>;
  saveProjectSettings: (settings: ProjectSettings) => void | Promise<void>;
  closeProjectDropdown: () => void;
  openSettingsEditor: () => void;
}

// eslint-disable-next-line max-lines-per-function
export const useProjectColorMenu = ({
  projectName,
  projectSettings,
  saveProjectSettings,
  closeProjectDropdown,
  openSettingsEditor
}: UseProjectColorMenuOptions) => {
  const colorMenuElement = ref<HTMLElement | null>(null);
  const colorMenu = ref<{ x: number; y: number } | null>(null);

  const closeColorMenu = () => {
    colorMenu.value = null;
  };

  const isColorMenuOpen = computed(() => colorMenu.value !== null);
  useDragRegionBackdrop(isColorMenuOpen, closeColorMenu);

  const storedColor = computed(() => projectSettings.value.appearance.color);
  const isAutoColor = computed(() => !storedColor.value);
  const autoColor = computed(() => computeAutoProjectColor(projectName.value));
  const effectiveColor = computed(() => storedColor.value ?? autoColor.value);

  const projectNameStyle = computed(() => {
    const resolved = resolveProjectColorCss(effectiveColor.value);
    return {
      backgroundColor: `color-mix(in oklch, ${resolved} 28%, transparent)`,
      borderColor: `color-mix(in oklch, ${resolved} 55%, transparent)`,
      boxShadow: `0 0 10px color-mix(in oklch, ${resolved} 28%, transparent)`
    };
  });

  const persistColor = (color: string | undefined) => {
    const nextSettings: ProjectSettings = {
      ...projectSettings.value,
      appearance: color === undefined ? {} : { color }
    };
    void saveProjectSettings(nextSettings);
  };

  const openColorMenuAt = (event: MouseEvent) => {
    event.preventDefault();
    closeProjectDropdown();
    colorMenu.value = {
      x: clampContextMenuX(event.clientX),
      y: clampContextMenuY(event.clientY)
    };
    void nextTick(() => {
      colorMenuElement.value?.focus();
    });
  };

  const handleSelectAutoColor = () => {
    persistColor(undefined);
    closeColorMenu();
  };

  const handleSelectPreset = (preset: string) => {
    persistColor(preset);
    closeColorMenu();
  };

  const handleOpenSettingsForCustomColor = () => {
    closeColorMenu();
    openSettingsEditor();
  };

  return {
    colorMenu,
    colorMenuElement,
    storedColor,
    isAutoColor,
    autoColor,
    projectNameStyle,
    openColorMenuAt,
    handleSelectAutoColor,
    handleSelectPreset,
    handleOpenSettingsForCustomColor
  };
};
