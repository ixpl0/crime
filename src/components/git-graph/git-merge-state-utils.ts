const MERGE_STATE_LABELS: Record<GitMergeStateKind, string> = {
  none: "",
  merge: "Слияние (merge)",
  "squash-merge": "Слияние squash",
  rebase: "Перебазирование (rebase)",
  "cherry-pick": "Cherry-pick",
  revert: "Отмена коммита (revert)",
  am: "Применение патчей (am)",
  bisect: "Бисект (bisect)"
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

const ABORT_COMMANDS: Record<GitMergeStateKind, string> = {
  none: "merge",
  merge: "merge",
  "squash-merge": "reset --merge",
  rebase: "rebase",
  "cherry-pick": "cherry-pick",
  revert: "revert",
  am: "am",
  bisect: "bisect reset"
};

export const getMergeAbortCommand = (state: GitMergeStateKind): string =>
  ABORT_COMMANDS[state];

const CONTINUABLE_STATES: ReadonlySet<GitMergeStateKind> = new Set([
  "merge", "squash-merge", "rebase", "cherry-pick", "revert", "am"
]);

export const canContinueState = (state: GitMergeStateKind): boolean =>
  CONTINUABLE_STATES.has(state);
