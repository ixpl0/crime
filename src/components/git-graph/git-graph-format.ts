const pad2 = (n: number) => String(n).padStart(2, "0");

const MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export function formatShortHash(hash: string) {
  return hash.slice(0, 7);
}

export function formatRelativeDate(isoDate: string) {
  const date = new Date(isoDate);
  const now = new Date();
  const time = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

  if (isSameDay(date, now)) {
    return time;
  }

  const dayMonth = `${String(date.getDate())} ${MONTHS[date.getMonth()]}`;

  if (date.getFullYear() === now.getFullYear()) {
    return `${dayMonth} ${time}`;
  }

  return `${dayMonth} ${String(date.getFullYear())} ${time}`;
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

const AUTHOR_PALETTE = [
  "hsl(210 70% 65%)",  // синий
  "hsl(340 65% 60%)",  // розовый
  "hsl(160 55% 55%)",  // бирюзовый
  "hsl(30 75% 60%)",   // оранжевый
  "hsl(270 55% 65%)",  // фиолетовый
  "hsl(50 70% 55%)",   // жёлтый
  "hsl(190 60% 55%)",  // голубой
  "hsl(0 60% 60%)",    // красный
  "hsl(120 45% 55%)",  // зелёный
  "hsl(300 50% 60%)",  // пурпурный
  "hsl(80 50% 55%)",   // лайм
  "hsl(230 55% 65%)",  // индиго
];

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = Math.imul(31, hash) + value.charCodeAt(i) | 0;
  }
  return Math.abs(hash);
}

export function authorColor(name: string) {
  return AUTHOR_PALETTE[hashString(name) % AUTHOR_PALETTE.length];
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
