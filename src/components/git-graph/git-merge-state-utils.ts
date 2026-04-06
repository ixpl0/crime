const MERGE_STATE_LABELS: Record<GitMergeStateKind, string> = {
  none: "",
  merge: "Слияние (merge)",
  rebase: "Перебазирование (rebase)",
  "cherry-pick": "Cherry-pick"
};

export const getMergeStateLabel = (
  state: GitMergeStateKind,
  hasStashConflicts: boolean
): string => {
  if (state !== "none") {
    return MERGE_STATE_LABELS[state];
  }
  return hasStashConflicts ? "Конфликты stash" : "";
};

export const getConflictCountWord = (count: number): string => {
  if (count % 10 === 1 && count % 100 !== 11) {
    return "конфликт";
  }
  if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) {
    return "конфликта";
  }
  return "конфликтов";
};

export const getMergeAbortCommand = (state: GitMergeStateKind): string => {
  if (state === "rebase") {
    return "rebase";
  }
  if (state === "cherry-pick") {
    return "cherry-pick";
  }
  return "merge";
};
