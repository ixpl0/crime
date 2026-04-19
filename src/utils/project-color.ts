const hashString = (value: string): number =>
  Array.from(value).reduce(
    (hash, character) => ((hash << 5) - hash + character.charCodeAt(0)) | 0,
    0
  );

export const computeAutoProjectColor = (name: string): string => {
  const hue = Math.abs(hashString(name)) % 360;
  return `oklch(0.68 0.17 ${String(hue)})`;
};

const PRESET_PROJECT_COLORS = new Set<string>([
  "primary", "secondary", "accent", "info", "success", "warning", "error", "neutral", "ghost"
]);

export const resolveProjectColorCss = (color: string): string =>
  PRESET_PROJECT_COLORS.has(color) ? `var(--color-${color})` : color;
