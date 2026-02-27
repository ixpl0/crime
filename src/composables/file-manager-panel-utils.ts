import {
  buildEntryListSnapshot,
  buildDeletedChildrenByParent,
  mergeDirectoryEntries,
  toGitStatusMap,
  type DeletedChildrenByParent
} from "../components/file-tree-status-utils";

const CONTEXT_MENU_WIDTH = 220;
const CONTEXT_MENU_HEIGHT = 44;

export interface NormalizedGitState {
  statuses: Record<string, GitFileStatus>;
  deletedChildren: DeletedChildrenByParent;
  infoMessage: string;
}

export interface NextTreeState {
  entries: FileEntry[];
  statuses: Record<string, GitFileStatus>;
  deletedChildren: DeletedChildrenByParent;
  infoMessage: string;
  loadError: string;
  stateSnapshot: string;
  structureSnapshot: string;
}

export function getGitUnavailableMessage(reason?: GitMutateResponse["reason"]) {
  return reason === "git-not-installed"
    ? "Git is not installed."
    : "The selected folder is not a Git repository.";
}

export function normalizeGitState(projectPath: string, response: GitStatusResponse): NormalizedGitState {
  if (!response.ok) {
    return {
      statuses: {},
      deletedChildren: {},
      infoMessage: response.error
        ? `Git status unavailable: ${response.error}`
        : "Git status unavailable."
    };
  }

  if (!response.available) {
    return {
      statuses: {},
      deletedChildren: {},
      infoMessage: response.reason === "git-not-installed"
        ? "Git is not installed. File status colors are disabled."
        : "The selected folder is not a Git repository."
    };
  }

  const gitEntries = response.entries ?? [];
  return {
    statuses: toGitStatusMap(gitEntries),
    deletedChildren: buildDeletedChildrenByParent(projectPath, gitEntries),
    infoMessage: ""
  };
}

function buildGitStatusesSnapshot(value: Record<string, GitFileStatus>) {
  const paths = Object.keys(value).sort();
  return paths.map((path) => `${path}:${value[path]}`).join("\n");
}

function buildDeletedChildrenSnapshot(value: DeletedChildrenByParent) {
  const parentPaths = Object.keys(value).sort();
  return parentPaths
    .map((parentPath) => {
      const children = value[parentPath] ?? [];
      const childrenSnapshot = children
        .map((entry) => `${entry.path}|${entry.isDirectory ? "d" : "f"}|${entry.isVirtual ? "v" : "r"}`)
        .join(",");
      return `${parentPath}>${childrenSnapshot}`;
    })
    .join("\n");
}

function buildTreeSnapshot(projectPath: string, payload: NextTreeState) {
  return [
    projectPath,
    payload.loadError,
    payload.infoMessage,
    buildEntryListSnapshot(payload.entries),
    buildGitStatusesSnapshot(payload.statuses),
    buildDeletedChildrenSnapshot(payload.deletedChildren)
  ].join("\n---\n");
}

function buildStructureSnapshot(
  projectPath: string,
  entries: FileEntry[],
  deletedChildren: DeletedChildrenByParent
) {
  return [
    projectPath,
    buildEntryListSnapshot(entries),
    buildDeletedChildrenSnapshot(deletedChildren)
  ].join("\n---\n");
}

function clampCoordinate(value: number, availableSize: number) {
  const maxValue = Math.max(8, availableSize - 8);
  return Math.min(Math.max(value, 8), maxValue);
}

export function clampContextMenuX(value: number) {
  return clampCoordinate(value, window.innerWidth - CONTEXT_MENU_WIDTH);
}

export function clampContextMenuY(value: number) {
  return clampCoordinate(value, window.innerHeight - CONTEXT_MENU_HEIGHT);
}

export function buildNextTreeState(
  projectPath: string,
  directoryResponse: FilesystemReadResponse,
  gitResponse: GitStatusResponse
): NextTreeState {
  const normalizedGitState = normalizeGitState(projectPath, gitResponse);
  const loadError = directoryResponse.ok
    ? ""
    : directoryResponse.error ?? "Failed to read project directory.";
  const entries = directoryResponse.ok
    ? mergeDirectoryEntries(
        directoryResponse.entries ?? [],
        normalizedGitState.deletedChildren[projectPath] ?? []
      )
    : [];

  const payload: NextTreeState = {
    entries,
    statuses: normalizedGitState.statuses,
    deletedChildren: normalizedGitState.deletedChildren,
    infoMessage: normalizedGitState.infoMessage,
    loadError,
    stateSnapshot: "",
    structureSnapshot: ""
  };
  payload.stateSnapshot = buildTreeSnapshot(projectPath, payload);
  payload.structureSnapshot = buildStructureSnapshot(projectPath, entries, normalizedGitState.deletedChildren);
  return payload;
}
