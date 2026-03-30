function toRelativeUnits(isoDate: string) {
  const date = new Date(isoDate);
  const now = new Date();
  const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  return {
    diffSeconds,
    diffMinutes,
    diffHours,
    diffDays,
    diffWeeks,
    diffMonths,
    diffYears
  };
}

export function formatShortHash(hash: string) {
  return hash.slice(0, 7);
}

export function formatRelativeDate(isoDate: string) {
  const units = toRelativeUnits(isoDate);
  if (units.diffSeconds < 60) {
    return "just now";
  }

  if (units.diffMinutes < 60) {
    return `${String(units.diffMinutes)}m ago`;
  }

  if (units.diffHours < 24) {
    return `${String(units.diffHours)}h ago`;
  }

  if (units.diffDays < 7) {
    return `${String(units.diffDays)}d ago`;
  }

  if (units.diffWeeks < 5) {
    return `${String(units.diffWeeks)}w ago`;
  }

  if (units.diffMonths < 12) {
    return `${String(units.diffMonths)}mo ago`;
  }

  return `${String(units.diffYears)}y ago`;
}

export function formatFullDate(isoDate: string) {
  const date = new Date(isoDate);
  return date.toLocaleString("ru-RU", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

export function isBranchRef(refName: string) {
  return refName !== "HEAD" && !refName.startsWith("tag: ");
}

export function formatRef(refName: string) {
  if (refName.startsWith("HEAD -> ")) {
    return refName.slice(8);
  }

  if (refName.startsWith("tag: ")) {
    return refName.slice(5);
  }

  return refName;
}

export function refClasses(refName: string) {
  if (refName.startsWith("HEAD -> ")) {
    return "bg-primary/20 text-primary";
  }

  if (refName.startsWith("tag: ")) {
    return "bg-warning/20 text-warning";
  }

  if (refName.startsWith("origin/")) {
    return "bg-info/20 text-info";
  }

  return "bg-base-content/10 text-base-content/70";
}
