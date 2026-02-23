export type DeletedChildrenByParent = Partial<Record<string, FileEntry[]>>;

function normalizePath(path: string) {
  return path.replace(/[\\/]+/g, "/").replace(/\/$/, "");
}

function isWindowsPath(path: string) {
  return /^[A-Za-z]:\//.test(path);
}

function toComparePath(path: string) {
  return isWindowsPath(path) ? path.toLowerCase() : path;
}

function getRelativeSegments(basePath: string, targetPath: string) {
  const normalizedBase = normalizePath(basePath);
  const normalizedTarget = normalizePath(targetPath);
  const compareBase = toComparePath(normalizedBase);
  const compareTarget = toComparePath(normalizedTarget);

  if (compareTarget === compareBase) {
    return [];
  }

  const basePrefix = `${compareBase}/`;
  if (!compareTarget.startsWith(basePrefix)) {
    return [];
  }

  const relativePath = normalizedTarget.slice(normalizedBase.length + 1);
  return relativePath.split("/").filter((segment) => segment.length > 0);
}

function joinPath(parentPath: string, childName: string, separator: "\\" | "/") {
  if (parentPath.endsWith("\\") || parentPath.endsWith("/")) {
    return `${parentPath}${childName}`;
  }

  return `${parentPath}${separator}${childName}`;
}

function addVirtualChild(
  deletedChildrenByParent: DeletedChildrenByParent,
  parentPath: string,
  entry: FileEntry
) {
  const existingChildren = deletedChildrenByParent[parentPath];
  if (!existingChildren) {
    deletedChildrenByParent[parentPath] = [entry];
    return;
  }

  const alreadyExists = existingChildren.some((child) => child.path === entry.path);
  if (!alreadyExists) {
    existingChildren.push(entry);
  }
}

function sortEntries(entries: FileEntry[]) {
  return [...entries].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

export function mergeDirectoryEntries(actualEntries: FileEntry[], virtualEntries: FileEntry[]) {
  if (virtualEntries.length === 0) {
    return sortEntries(actualEntries);
  }

  const byPath = new Map<string, FileEntry>();
  for (const entry of actualEntries) {
    byPath.set(entry.path, entry);
  }

  for (const entry of virtualEntries) {
    if (!byPath.has(entry.path)) {
      byPath.set(entry.path, entry);
    }
  }

  return sortEntries(Array.from(byPath.values()));
}

export function toGitStatusMap(entries: GitStatusEntry[]) {
  const statusByPath: Record<string, GitFileStatus> = {};
  for (const entry of entries) {
    statusByPath[entry.path] = entry.status;
  }
  return statusByPath;
}

export function buildDeletedChildrenByParent(projectPath: string, gitEntries: GitStatusEntry[]) {
  const deletedChildrenByParent: DeletedChildrenByParent = {};
  const separator: "\\" | "/" = projectPath.includes("\\") ? "\\" : "/";

  for (const gitEntry of gitEntries) {
    if (gitEntry.status !== "deleted") {
      continue;
    }

    const segments = getRelativeSegments(projectPath, gitEntry.path);
    if (segments.length === 0) {
      continue;
    }

    let parentPath = projectPath;
    for (let index = 0; index < segments.length; index += 1) {
      const name = segments[index];
      const isDirectory = index < segments.length - 1;
      const entryPath = joinPath(parentPath, name, separator);

      addVirtualChild(deletedChildrenByParent, parentPath, {
        name,
        isDirectory,
        path: entryPath,
        isVirtual: true
      });

      parentPath = entryPath;
    }
  }

  for (const parentPath of Object.keys(deletedChildrenByParent)) {
    const children = deletedChildrenByParent[parentPath];
    if (!children) {
      continue;
    }

    deletedChildrenByParent[parentPath] = sortEntries(children);
  }

  return deletedChildrenByParent;
}
