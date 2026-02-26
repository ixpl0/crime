<template>
  <div class="ripple-container flex flex-wrap items-stretch gap-x-2 gap-y-0">
    <label
      v-for="(item, index) in suffixConfig.items"
      :key="`suffix-${index}`"
      class="label inline-flex h-8 cursor-pointer select-none items-center gap-2 rounded-btn px-2 py-0 whitespace-nowrap hover:bg-base-100/60"
      :title="item.value"
      @click.prevent="$emit('toggle-suffix', index)"
    >
      <span
        :ref="(el) => setIndicatorRef(index, el as HTMLElement | null)"
        class="flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold leading-none"
        :class="suffixIndicatorClass(item.mode)"
      >
        <template v-if="item.mode === 'once'">1</template>
        <template v-else-if="item.mode === 'always'">✓</template>
      </span>
      <span class="label-text text-xs">{{ item.label }}</span>
    </label>

    <button
      type="button"
      class="btn btn-sm btn-square btn-ghost h-8 min-h-8"
      title="Edit suffixes"
      @click="$emit('open-config-editor')"
    >
      <Pencil :size="16" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { watch } from "vue";
import { type PromptSuffixConfig, type PromptSuffixMode } from "../types/prompt-suffix";
import { Pencil } from "lucide-vue-next";

const props = defineProps<{
  suffixConfig: PromptSuffixConfig;
}>();

defineEmits<{
  "toggle-suffix": [index: number];
  "open-config-editor": [];
}>();

const indicatorRefs = new Map<number, HTMLElement>();

const rippleColorForMode = (mode: PromptSuffixMode): string => {
  if (mode === "once") {
    return "oklch(85% 0.22 70.9 / 1.0)";
  }
  if (mode === "always") {
    return "oklch(75% 0.22 160 / 1.0)";
  }
  return "oklch(60% 0 0 / 0.6)";
};

const setIndicatorRef = (index: number, element: HTMLElement | null) => {
  if (element) {
    indicatorRefs.set(index, element);
  } else {
    indicatorRefs.delete(index);
  }
};

const triggerRipple = (element: HTMLElement, color: string) => {
  // Ищем контейнер с переменными, чтобы точно их прочитать
  const container = element.closest(".ripple-container") as HTMLElement;
  const styles = getComputedStyle(container);
  
  const getProp = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
  
  // Парсим длительность (обрабатываем и ms, и s)
  const durationValue = getProp("--ripple-duration", "2500ms");
  const duration = durationValue.endsWith("ms") 
    ? parseInt(durationValue) 
    : parseFloat(durationValue) * 1000;
  
  const sizeMax = getProp("--ripple-size-max", "64px");
  const sizeMid = getProp("--ripple-size-mid", "45px");
  const midOffset = parseFloat(getProp("--ripple-mid-offset", "0.2"));
  const midOpacity = parseFloat(getProp("--ripple-mid-opacity", "0.3"));
  const easing = getProp("--ripple-easing", "cubic-bezier(0.16, 1, 0.3, 1)");

  // Чистое извлечение базы цвета: "oklch(L C H / A)" -> "oklch(L C H"
  const baseColor = color.replace(/\s*\/\s*[\d.]+\)$/, "");
  
  const rippleAnimation = element.animate(
    [
      { boxShadow: `0 0 0 0 ${color}`, offset: 0 },
      { boxShadow: `0 0 0 ${sizeMid} ${baseColor} / ${midOpacity.toString()})`, offset: midOffset },
      { boxShadow: `0 0 0 ${sizeMax} ${baseColor} / 0)`, offset: 1 },
    ],
    { duration: isNaN(duration) ? 2500 : duration, easing, fill: "forwards" }
  );
  
  rippleAnimation.onfinish = () => {
    rippleAnimation.cancel();
  };
};

watch(
  () => props.suffixConfig.items.map((item) => item.mode),
  (currentModes, prevModes) => {
    if (prevModes && prevModes.length > 0) {
      currentModes.forEach((mode, index) => {
        const previous = prevModes[index];
        // Анимация только при автоматическом пропадании (из 'once' в 'off')
        if (mode === "off" && previous === "once") {
          const element = indicatorRefs.get(index);
          if (element) {
            triggerRipple(element, rippleColorForMode(previous));
          }
        }
      });
    }
  },
  { immediate: true }
);

const suffixIndicatorClass = (mode: PromptSuffixMode) => {
  if (mode === "once") {
    return "border-warning bg-warning/20 text-warning";
  }
  if (mode === "always") {
    return "border-success bg-success/20 text-success";
  }
  return "border-base-content/30";
};
</script>

<style scoped>
.ripple-container {
  --ripple-duration: 2.5s;
  --ripple-size-max: 64px;
  --ripple-size-mid: 27px;
  --ripple-mid-offset: 0.3;
  --ripple-mid-opacity: 0.15;
  --ripple-easing: cubic-bezier(0.26, 1, 0.2, 1.1);
}
</style>
