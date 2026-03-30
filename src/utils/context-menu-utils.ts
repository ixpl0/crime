export const CONTEXT_MENU_WIDTH = 220;
export const CONTEXT_MENU_HEIGHT = 44;

const clampCoordinate = (value: number, maxSize: number) => {
  const maxValue = Math.max(8, maxSize - 8);
  return Math.min(Math.max(value, 8), maxValue);
};

export const clampContextMenuX = (value: number) =>
  clampCoordinate(value, window.innerWidth - CONTEXT_MENU_WIDTH);

export const clampContextMenuY = (value: number) =>
  clampCoordinate(value, window.innerHeight - CONTEXT_MENU_HEIGHT);

export const getGitUnavailableMessage = (reason?: GitMutateResponse["reason"]) =>
  reason === "git-not-installed"
    ? "Git не установлен."
    : "Выбранная папка не является Git-репозиторием.";
