import { isPathInsideBase } from "../utils/path-utils";

const QUOTED_WINDOWS_PATH_REGEX = /(["'])([A-Za-z]:[\\/][^"'<>|?*\r\n]+)\1/g;
const QUOTED_POSIX_PATH_REGEX = /(["'])((?:\/[^"'<>|?*\r\n]+)+\/?)\1/g;
const WINDOWS_PATH_REGEX = /[A-Za-z]:[\\/][^\s"'<>|?*]+/g;
const POSIX_PATH_REGEX = /(?:^|[\s"'([{])((?:\/[^/\s"'<>|?*]+)+\/?)/g;
const TERMINAL_PATH_TRAILING_CHARS = new Set([")", "]", "}", ",", ";", "\"", "'", "`"]);

interface TerminalPathLocation {
  path: string;
  line: number | null;
  column: number | null;
}

interface TerminalPathCandidate {
  resolvedPath: string;
  line: number | null;
  column: number | null;
}

export interface TerminalPathMatch {
  start: number;
  end: number;
  displayText: string;
  resolvedPath: string;
  line: number | null;
  column: number | null;
}

function parsePositiveInteger(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsedValue = Number.parseInt(value, 10);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function getHashLocation(value: string): TerminalPathLocation | null {
  const match = value.match(/^(.*)#L(\d+)(?:C(\d+))?$/);
  if (!match || match[1].length === 0) {
    return null;
  }

  const line = parsePositiveInteger(match[2]);
  if (line === null) {
    return null;
  }

  return { path: match[1], line, column: parsePositiveInteger(match[3]) };
}

function getColonLocation(value: string): TerminalPathLocation | null {
  const match = value.match(/^(.*?):(\d+)(?::(\d+))?$/);
  if (!match || match[1].length === 0 || !/[\\/]/.test(match[1])) {
    return null;
  }

  const line = parsePositiveInteger(match[2]);
  if (line === null) {
    return null;
  }

  return { path: match[1], line, column: parsePositiveInteger(match[3]) };
}

function getSuffixLineLocation(value: string): TerminalPathLocation | null {
  const match = value.match(/^(.*)L(\d+)$/);
  if (!match || match[1].length === 0 || !/[\\/]/.test(match[1])) {
    return null;
  }

  const line = parsePositiveInteger(match[2]);
  const fileName = match[1].split(/[\\/]/).pop() ?? "";
  if (line === null || !fileName.includes(".")) {
    return null;
  }

  return { path: match[1], line, column: null };
}

function extractTerminalPathLocation(value: string): TerminalPathLocation {
  return (
    getHashLocation(value) ??
    getColonLocation(value) ??
    getSuffixLineLocation(value) ?? {
      path: value,
      line: null,
      column: null
    }
  );
}

function trimTerminalPathCandidate(rawValue: string) {
  let value = rawValue.trim();
  while (value.length > 0) {
    if (!TERMINAL_PATH_TRAILING_CHARS.has(value[value.length - 1])) {
      break;
    }
    value = value.slice(0, -1);
  }
  return value;
}

function normalizeTerminalPathCandidate(rawValue: string): TerminalPathCandidate | null {
  const trimmed = trimTerminalPathCandidate(rawValue);
  if (trimmed.length === 0) {
    return null;
  }

  const location = extractTerminalPathLocation(trimmed);
  const resolvedPath = location.path.trim();
  if (resolvedPath.length === 0) {
    return null;
  }

  return { resolvedPath, line: location.line, column: location.column };
}

function appendPathMatch(
  matches: TerminalPathMatch[],
  rawText: string,
  start: number,
  currentProjectPath: string
) {
  if (rawText.length === 0) {
    return;
  }

  const candidate = normalizeTerminalPathCandidate(rawText);
  if (!candidate || !isPathInsideBase(currentProjectPath, candidate.resolvedPath)) {
    return;
  }

  matches.push({
    start,
    end: start + rawText.length,
    displayText: rawText,
    resolvedPath: candidate.resolvedPath,
    line: candidate.line,
    column: candidate.column
  });
}

function collectQuotedMatches(matches: TerminalPathMatch[], lineText: string, currentProjectPath: string) {
  QUOTED_WINDOWS_PATH_REGEX.lastIndex = 0;
  for (let match = QUOTED_WINDOWS_PATH_REGEX.exec(lineText); match !== null; match = QUOTED_WINDOWS_PATH_REGEX.exec(lineText)) {
    if (match[2]) {
      appendPathMatch(matches, match[2], match.index + 1, currentProjectPath);
    }
  }

  QUOTED_POSIX_PATH_REGEX.lastIndex = 0;
  for (let match = QUOTED_POSIX_PATH_REGEX.exec(lineText); match !== null; match = QUOTED_POSIX_PATH_REGEX.exec(lineText)) {
    if (match[2]) {
      appendPathMatch(matches, match[2], match.index + 1, currentProjectPath);
    }
  }
}

function collectUnquotedMatches(matches: TerminalPathMatch[], lineText: string, currentProjectPath: string) {
  WINDOWS_PATH_REGEX.lastIndex = 0;
  for (let match = WINDOWS_PATH_REGEX.exec(lineText); match !== null; match = WINDOWS_PATH_REGEX.exec(lineText)) {
    appendPathMatch(matches, match[0], match.index, currentProjectPath);
  }

  POSIX_PATH_REGEX.lastIndex = 0;
  for (let match = POSIX_PATH_REGEX.exec(lineText); match !== null; match = POSIX_PATH_REGEX.exec(lineText)) {
    const rawText = match[1];
    if (!rawText) {
      continue;
    }

    const prefixLength = match[0].length - rawText.length;
    appendPathMatch(matches, rawText, match.index + prefixLength, currentProjectPath);
  }
}

function dedupePathMatches(matches: TerminalPathMatch[]) {
  if (matches.length <= 1) {
    return matches;
  }

  matches.sort((left, right) => left.start - right.start || right.end - left.end);
  const deduped: TerminalPathMatch[] = [];
  for (const match of matches) {
    if (deduped.length > 0) {
      const previous = deduped[deduped.length - 1];
      if (match.start < previous.end) {
        continue;
      }
    }
    deduped.push(match);
  }

  return deduped;
}

export function collectTerminalPathMatches(lineText: string, currentProjectPath: string) {
  const matches: TerminalPathMatch[] = [];
  collectQuotedMatches(matches, lineText, currentProjectPath);
  collectUnquotedMatches(matches, lineText, currentProjectPath);
  return dedupePathMatches(matches);
}
