import { computed, ref, watch } from "vue";

const computeChangeGroupStartLines = (lines: readonly GitDiffLine[]): readonly number[] => {
  const starts: number[] = [];
  let inChange = false;
  for (let index = 0; index < lines.length; index++) {
    const isChange = lines[index]?.type !== "context";
    if (isChange && !inChange) {
      starts.push(index + 1); // 1-indexed doc line for CodeMirror
    }
    inChange = isChange;
  }
  return starts;
};

export const useDiffChangeNavigation = (getLines: () => readonly GitDiffLine[]) => {
  const currentIndex = ref(-1);

  const changeGroupStarts = computed(() => computeChangeGroupStartLines(getLines()));
  const changeCount = computed(() => changeGroupStarts.value.length);

  watch(changeGroupStarts, () => { currentIndex.value = -1; });

  const goToNext = (): number | null => {
    if (changeCount.value === 0) { return null; }
    const next = currentIndex.value + 1 >= changeCount.value ? 0 : currentIndex.value + 1;
    currentIndex.value = next;
    return changeGroupStarts.value[next] ?? null;
  };

  const goToPrevious = (): number | null => {
    if (changeCount.value === 0) { return null; }
    const prev = currentIndex.value <= 0 ? changeCount.value - 1 : currentIndex.value - 1;
    currentIndex.value = prev;
    return changeGroupStarts.value[prev] ?? null;
  };

  const positionLabel = computed(() => {
    if (changeCount.value === 0) { return null; }
    if (currentIndex.value < 0) { return String(changeCount.value); }
    return `${String(currentIndex.value + 1)}/${String(changeCount.value)}`;
  });

  return { changeCount, positionLabel, goToNext, goToPrevious };
};
