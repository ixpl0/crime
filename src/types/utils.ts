import type { Ref } from "vue";

export type ReadableRef<T> = Readonly<Ref<T>>;
export type MaybePromise = void | Promise<void>;
