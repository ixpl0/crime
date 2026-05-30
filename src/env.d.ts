/// <reference types="vite/client" />

interface TerminalResponse {
  ok: boolean;
  error?: string;
}

interface TerminalSize {
  cols: number;
  rows: number;
}

interface TerminalApi {
  start: (cwd: string, size?: TerminalSize, sessionId?: string) => Promise<TerminalResponse>;
  input: (data: string, sessionId?: string) => Promise<TerminalResponse>;
  resize: (size: TerminalSize, sessionId?: string) => Promise<TerminalResponse>;
  stop: (sessionId?: string) => Promise<TerminalResponse>;
  onData: (listener: (data: string, sessionId: string) => void) => () => void;
  onExit: (listener: (code: number | null, sessionId: string) => void) => () => void;
}

interface ClipboardApi {
  writeText: (text: string) => Promise<TerminalResponse>;
}

interface ShellApi {
  openExternal: (url: string) => Promise<TerminalResponse>;
}

interface SettingsReadResponse {
  ok: boolean;
  content?: string | null;
  error?: string;
}

interface SettingsWriteResponse {
  ok: boolean;
  error?: string;
}

interface SettingsWatchResponse {
  ok: boolean;
  error?: string;
}

interface SettingsApi {
  directoryName: string;
  read: (projectPath: string, filename: string) => Promise<SettingsReadResponse>;
  write: (projectPath: string, filename: string, content: string) => Promise<SettingsWriteResponse>;
  watch: (projectPath: string, filename: string) => Promise<SettingsWatchResponse>;
  unwatch: () => Promise<SettingsWatchResponse>;
  onFileChanged: (listener: (filename: string) => void) => () => void;
}

type QuickKeyIcon = "arrow-up" | "arrow-down" | "arrow-left" | "arrow-right" | "enter";
type QuickKeyMode = "raw" | "text";

interface QuickKeyBinding {
  id: string;
  accelerator: string;
  input: string;
  label: string;
  icon: QuickKeyIcon | null;
  mode: QuickKeyMode;
  gridIndex: number;
}

interface FilesystemReadResponse {
  ok: boolean;
  error?: string;
}

interface FilesystemApi {
  readDirectory: (path: string) => Promise<FilesystemReadResponse>;
}

interface ZoomApi {
  getFactor: () => number;
  setFactor: (factor: number) => boolean;
}

interface WindowApi {
  flashFrame: () => Promise<void>;
}

type LogLevel = "info" | "warn" | "error";

interface LogApi {
  write: (level: LogLevel, message: string) => Promise<void>;
}

interface ProjectApi {
  quickKeys: readonly QuickKeyBinding[];
  openFolder: () => Promise<string | null>;
  createFolder: () => Promise<string | null>;
  openInNewWindow: (projectPath?: string) => Promise<void>;
  settings: SettingsApi;
  terminal: TerminalApi;
  clipboard: ClipboardApi;
  shell: ShellApi;
  filesystem: FilesystemApi;
  zoom: ZoomApi;
  window: WindowApi;
  log: LogApi;
  onGlobalQuickKey: (listener: (input: string) => void) => () => void;
}

interface Window {
  projectApi: ProjectApi;
}

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<object, object, unknown>;
  export default component;
}
