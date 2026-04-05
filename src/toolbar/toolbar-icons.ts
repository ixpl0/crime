import { icons } from "lucide-vue-next";
import type { FunctionalComponent } from "vue";
import { brandIcons, brandIconNames } from "./brand-icons";

export const resolveLucideIcon = (name: string | undefined): FunctionalComponent | null => {
  if (!name) {
    return null;
  }
  if (name in brandIcons) {
    return brandIcons[name];
  }
  const icon = icons[name as keyof typeof icons];
  return (icon as FunctionalComponent | undefined) ?? null;
};

export const lucideIconNames: readonly string[] = [...Object.keys(icons), ...brandIconNames].sort();
