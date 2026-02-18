/// <reference types="vite/client" />

interface AppMeta {
  framework: string;
  runtime: string;
}

interface ProjectApi {
  openFolder: () => Promise<string | null>;
}

interface Window {
  appMeta: AppMeta;
  projectApi: ProjectApi;
}

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, unknown>;
  export default component;
}
