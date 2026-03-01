import { type ToolbarButtonColor, type ToolbarPresetColor } from "../types/toolbar";
import { isToolbarPresetColor } from "./toolbar-storage";

const presetClassMap: Record<ToolbarPresetColor, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  accent: "btn-accent",
  info: "btn-info",
  success: "btn-success",
  warning: "btn-warning",
  error: "btn-error",
  neutral: "btn-neutral",
  ghost: "btn-ghost"
};

const parseHexToRgb = (hex: string): readonly [number, number, number] => {
  const normalized = hex.length === 4
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    : hex;
  const value = parseInt(normalized.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
};

const linearizeChannel = (channel: number): number => {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
};

const getContrastingTextColor = (hex: string): string => {
  const [red, green, blue] = parseHexToRgb(hex);
  const luminance =
    0.2126 * linearizeChannel(red) +
    0.7152 * linearizeChannel(green) +
    0.0722 * linearizeChannel(blue);
  return luminance > 0.179 ? "#000000" : "#ffffff";
};

export const getToolbarButtonColorClass = (color?: ToolbarButtonColor): string =>
  color && isToolbarPresetColor(color) ? presetClassMap[color] : "";

export const getToolbarButtonCustomStyle = (
  color?: ToolbarButtonColor
): Record<string, string> | undefined => {
  if (!color || isToolbarPresetColor(color)) {
    return undefined;
  }

  return {
    backgroundColor: color,
    color: getContrastingTextColor(color),
    borderColor: color
  };
};
