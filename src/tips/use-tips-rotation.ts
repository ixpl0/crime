import { computed, onMounted, onUnmounted, ref } from "vue";
import { tips } from "./tips-data";

const ROTATION_INTERVAL_MS = 45_000;
const STORAGE_KEY = "crime:tip-index";

const getSavedIndex = (): number => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === null) {
    return 0;
  }
  const parsed = Number(saved);
  return Number.isFinite(parsed) ? (parsed + 1) % tips.length : 0;
};

const currentIndex = ref(getSavedIndex());

const persistIndex = () => {
  localStorage.setItem(STORAGE_KEY, String(currentIndex.value));
};

export const useTipsRotation = () => {
  const currentTip = computed(() => tips[currentIndex.value] ?? "");

  let intervalId: ReturnType<typeof setInterval> | null = null;

  const advance = () => {
    currentIndex.value = (currentIndex.value + 1) % tips.length;
    persistIndex();
    stopRotation();
    startRotation();
  };

  const startRotation = () => {
    intervalId = setInterval(() => {
      currentIndex.value = (currentIndex.value + 1) % tips.length;
      persistIndex();
    }, ROTATION_INTERVAL_MS);
  };

  const stopRotation = () => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  onMounted(startRotation);
  onUnmounted(stopRotation);

  return { currentTip, advance };
};
