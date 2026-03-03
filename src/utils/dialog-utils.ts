import { inject, provide, ref, type Ref } from "vue";

export interface ConfirmDialogOptions {
  title: string;
  body?: string;
}

export interface ConfirmDialogState {
  title: string;
  body: string | null;
}

export interface ConfirmDialogStore {
  pendingState: Readonly<Ref<ConfirmDialogState | null>>;
  requestConfirm: (options: ConfirmDialogOptions) => Promise<boolean>;
  resolveConfirm: (result: boolean) => void;
}

const CONFIRM_DIALOG_KEY = Symbol("confirm-dialog");

export const provideConfirmDialog = (): ConfirmDialogStore => {
  const pendingState = ref<ConfirmDialogState | null>(null);
  let pendingResolve: ((result: boolean) => void) | null = null;

  const requestConfirm = (options: ConfirmDialogOptions): Promise<boolean> =>
    new Promise<boolean>((resolve) => {
      pendingResolve = resolve;
      pendingState.value = { title: options.title, body: options.body ?? null };
    });

  const resolveConfirm = (result: boolean): void => {
    const resolve = pendingResolve;
    pendingResolve = null;
    pendingState.value = null;
    resolve?.(result);
  };

  const store: ConfirmDialogStore = { pendingState, requestConfirm, resolveConfirm };
  provide(CONFIRM_DIALOG_KEY, store);
  return store;
};

export const useConfirmDialog = (): ConfirmDialogStore => {
  const store = inject<ConfirmDialogStore>(CONFIRM_DIALOG_KEY);
  if (!store) {
    throw new Error("useConfirmDialog() requires provideConfirmDialog() in an ancestor component.");
  }
  return store;
};
