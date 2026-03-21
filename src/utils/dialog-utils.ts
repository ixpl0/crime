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

export interface PromptDialogOptions {
  title: string;
  placeholder?: string;
}

export interface PromptDialogState {
  title: string;
  placeholder: string;
}

export interface PromptDialogStore {
  pendingState: Readonly<Ref<PromptDialogState | null>>;
  requestPrompt: (options: PromptDialogOptions) => Promise<string | null>;
  resolvePrompt: (result: string | null) => void;
}

const PROMPT_DIALOG_KEY = Symbol("prompt-dialog");

export const providePromptDialog = (): PromptDialogStore => {
  const pendingState = ref<PromptDialogState | null>(null);
  let pendingResolve: ((result: string | null) => void) | null = null;

  const requestPrompt = (options: PromptDialogOptions): Promise<string | null> =>
    new Promise<string | null>((resolve) => {
      pendingResolve = resolve;
      pendingState.value = { title: options.title, placeholder: options.placeholder ?? "" };
    });

  const resolvePrompt = (result: string | null): void => {
    const resolve = pendingResolve;
    pendingResolve = null;
    pendingState.value = null;
    resolve?.(result);
  };

  const store: PromptDialogStore = { pendingState, requestPrompt, resolvePrompt };
  provide(PROMPT_DIALOG_KEY, store);
  return store;
};

export const usePromptDialog = (): PromptDialogStore => {
  const store = inject<PromptDialogStore>(PROMPT_DIALOG_KEY);
  if (!store) {
    throw new Error("usePromptDialog() requires providePromptDialog() in an ancestor component.");
  }
  return store;
};
