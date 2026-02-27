import { resolve } from "node:path";

const GIT_STATUS_PRIORITY = {
  modified: 1,
  added: 2,
  deleted: 3
};

function getGitStatusKind(x, y) {
  if (x === "D" || y === "D") {
    return "deleted";
  }

  if (x === "A" || y === "A" || x === "?" || y === "?") {
    return "added";
  }

  return "modified";
}

function upsertGitStatus(statusByPath, absolutePath, nextStatus) {
  const currentStatus = statusByPath.get(absolutePath);
  if (!currentStatus) {
    statusByPath.set(absolutePath, nextStatus);
    return;
  }

  if (GIT_STATUS_PRIORITY[nextStatus] > GIT_STATUS_PRIORITY[currentStatus]) {
    statusByPath.set(absolutePath, nextStatus);
  }
}

export function parseGitStatusPorcelain(output, cwd) {
  const statusByPath = new Map();
  const records = output.split("\0");

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record || record.length < 4 || record[2] !== " ") {
      continue;
    }

    const x = record[0];
    const y = record[1];
    const firstPath = record.slice(3);
    const isRenameOrCopy = x === "R" || x === "C" || y === "R" || y === "C";

    if (isRenameOrCopy) {
      const secondPath = records[index + 1];
      index += 1;

      if (firstPath) {
        upsertGitStatus(statusByPath, resolve(cwd, firstPath), "modified");
      }

      if (typeof secondPath === "string" && secondPath.length > 0) {
        upsertGitStatus(statusByPath, resolve(cwd, secondPath), "modified");
      }
      continue;
    }

    if (!firstPath) {
      continue;
    }

    upsertGitStatus(statusByPath, resolve(cwd, firstPath), getGitStatusKind(x, y));
  }

  return Array.from(statusByPath.entries()).map(([path, status]) => ({ path, status }));
}

export function parseGitDiffLines(diffOutput) {
  const lines = [];
  const rawLines = diffOutput.split(/\r?\n/);
  let isInHunk = false;

  for (const rawLine of rawLines) {
    if (rawLine.startsWith("diff --git ")) {
      isInHunk = false;
      continue;
    }

    if (rawLine.startsWith("@@")) {
      isInHunk = true;
      continue;
    }

    if (!isInHunk || rawLine.startsWith("\\ No newline at end of file")) {
      continue;
    }

    if (rawLine.startsWith("+")) {
      lines.push({ type: "added", text: rawLine.slice(1) });
      continue;
    }

    if (rawLine.startsWith("-")) {
      lines.push({ type: "removed", text: rawLine.slice(1) });
      continue;
    }

    if (rawLine.startsWith(" ")) {
      lines.push({ type: "context", text: rawLine.slice(1) });
    }
  }

  return lines;
}

export function toLineEntries(content, type = "context") {
  const rawLines = content.split(/\r?\n/);
  if (rawLines.length > 0 && rawLines[rawLines.length - 1] === "") {
    rawLines.pop();
  }

  return rawLines.map((text) => ({ type, text }));
}

export function parseGitLogEntries(rawOutput, recordSeparator, fieldSeparator) {
  const records = rawOutput
    .split(recordSeparator)
    .filter((record) => record.trim().length > 0);
  const entries = [];

  for (const record of records) {
    const fields = record.trim().split(fieldSeparator);
    if (fields.length < 6) {
      continue;
    }

    const refs = fields[5].length > 0
      ? fields[5].split(",").map((ref) => ref.trim()).filter((ref) => ref.length > 0)
      : [];
    entries.push({
      hash: fields[0],
      parentHashes: fields[1].length > 0 ? fields[1].split(" ") : [],
      author: fields[2],
      date: fields[3],
      subject: fields[4],
      refs
    });
  }

  return entries;
}

export function parseCommitFileStats(statsOutput) {
  const files = [];
  const trimmed = statsOutput.trim();
  if (trimmed.length === 0) {
    return files;
  }

  for (const line of trimmed.split("\n")) {
    const parts = line.split("\t");
    if (parts.length < 3) {
      continue;
    }

    const additions = parts[0] === "-" ? 0 : parseInt(parts[0], 10);
    const deletions = parts[1] === "-" ? 0 : parseInt(parts[1], 10);
    const path = parts.slice(2).join("\t");
    files.push({ path, additions, deletions });
  }

  return files;
}
