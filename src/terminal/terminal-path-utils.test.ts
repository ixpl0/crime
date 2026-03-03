import { describe, it, expect } from "vitest";
import { collectTerminalPathMatches, type TerminalPathMatch } from "./terminal-path-utils";

const PROJECT_WIN = "D:\\projects\\myapp";
const PROJECT_POSIX = "/home/user/myapp";

function matchPaths(matches: TerminalPathMatch[]) {
  return matches.map(({ resolvedPath, line, column }) => ({ resolvedPath, line, column }));
}

function matchPositions(matches: TerminalPathMatch[]) {
  return matches.map(({ start, end, displayText }) => ({ start, end, displayText }));
}

describe("collectTerminalPathMatches", () => {
  describe("Windows paths (unquoted)", () => {
    it("matches a simple Windows path inside the project", () => {
      const matches = collectTerminalPathMatches(
        "Error in D:\\projects\\myapp\\src\\index.ts",
        PROJECT_WIN
      );
      expect(matchPaths(matches)).toEqual([
        { resolvedPath: "D:\\projects\\myapp\\src\\index.ts", line: null, column: null }
      ]);
    });

    it("matches a Windows path with forward slashes", () => {
      const matches = collectTerminalPathMatches(
        "File: D:/projects/myapp/src/main.ts",
        PROJECT_WIN
      );
      expect(matchPaths(matches)).toEqual([
        { resolvedPath: "D:/projects/myapp/src/main.ts", line: null, column: null }
      ]);
    });

    it("does not match paths outside the project", () => {
      const matches = collectTerminalPathMatches(
        "C:\\other\\project\\file.ts",
        PROJECT_WIN
      );
      expect(matches).toEqual([]);
    });

    it("extracts line number from colon suffix", () => {
      const matches = collectTerminalPathMatches(
        "D:\\projects\\myapp\\src\\index.ts:42",
        PROJECT_WIN
      );
      expect(matchPaths(matches)).toEqual([
        { resolvedPath: "D:\\projects\\myapp\\src\\index.ts", line: 42, column: null }
      ]);
    });

    it("extracts line and column from colon suffix", () => {
      const matches = collectTerminalPathMatches(
        "D:\\projects\\myapp\\src\\index.ts:42:10",
        PROJECT_WIN
      );
      expect(matchPaths(matches)).toEqual([
        { resolvedPath: "D:\\projects\\myapp\\src\\index.ts", line: 42, column: 10 }
      ]);
    });

    it("matches multiple Windows paths on one line", () => {
      const matches = collectTerminalPathMatches(
        "Compare D:\\projects\\myapp\\a.ts and D:\\projects\\myapp\\b.ts",
        PROJECT_WIN
      );
      expect(matches).toHaveLength(2);
      expect(matchPaths(matches)).toEqual([
        { resolvedPath: "D:\\projects\\myapp\\a.ts", line: null, column: null },
        { resolvedPath: "D:\\projects\\myapp\\b.ts", line: null, column: null }
      ]);
    });
  });

  describe("POSIX paths (unquoted)", () => {
    it("matches a simple POSIX path inside the project", () => {
      const matches = collectTerminalPathMatches(
        "Error in /home/user/myapp/src/index.ts",
        PROJECT_POSIX
      );
      expect(matchPaths(matches)).toEqual([
        { resolvedPath: "/home/user/myapp/src/index.ts", line: null, column: null }
      ]);
    });

    it("does not match paths outside the project", () => {
      const matches = collectTerminalPathMatches(
        "/etc/nginx/nginx.conf",
        PROJECT_POSIX
      );
      expect(matches).toEqual([]);
    });

    it("extracts line number from colon suffix", () => {
      const matches = collectTerminalPathMatches(
        "/home/user/myapp/src/index.ts:15",
        PROJECT_POSIX
      );
      expect(matchPaths(matches)).toEqual([
        { resolvedPath: "/home/user/myapp/src/index.ts", line: 15, column: null }
      ]);
    });

    it("extracts line and column from colon suffix", () => {
      const matches = collectTerminalPathMatches(
        "/home/user/myapp/src/index.ts:15:8",
        PROJECT_POSIX
      );
      expect(matchPaths(matches)).toEqual([
        { resolvedPath: "/home/user/myapp/src/index.ts", line: 15, column: 8 }
      ]);
    });

    it("matches path preceded by whitespace", () => {
      const matches = collectTerminalPathMatches(
        "  /home/user/myapp/lib/util.ts",
        PROJECT_POSIX
      );
      expect(matchPaths(matches)).toEqual([
        { resolvedPath: "/home/user/myapp/lib/util.ts", line: null, column: null }
      ]);
    });

    it("matches path preceded by bracket or paren", () => {
      const matches = collectTerminalPathMatches(
        "(/home/user/myapp/src/main.ts)",
        PROJECT_POSIX
      );
      expect(matchPaths(matches)).toEqual([
        { resolvedPath: "/home/user/myapp/src/main.ts", line: null, column: null }
      ]);
    });
  });

  describe("quoted paths", () => {
    it("matches double-quoted Windows path", () => {
      const matches = collectTerminalPathMatches(
        'File "D:\\projects\\myapp\\src\\app.ts" not found',
        PROJECT_WIN
      );
      expect(matchPaths(matches)).toEqual([
        { resolvedPath: "D:\\projects\\myapp\\src\\app.ts", line: null, column: null }
      ]);
    });

    it("matches single-quoted Windows path", () => {
      const matches = collectTerminalPathMatches(
        "File 'D:\\projects\\myapp\\src\\app.ts' modified",
        PROJECT_WIN
      );
      expect(matchPaths(matches)).toEqual([
        { resolvedPath: "D:\\projects\\myapp\\src\\app.ts", line: null, column: null }
      ]);
    });

    it("matches double-quoted POSIX path", () => {
      const matches = collectTerminalPathMatches(
        'Opening "/home/user/myapp/config.json"',
        PROJECT_POSIX
      );
      expect(matchPaths(matches)).toEqual([
        { resolvedPath: "/home/user/myapp/config.json", line: null, column: null }
      ]);
    });

    it("matches single-quoted POSIX path", () => {
      const matches = collectTerminalPathMatches(
        "Opening '/home/user/myapp/config.json'",
        PROJECT_POSIX
      );
      expect(matchPaths(matches)).toEqual([
        { resolvedPath: "/home/user/myapp/config.json", line: null, column: null }
      ]);
    });
  });

  describe("hash location format (#L)", () => {
    it("extracts line from #L suffix on Windows path", () => {
      const matches = collectTerminalPathMatches(
        "D:\\projects\\myapp\\src\\file.ts#L25",
        PROJECT_WIN
      );
      expect(matchPaths(matches)).toEqual([
        { resolvedPath: "D:\\projects\\myapp\\src\\file.ts", line: 25, column: null }
      ]);
    });

    it("extracts line and column from #LC suffix", () => {
      const matches = collectTerminalPathMatches(
        "D:\\projects\\myapp\\src\\file.ts#L25C3",
        PROJECT_WIN
      );
      expect(matchPaths(matches)).toEqual([
        { resolvedPath: "D:\\projects\\myapp\\src\\file.ts", line: 25, column: 3 }
      ]);
    });
  });

  describe("trailing character trimming", () => {
    it("trims trailing comma", () => {
      const matches = collectTerminalPathMatches(
        "D:\\projects\\myapp\\src\\file.ts,",
        PROJECT_WIN
      );
      expect(matchPaths(matches)).toEqual([
        { resolvedPath: "D:\\projects\\myapp\\src\\file.ts", line: null, column: null }
      ]);
    });

    it("trims trailing semicolon", () => {
      const matches = collectTerminalPathMatches(
        "D:\\projects\\myapp\\src\\file.ts;",
        PROJECT_WIN
      );
      expect(matchPaths(matches)).toEqual([
        { resolvedPath: "D:\\projects\\myapp\\src\\file.ts", line: null, column: null }
      ]);
    });

    it("trims trailing parenthesis", () => {
      const matches = collectTerminalPathMatches(
        "(D:\\projects\\myapp\\src\\file.ts)",
        PROJECT_WIN
      );
      expect(matchPaths(matches)).toEqual([
        { resolvedPath: "D:\\projects\\myapp\\src\\file.ts", line: null, column: null }
      ]);
    });

    it("trims multiple trailing special characters", () => {
      const matches = collectTerminalPathMatches(
        "D:\\projects\\myapp\\src\\file.ts);",
        PROJECT_WIN
      );
      expect(matchPaths(matches)).toEqual([
        { resolvedPath: "D:\\projects\\myapp\\src\\file.ts", line: null, column: null }
      ]);
    });
  });

  describe("match positions", () => {
    it("returns correct start and end offsets for Windows path", () => {
      const matches = collectTerminalPathMatches(
        "Error in D:\\projects\\myapp\\src\\file.ts here",
        PROJECT_WIN
      );
      expect(matchPositions(matches)).toEqual([
        { start: 9, end: 38, displayText: "D:\\projects\\myapp\\src\\file.ts" }
      ]);
    });

    it("returns correct offsets for quoted path (excludes quotes)", () => {
      const matches = collectTerminalPathMatches(
        'See "D:\\projects\\myapp\\a.ts" for details',
        PROJECT_WIN
      );
      expect(matchPositions(matches)).toEqual([
        { start: 5, end: 27, displayText: "D:\\projects\\myapp\\a.ts" }
      ]);
    });
  });

  describe("deduplication", () => {
    it("removes overlapping matches keeping the earlier one", () => {
      const text = "D:\\projects\\myapp\\src\\file.ts:10";
      const matches = collectTerminalPathMatches(text, PROJECT_WIN);
      const paths = matchPaths(matches);
      const unique = new Set(paths.map((match) => match.resolvedPath));
      expect(unique.size).toBe(1);
    });
  });

  describe("edge cases", () => {
    it("returns empty array for empty input", () => {
      expect(collectTerminalPathMatches("", PROJECT_WIN)).toEqual([]);
    });

    it("returns empty array for text without paths", () => {
      expect(collectTerminalPathMatches("hello world", PROJECT_WIN)).toEqual([]);
    });

    it("ignores zero or negative line numbers", () => {
      const matches = collectTerminalPathMatches(
        "D:\\projects\\myapp\\src\\file.ts:0",
        PROJECT_WIN
      );
      const paths = matchPaths(matches);
      expect(paths.every((match) => match.line === null || match.line > 0)).toBe(true);
    });

    it("handles path with trailing slash", () => {
      const matches = collectTerminalPathMatches(
        "/home/user/myapp/src/",
        PROJECT_POSIX
      );
      expect(matchPaths(matches)).toEqual([
        { resolvedPath: "/home/user/myapp/src/", line: null, column: null }
      ]);
    });
  });
});
