<template>
  <div
    class="flex shrink-0 cursor-pointer items-center justify-center gap-2 text-sm select-none"
    title="Следующий совет"
    @click="advance"
  >
    <Transition name="tip-fade" mode="out-in">
      <span :key="currentTip" class="flex min-w-0 items-center gap-2">
        <Lightbulb :size="14" class="shrink-0 text-warning" />
        <span class="min-w-0 truncate text-sm text-base-content/50">{{ currentTip }}</span>
      </span>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { Lightbulb } from "lucide-vue-next";
import { useTipsRotation } from "../tips/use-tips-rotation";

const { currentTip, advance } = useTipsRotation();
</script>

<style scoped>
.tip-fade-enter-active,
.tip-fade-leave-active {
  transition: opacity 0.6s ease;
}

.tip-fade-enter-from,
.tip-fade-leave-to {
  opacity: 0;
}
</style>
