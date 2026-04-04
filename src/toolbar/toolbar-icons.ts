import { icons } from "lucide-vue-next";
import type { FunctionalComponent } from "vue";

export const resolveLucideIcon = (name: string | undefined): FunctionalComponent | null => {
  if (!name) {
    return null;
  }
  const icon = icons[name as keyof typeof icons];
  return (icon as FunctionalComponent | undefined) ?? null;
};

export const lucideIconNames: readonly string[] = Object.keys(icons).sort();
