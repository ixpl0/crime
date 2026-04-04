import { inject, provide, ref, type InjectionKey, type Ref } from "vue";

export interface StatusBarStore {
  readonly gitBranch: Ref<string | null>;
  readonly gitChangesCount: Ref<number>;
}

const STATUS_BAR_STORE_KEY: InjectionKey<StatusBarStore> = Symbol(
  "crime-status-bar-store"
);

export function provideStatusBarStore(): StatusBarStore {
  const store: StatusBarStore = {
    gitBranch: ref<string | null>(null),
    gitChangesCount: ref(0),
  };
  provide(STATUS_BAR_STORE_KEY, store);
  return store;
}

export function useStatusBarStore(): StatusBarStore {
  const store = inject(STATUS_BAR_STORE_KEY);
  if (!store) {
    throw new Error("StatusBarStore not provided.");
  }
  return store;
}
