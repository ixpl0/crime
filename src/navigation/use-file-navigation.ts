import { ref, type Ref } from "vue";

import {
  isPathInsideBase,
  isSamePath
} from "../utils/path-utils";

interface UseFileNavigationOptions {
  projectPath: Ref<string | null>;
  errorMessage: Ref<string>;
  activateFilesTab: () => void;
  reportUiError: (context: string, error: unknown, fallbackMessage: string) => string;
  readDirectory: (path: string) => Promise<FilesystemReadResponse>;
  readFile: (
    projectPath: string,
    filePath: string
  ) => Promise<FilesystemReadFileResponse>;
}

interface FileNavigationState {
  selectedFilePath: Ref<string | null>;
  filesDisplayPath: Ref<string | null>;
  changesSelectedFilePath: Ref<string | null>;
  selectedFileTargetLine: Ref<number | null>;
  selectedFileTargetRequestToken: Ref<number>;
  fileTreeRevealPath: Ref<string | null>;
  fileTreeRevealRequestToken: Ref<number>;
}

function createFileNavigationState(): FileNavigationState {
  return {
    selectedFilePath: ref<string | null>(null),
    filesDisplayPath: ref<string | null>(null),
    changesSelectedFilePath: ref<string | null>(null),
    selectedFileTargetLine: ref<number | null>(null),
    selectedFileTargetRequestToken: ref(0),
    fileTreeRevealPath: ref<string | null>(null),
    fileTreeRevealRequestToken: ref(0)
  };
}

function requestFileTreeReveal(path: string, state: FileNavigationState) {
  state.fileTreeRevealPath.value = path;
  state.fileTreeRevealRequestToken.value += 1;
}

function showDirectoryPath(path: string, state: FileNavigationState) {
  state.selectedFilePath.value = null;
  state.filesDisplayPath.value = path;
  state.selectedFileTargetLine.value = null;
  state.selectedFileTargetRequestToken.value += 1;
}

function showFilePath(path: string, line: number | null, state: FileNavigationState) {
  state.selectedFilePath.value = path;
  state.filesDisplayPath.value = path;
  state.selectedFileTargetLine.value = line;
  state.selectedFileTargetRequestToken.value += 1;
}

function getProjectPathForOpen(
  targetPath: string,
  options: UseFileNavigationOptions
) {
  const currentProjectPath = options.projectPath.value;
  if (!currentProjectPath) {
    return null;
  }

  if (isPathInsideBase(currentProjectPath, targetPath)) {
    return currentProjectPath;
  }

  options.errorMessage.value = `Path is outside the current project: ${targetPath}`;
  return null;
}

async function tryOpenDirectoryPath(
  path: string,
  options: UseFileNavigationOptions,
  state: FileNavigationState
) {
  try {
    const response = await options.readDirectory(path);
    if (!response.ok) {
      return false;
    }

    showDirectoryPath(path, state);
    return true;
  } catch {
    return false;
  }
}

function reportFileOpenError(
  path: string,
  error: unknown,
  options: UseFileNavigationOptions
) {
  options.reportUiError(
    "Terminal path open",
    error,
    `Failed to open path from terminal: ${path}`
  );
}

async function tryOpenFilePath(
  projectPath: string,
  path: string,
  line: number | null,
  options: UseFileNavigationOptions,
  state: FileNavigationState
) {
  try {
    const response = await options.readFile(projectPath, path);
    if (!response.ok) {
      reportFileOpenError(path, response.error, options);
      return;
    }

    showFilePath(path, line, state);
  } catch (error) {
    reportFileOpenError(path, error, options);
  }
}

async function openTerminalPathInFiles(
  path: string,
  line: number | null,
  column: number | null,
  options: UseFileNavigationOptions,
  state: FileNavigationState
) {
  void column;
  const currentProjectPath = getProjectPathForOpen(path, options);
  if (!currentProjectPath) {
    return;
  }

  options.activateFilesTab();
  requestFileTreeReveal(path, state);
  options.errorMessage.value = "";

  if (await tryOpenDirectoryPath(path, options, state)) {
    return;
  }

  await tryOpenFilePath(currentProjectPath, path, line, options, state);
}

function handleFileSelect(path: string, state: FileNavigationState) {
  const currentSelectedPath = state.selectedFilePath.value;
  if (!currentSelectedPath || !isSamePath(currentSelectedPath, path)) {
    state.selectedFileTargetLine.value = null;
  }

  state.selectedFilePath.value = path;
  state.filesDisplayPath.value = path;
}

function resetSelectedFile(state: FileNavigationState) {
  state.selectedFilePath.value = null;
  state.filesDisplayPath.value = null;
  state.selectedFileTargetLine.value = null;
}

function resetChangesSelectedFile(state: FileNavigationState) {
  state.changesSelectedFilePath.value = null;
}

function openChangesPathInFiles(
  path: string,
  options: UseFileNavigationOptions,
  state: FileNavigationState
) {
  const currentProjectPath = getProjectPathForOpen(path, options);
  if (!currentProjectPath) {
    return;
  }
  options.activateFilesTab();
  requestFileTreeReveal(path, state);
  options.errorMessage.value = "";
  showFilePath(path, null, state);
}

function resetFileNavigationState(state: FileNavigationState) {
  state.selectedFilePath.value = null;
  state.filesDisplayPath.value = null;
  state.changesSelectedFilePath.value = null;
  state.selectedFileTargetLine.value = null;
  state.selectedFileTargetRequestToken.value = 0;
  state.fileTreeRevealPath.value = null;
  state.fileTreeRevealRequestToken.value = 0;
}

// eslint-disable-next-line max-lines-per-function
export function useFileNavigation(options: UseFileNavigationOptions) {
  const state = createFileNavigationState();

  return {
    selectedFilePath: state.selectedFilePath,
    filesDisplayPath: state.filesDisplayPath,
    changesSelectedFilePath: state.changesSelectedFilePath,
    selectedFileTargetLine: state.selectedFileTargetLine,
    selectedFileTargetRequestToken: state.selectedFileTargetRequestToken,
    fileTreeRevealPath: state.fileTreeRevealPath,
    fileTreeRevealRequestToken: state.fileTreeRevealRequestToken,
    openTerminalPathInFiles: (
      path: string,
      line: number | null,
      column: number | null
    ) => openTerminalPathInFiles(path, line, column, options, state),
    handleFileSelect: (path: string) => {
      handleFileSelect(path, state);
    },
    handleChangesFileSelect: (path: string) => {
      state.changesSelectedFilePath.value = path;
    },
    resetSelectedFile: () => { resetSelectedFile(state); },
    resetChangesSelectedFile: () => { resetChangesSelectedFile(state); },
    handleChangesPathOpen: (path: string) => {
      openChangesPathInFiles(path, options, state);
    },
    resetFileNavigationState: () => {
      resetFileNavigationState(state);
    }
  };
}
