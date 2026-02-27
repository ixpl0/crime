export function toContextDiffLines(content: string): GitDiffLine[] {
  const lines = content.split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  return lines.map((line) => ({ type: "context", text: line }));
}

export function diffLinePrefix(type: GitDiffLine["type"]) {
  if (type === "added") {
    return "+";
  }

  if (type === "removed") {
    return "-";
  }

  return "";
}
