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

interface FilesystemDeleteResponse {
  ok: boolean;
  error?: string;
}

interface FilesystemWriteFileResponse {
  ok: boolean;
  error?: string;
}

interface FilesystemApi {
  readDirectory: (path: string) => Promise<FilesystemReadResponse>;
  readFile: (projectPath: string, filePath: string) => Promise<FilesystemReadFileResponse>;
  deletePath: (projectPath: string, targetPath: string) => Promise<FilesystemDeleteResponse>;
  writeFile: (projectPath: string, filePath: string, content: string) => Promise<FilesystemWriteFileResponse>;
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

interface GitMutateResponse {
  ok: boolean;
  available?: boolean;
  reason?: "git-not-installed" | "not-a-repository";
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

interface GitLogEntry {
  hash: string;
  parentHashes: string[];
  author: string;
  date: string;
  subject: string;
  refs: string[];
}

interface GitLogResponse {
  ok: boolean;
  available?: boolean;
  reason?: "git-not-installed" | "not-a-repository";
  entries?: GitLogEntry[];
  error?: string;
}

interface GitCommitFileChange {
  path: string;
  additions: number;
  deletions: number;
}

interface GitCommitDetails {
  hash: string;
  parentHashes: string[];
  authorName: string;
  authorEmail: string;
  authorDate: string;
  committerName: string;
  committerEmail: string;
  committerDate: string;
  subject: string;
  body: string;
  refs: string[];
  files: GitCommitFileChange[];
}

interface GitCommitDetailsResponse {
  ok: boolean;
  available?: boolean;
  reason?: "git-not-installed" | "not-a-repository";
  details?: GitCommitDetails;
  error?: string;
}

interface GitWatchResponse {
  ok: boolean;
  error?: string;
}

interface GitApi {
  getStatus: (projectPath: string) => Promise<GitStatusResponse>;
  getFileDiff: (projectPath: string, filePath: string) => Promise<GitFileDiffResponse>;
  revertFile: (projectPath: string, filePath: string) => Promise<GitMutateResponse>;
  revertAll: (projectPath: string) => Promise<GitMutateResponse>;
  getLog: (projectPath: string, maxCount?: number) => Promise<GitLogResponse>;
  getCommitDetails: (projectPath: string, hash: string) => Promise<GitCommitDetailsResponse>;
  watch: (projectPath: string) => Promise<GitWatchResponse>;
  unwatch: () => Promise<GitWatchResponse>;
  onChanged: (listener: () => void) => () => void;
}

interface ZoomApi {
  getFactor: () => number;
  setFactor: (factor: number) => boolean;
}

interface WindowApi {
  flashFrame: () => Promise<void>;
}

interface ProjectApi {
  quickKeys: readonly QuickKeyBinding[];
  openFolder: () => Promise<string | null>;
  settings: SettingsApi;
  terminal: TerminalApi;
  clipboard: ClipboardApi;
  shell: ShellApi;
  filesystem: FilesystemApi;
  git: GitApi;
  zoom: ZoomApi;
  window: WindowApi;
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
