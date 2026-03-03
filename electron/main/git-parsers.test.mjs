import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import {
  parseGitStatusPorcelain,
  parseGitDiffLines,
  toLineEntries,
  parseGitLogEntries,
  parseCommitFileStats
} from "./git-parsers.mjs";

describe("parseGitStatusPorcelain", () => {
  const cwd = "/project";

  it("returns empty array for empty output", () => {
    expect(parseGitStatusPorcelain("", cwd)).toEqual([]);
  });

  it("parses modified file", () => {
    const output = " M src/app.ts\0";
    const result = parseGitStatusPorcelain(output, cwd);
    expect(result).toEqual([
      { path: resolve(cwd, "src/app.ts"), status: "modified" }
    ]);
  });

  it("parses added file (staged)", () => {
    const output = "A  new-file.ts\0";
    const result = parseGitStatusPorcelain(output, cwd);
    expect(result).toEqual([
      { path: resolve(cwd, "new-file.ts"), status: "added" }
    ]);
  });

  it("parses untracked file as added", () => {
    const output = "?? untracked.ts\0";
    const result = parseGitStatusPorcelain(output, cwd);
    expect(result).toEqual([
      { path: resolve(cwd, "untracked.ts"), status: "added" }
    ]);
  });

  it("parses deleted file", () => {
    const output = " D removed.ts\0";
    const result = parseGitStatusPorcelain(output, cwd);
    expect(result).toEqual([
      { path: resolve(cwd, "removed.ts"), status: "deleted" }
    ]);
  });

  it("parses multiple entries", () => {
    const output = " M file1.ts\0A  file2.ts\0 D file3.ts\0";
    const result = parseGitStatusPorcelain(output, cwd);
    expect(result).toHaveLength(3);
    expect(result[0].status).toBe("modified");
    expect(result[1].status).toBe("added");
    expect(result[2].status).toBe("deleted");
  });

  it("handles rename entry (two paths)", () => {
    const output = "R  old-name.ts\0new-name.ts\0";
    const result = parseGitStatusPorcelain(output, cwd);
    expect(result).toEqual([
      { path: resolve(cwd, "old-name.ts"), status: "modified" },
      { path: resolve(cwd, "new-name.ts"), status: "modified" }
    ]);
  });

  it("handles copy entry", () => {
    const output = "C  source.ts\0copy.ts\0";
    const result = parseGitStatusPorcelain(output, cwd);
    expect(result).toHaveLength(2);
    expect(result[0].status).toBe("modified");
    expect(result[1].status).toBe("modified");
  });

  it("skips malformed records", () => {
    const output = "XX\0 M valid.ts\0ab\0";
    const result = parseGitStatusPorcelain(output, cwd);
    expect(result).toEqual([
      { path: resolve(cwd, "valid.ts"), status: "modified" }
    ]);
  });

  it("deleted status takes priority over other statuses for same path", () => {
    const output = " M file.ts\0 D file.ts\0";
    const result = parseGitStatusPorcelain(output, cwd);
    expect(result).toEqual([
      { path: resolve(cwd, "file.ts"), status: "deleted" }
    ]);
  });
});

describe("parseGitDiffLines", () => {
  it("returns empty array for empty diff", () => {
    expect(parseGitDiffLines("")).toEqual([]);
  });

  it("parses added lines", () => {
    const diff = "diff --git a/f.ts b/f.ts\n@@ -0,0 +1,2 @@\n+line one\n+line two\n";
    const result = parseGitDiffLines(diff);
    expect(result).toEqual([
      { type: "added", text: "line one" },
      { type: "added", text: "line two" }
    ]);
  });

  it("parses removed lines", () => {
    const diff = "diff --git a/f.ts b/f.ts\n@@ -1,2 +0,0 @@\n-old one\n-old two\n";
    const result = parseGitDiffLines(diff);
    expect(result).toEqual([
      { type: "removed", text: "old one" },
      { type: "removed", text: "old two" }
    ]);
  });

  it("parses context lines", () => {
    const diff = "diff --git a/f.ts b/f.ts\n@@ -1,3 +1,3 @@\n unchanged\n-old\n+new\n unchanged\n";
    const result = parseGitDiffLines(diff);
    expect(result).toEqual([
      { type: "context", text: "unchanged" },
      { type: "removed", text: "old" },
      { type: "added", text: "new" },
      { type: "context", text: "unchanged" }
    ]);
  });

  it("skips 'No newline at end of file' marker", () => {
    const diff = "diff --git a/f.ts b/f.ts\n@@ -1 +1 @@\n-old\n\\ No newline at end of file\n+new\n";
    const result = parseGitDiffLines(diff);
    expect(result).toEqual([
      { type: "removed", text: "old" },
      { type: "added", text: "new" }
    ]);
  });

  it("ignores lines before first hunk", () => {
    const diff = "diff --git a/f.ts b/f.ts\nindex abc..def 100644\n--- a/f.ts\n+++ b/f.ts\n@@ -1 +1 @@\n+added\n";
    const result = parseGitDiffLines(diff);
    expect(result).toEqual([{ type: "added", text: "added" }]);
  });

  it("handles multiple hunks", () => {
    const diff = [
      "diff --git a/f.ts b/f.ts",
      "@@ -1,2 +1,2 @@",
      "-old1",
      "+new1",
      "@@ -10,2 +10,2 @@",
      "-old2",
      "+new2"
    ].join("\n");
    const result = parseGitDiffLines(diff);
    expect(result).toEqual([
      { type: "removed", text: "old1" },
      { type: "added", text: "new1" },
      { type: "removed", text: "old2" },
      { type: "added", text: "new2" }
    ]);
  });
});

describe("toLineEntries", () => {
  it("splits content into context lines by default", () => {
    const result = toLineEntries("line1\nline2\nline3\n");
    expect(result).toEqual([
      { type: "context", text: "line1" },
      { type: "context", text: "line2" },
      { type: "context", text: "line3" }
    ]);
  });

  it("supports custom line type", () => {
    const result = toLineEntries("a\nb\n", "added");
    expect(result).toEqual([
      { type: "added", text: "a" },
      { type: "added", text: "b" }
    ]);
  });

  it("handles content without trailing newline", () => {
    const result = toLineEntries("only");
    expect(result).toEqual([{ type: "context", text: "only" }]);
  });

  it("handles empty content", () => {
    const result = toLineEntries("");
    expect(result).toEqual([]);
  });

  it("handles CRLF line endings", () => {
    const result = toLineEntries("a\r\nb\r\n");
    expect(result).toEqual([
      { type: "context", text: "a" },
      { type: "context", text: "b" }
    ]);
  });
});

describe("parseGitLogEntries", () => {
  const recordSep = "<<RECORD>>";
  const fieldSep = "<<FIELD>>";

  it("returns empty array for empty output", () => {
    expect(parseGitLogEntries("", recordSep, fieldSep)).toEqual([]);
  });

  it("parses single commit entry", () => {
    const raw = [
      "abc1234",
      "parent1 parent2",
      "Author Name",
      "2024-01-15",
      "Initial commit",
      "HEAD -> main, origin/main"
    ].join(fieldSep);
    const result = parseGitLogEntries(recordSep + raw, recordSep, fieldSep);
    expect(result).toEqual([
      {
        hash: "abc1234",
        parentHashes: ["parent1", "parent2"],
        author: "Author Name",
        date: "2024-01-15",
        subject: "Initial commit",
        refs: ["HEAD -> main", "origin/main"]
      }
    ]);
  });

  it("handles commit with no parents (root commit)", () => {
    const raw = ["abc", "", "Author", "2024-01-01", "root", ""].join(fieldSep);
    const result = parseGitLogEntries(recordSep + raw, recordSep, fieldSep);
    expect(result[0].parentHashes).toEqual([]);
  });

  it("handles commit with no refs", () => {
    const raw = ["abc", "parent", "Author", "2024-01-01", "msg", ""].join(fieldSep);
    const result = parseGitLogEntries(recordSep + raw, recordSep, fieldSep);
    expect(result[0].refs).toEqual([]);
  });

  it("skips records with fewer than 6 fields", () => {
    const malformed = ["abc", "parent", "Author"].join(fieldSep);
    const valid = ["def", "p", "A", "2024-01-01", "msg", ""].join(fieldSep);
    const output = recordSep + malformed + recordSep + valid;
    const result = parseGitLogEntries(output, recordSep, fieldSep);
    expect(result).toHaveLength(1);
    expect(result[0].hash).toBe("def");
  });

  it("parses multiple entries", () => {
    const entry1 = ["aaa", "", "A1", "2024-01-01", "first", ""].join(fieldSep);
    const entry2 = ["bbb", "aaa", "A2", "2024-01-02", "second", ""].join(fieldSep);
    const output = recordSep + entry1 + recordSep + entry2;
    const result = parseGitLogEntries(output, recordSep, fieldSep);
    expect(result).toHaveLength(2);
  });
});

describe("parseCommitFileStats", () => {
  it("returns empty array for empty output", () => {
    expect(parseCommitFileStats("")).toEqual([]);
  });

  it("returns empty array for whitespace-only output", () => {
    expect(parseCommitFileStats("   \n  ")).toEqual([]);
  });

  it("parses normal file stats", () => {
    const output = "10\t5\tsrc/app.ts";
    const result = parseCommitFileStats(output);
    expect(result).toEqual([
      { path: "src/app.ts", additions: 10, deletions: 5 }
    ]);
  });

  it("handles binary files (dash notation)", () => {
    const output = "-\t-\timage.png";
    const result = parseCommitFileStats(output);
    expect(result).toEqual([
      { path: "image.png", additions: 0, deletions: 0 }
    ]);
  });

  it("parses multiple files", () => {
    const output = "3\t1\ta.ts\n0\t10\tb.ts\n20\t0\tc.ts";
    const result = parseCommitFileStats(output);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ path: "a.ts", additions: 3, deletions: 1 });
    expect(result[1]).toEqual({ path: "b.ts", additions: 0, deletions: 10 });
    expect(result[2]).toEqual({ path: "c.ts", additions: 20, deletions: 0 });
  });

  it("handles path with tab characters", () => {
    const output = "5\t3\tpath\twith\ttab";
    const result = parseCommitFileStats(output);
    expect(result).toEqual([
      { path: "path\twith\ttab", additions: 5, deletions: 3 }
    ]);
  });

  it("skips malformed lines", () => {
    const output = "bad line\n10\t5\tvalid.ts";
    const result = parseCommitFileStats(output);
    expect(result).toEqual([
      { path: "valid.ts", additions: 10, deletions: 5 }
    ]);
  });
});
