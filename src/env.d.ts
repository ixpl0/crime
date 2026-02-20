/// <reference types="vite/client" />

interface AppMeta {
  framework: string;
  runtime: string;
}

interface TerminalResponse {
  ok: boolean;
  error?: string;
}

interface TerminalSize {
  cols: number;
  rows: number;
}

interface TerminalApi {
  start: (cwd: string, size?: TerminalSize) => Promise<TerminalResponse>;
  runCommand: (command: string) => Promise<TerminalResponse>;
  input: (data: string) => Promise<TerminalResponse>;
  resize: (size: TerminalSize) => Promise<TerminalResponse>;
  stop: () => Promise<TerminalResponse>;
  onData: (listener: (data: string) => void) => () => void;
  onExit: (listener: (code: number | null) => void) => () => void;
}

interface ProjectApi {
  openFolder: () => Promise<string | null>;
  terminal: TerminalApi;
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
