import {
  buildEntryListSnapshot,
  buildDeletedChildrenByParent,
  mergeDirectoryEntries,
  toGitStatusMap,
  type DeletedChildrenByParent
} from "./file-tree-status-utils";

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

export function normalizeGitState(projectPath: string, response: GitStatusResponse): NormalizedGitState {
  if (!response.ok) {
    return {
      statuses: {},
      deletedChildren: {},
      infoMessage: response.error
        ? `Git статус недоступен: ${response.error}`
        : "Git статус недоступен."
    };
  }

  if (!response.available) {
    return {
      statuses: {},
      deletedChildren: {},
      infoMessage: response.reason === "git-not-installed"
        ? "Git не установлен. Статус файлов по цвету недоступен."
        : "Выбранная папка не является Git-репозиторием."
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

export function buildNextTreeState(
  projectPath: string,
  directoryResponse: FilesystemReadResponse,
  gitResponse: GitStatusResponse
): NextTreeState {
  const normalizedGitState = normalizeGitState(projectPath, gitResponse);
  const loadError = directoryResponse.ok
    ? ""
    : directoryResponse.error ?? "Не удалось прочитать папку проекта.";
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
