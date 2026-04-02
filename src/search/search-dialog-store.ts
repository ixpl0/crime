import { inject, provide, ref, type InjectionKey, type Ref } from "vue";

export type SearchMode = "names" | "content";

export interface SearchDialogStore {
  isOpen: Readonly<Ref<boolean>>;
  pendingMode: Readonly<Ref<SearchMode | null>>;
  openSearchDialog: (mode?: SearchMode) => void;
  closeSearchDialog: () => void;
}

const searchDialogStoreKey: InjectionKey<SearchDialogStore> = Symbol(
  "crime-search-dialog-store"
);

export const provideSearchDialogStore = (): SearchDialogStore => {
  const isOpen = ref(false);
  const pendingMode = ref<SearchMode | null>(null);

  const openSearchDialog = (mode?: SearchMode) => {
    pendingMode.value = mode ?? null;
    isOpen.value = true;
  };

  const closeSearchDialog = () => {
    isOpen.value = false;
    pendingMode.value = null;
  };

  const store: SearchDialogStore = { isOpen, pendingMode, openSearchDialog, closeSearchDialog };
  provide(searchDialogStoreKey, store);
  return store;
};

export const useSearchDialogStore = (): SearchDialogStore => {
  const store = inject(searchDialogStoreKey);
  if (store === undefined) {
    throw new Error("Search dialog store is not available.");
  }

  return store;
};
