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
  input: (data: string) => Promise<TerminalResponse>;
  resize: (size: TerminalSize) => Promise<TerminalResponse>;
  stop: () => Promise<TerminalResponse>;
  onData: (listener: (data: string) => void) => () => void;
  onExit: (listener: (code: number | null) => void) => () => void;
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

interface QuickKeyBinding {
  id: string;
  accelerator: string;
  input: string;
  label: string;
  icon: QuickKeyIcon | null;
  gridIndex: number;
}

interface FileEntry {
  name: string;
  isDirectory: boolean;
  path: string;
  isVirtual?: boolean;
  isIgnored?: boolean;
}

interface FilesystemReadResponse {
  ok: boolean;
  entries?: FileEntry[];
  error?: string;
}

interface FilesystemReadFileResponse {
  ok: boolean;
  content?: string;
  error?: string;
}

interface FilesystemApi {
  readDirectory: (path: string) => Promise<FilesystemReadResponse>;
  readFile: (projectPath: string, filePath: string) => Promise<FilesystemReadFileResponse>;
}

type GitFileStatus = "added" | "modified" | "deleted";

interface GitStatusEntry {
  path: string;
  status: GitFileStatus;
}

interface GitStatusResponse {
  ok: boolean;
  available?: boolean;
  reason?: "git-not-installed" | "not-a-repository";
  entries?: GitStatusEntry[];
  error?: string;
}

type GitDiffLineType = "context" | "added" | "removed";

interface GitDiffLine {
  type: GitDiffLineType;
  text: string;
}

interface GitFileDiffResponse {
  ok: boolean;
  available?: boolean;
  reason?: "git-not-installed" | "not-a-repository";
  status?: GitFileStatus | null;
  lines?: GitDiffLine[];
  error?: string;
}

interface GitApi {
  getStatus: (projectPath: string) => Promise<GitStatusResponse>;
  getFileDiff: (projectPath: string, filePath: string) => Promise<GitFileDiffResponse>;
}

interface ZoomApi {
  getFactor: () => number;
  setFactor: (factor: number) => boolean;
  reset: () => void;
}

interface ProjectApi {
  quickKeys: readonly QuickKeyBinding[];
  openFolder: () => Promise<string | null>;
  settings: SettingsApi;
  terminal: TerminalApi;
  filesystem: FilesystemApi;
  git: GitApi;
  zoom: ZoomApi;
  onGlobalQuickKey: (listener: (input: string) => void) => () => void;
}

interface Window {
  appMeta: AppMeta;
  projectApi: ProjectApi;
}

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<object, object, unknown>;
  export default component;
}
