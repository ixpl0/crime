const STATUS_PRIORITY: Record<GitFileStatus, number> = {
  modified: 0,
  added: 1,
  deleted: 2
};

export function buildSnapshot(entries: GitStatusEntry[], info: string, error: string) {
  const sorted = entries.map((entry) => `${entry.path}:${entry.status}`).join("\n");
  return `${info}\n${error}\n${sorted}`;
}

export function sortEntries(entries: GitStatusEntry[]) {
  return [...entries].sort((a, b) => {
    const priorityDiff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return a.path.localeCompare(b.path);
  });
}

export function toRelativeEntryPath(projectPath: string, path: string) {
  const normalizedProjectPath = projectPath.replace(/\\/g, "/").replace(/\/$/, "");
  const normalizedPath = path.replace(/\\/g, "/");
  return normalizedPath.startsWith(`${normalizedProjectPath}/`)
    ? normalizedPath.slice(normalizedProjectPath.length + 1)
    : normalizedPath;
}

export function entryPathDisplayForProject(projectPath: string, path: string) {
  const relative = toRelativeEntryPath(projectPath, path);
  return relative.startsWith("/") ? relative : `/${relative}`;
}

export function nameClasses(status: GitFileStatus) {
  if (status === "added") {
    return "text-emerald-400";
  }

  if (status === "modified") {
    return "text-sky-400";
  }

  return "text-rose-400";
}

export function statusLabel(status: GitFileStatus) {
  if (status === "added") {
    return "A";
  }

  if (status === "modified") {
    return "M";
  }

  return "D";
}

export function statusBadgeClasses(status: GitFileStatus) {
  if (status === "added") {
    return "bg-emerald-400/10 text-emerald-400";
  }

  if (status === "modified") {
    return "bg-sky-400/10 text-sky-400";
  }

  return "bg-rose-400/10 text-rose-400";
}

export function entryDisplayName(path: string) {
  const segments = path.replace(/\\/g, "/").split("/");
  return segments[segments.length - 1] ?? path;
}
