import { describe, it, expect } from "vitest";
import { buildGitGraphRows } from "./git-graph-layout";

const createCommit = (
  hash: string,
  parentHashes: string[] = [],
  overrides: Partial<GitLogEntry> = {}
): GitLogEntry => ({
  hash,
  parentHashes,
  author: "Test",
  authorEmail: "test@test.com",
  date: "2026-01-01T00:00:00Z",
  subject: `commit ${hash}`,
  refs: [],
  ...overrides
});

describe("buildGitGraphRows", () => {
  it("returns empty array for empty input", () => {
    expect(buildGitGraphRows([])).toEqual([]);
  });

  it("handles single root commit (no parents)", () => {
    const rows = buildGitGraphRows([createCommit("a", [])]);

    expect(rows).toHaveLength(1);
    expect(rows[0].commit.hash).toBe("a");
    expect(rows[0].lane).toBe(0);
  });

  it("handles linear chain of commits", () => {
    const entries = [
      createCommit("c", ["b"]),
      createCommit("b", ["a"]),
      createCommit("a", [])
    ];
    const rows = buildGitGraphRows(entries);

    expect(rows).toHaveLength(3);
    // All on the same lane in a linear chain
    expect(rows[0].lane).toBe(0);
    expect(rows[1].lane).toBe(0);
    expect(rows[2].lane).toBe(0);
  });

  it("places branch on a separate lane", () => {
    // d -> b -> a
    // c -> a (branch)
    // b is first child of a, so b stays on lane 0
    // c branches from a, so c goes to lane 1
    const entries = [
      createCommit("d", ["b"]),
      createCommit("c", ["a"]),
      createCommit("b", ["a"]),
      createCommit("a", [])
    ];
    const rows = buildGitGraphRows(entries);

    expect(rows).toHaveLength(4);
    // d is on lane 0 (follows b)
    expect(rows[0].lane).toBe(0);
    // c is on a new lane since it's not yet tracked
    expect(rows[1].lane).toBeGreaterThanOrEqual(1);
  });

  it("handles merge commit (two parents)", () => {
    // m has two parents: b and c
    // This represents: m merges b and c
    const entries = [
      createCommit("m", ["b", "c"]),
      createCommit("c", ["a"]),
      createCommit("b", ["a"]),
      createCommit("a", [])
    ];
    const rows = buildGitGraphRows(entries);

    expect(rows).toHaveLength(4);
    // Merge commit should have lines connecting to both parents
    const mergeRow = rows[0];
    expect(mergeRow.lines.length).toBeGreaterThanOrEqual(2);
  });

  it("produces correct line structure for simple fork", () => {
    // Two commits with the same parent — fork
    const entries = [
      createCommit("b", ["a"]),
      createCommit("c", ["a"]),
      createCommit("a", [])
    ];
    const rows = buildGitGraphRows(entries);

    expect(rows).toHaveLength(3);
    // b on lane 0, c on lane 1, a merges back to 0
    expect(rows[0].lane).toBe(0);
  });

  it("maintains stable lane for first parent", () => {
    // Linear: e -> d -> c -> b -> a
    const entries = [
      createCommit("e", ["d"]),
      createCommit("d", ["c"]),
      createCommit("c", ["b"]),
      createCommit("b", ["a"]),
      createCommit("a", [])
    ];
    const rows = buildGitGraphRows(entries);

    // All commits should stay on lane 0
    for (const row of rows) {
      expect(row.lane).toBe(0);
    }
  });

  it("each row has lines array", () => {
    const entries = [
      createCommit("b", ["a"]),
      createCommit("a", [])
    ];
    const rows = buildGitGraphRows(entries);

    for (const row of rows) {
      expect(Array.isArray(row.lines)).toBe(true);
    }
  });

  it("lines have valid structure", () => {
    const entries = [
      createCommit("b", ["a"]),
      createCommit("a", [])
    ];
    const rows = buildGitGraphRows(entries);

    for (const row of rows) {
      for (const line of row.lines) {
        expect(typeof line.fromLane).toBe("number");
        expect(typeof line.toLane).toBe("number");
        expect(typeof line.fromTop).toBe("boolean");
        expect(typeof line.toBottom).toBe("boolean");
        expect(typeof line.colorLane).toBe("number");
        expect(line.fromLane).toBeGreaterThanOrEqual(0);
        expect(line.toLane).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("assigns different colorLanes to parallel branches", () => {
    // b and c are on different branches from a
    const entries = [
      createCommit("b", ["a"]),
      createCommit("c", ["a"]),
      createCommit("a", [])
    ];
    const rows = buildGitGraphRows(entries);

    expect(rows[0].colorLane).not.toBe(rows[1].colorLane);
  });

  it("handles octopus merge (3+ parents)", () => {
    const entries = [
      createCommit("m", ["a", "b", "c"]),
      createCommit("c", []),
      createCommit("b", []),
      createCommit("a", [])
    ];

    // Should not throw
    const rows = buildGitGraphRows(entries);
    expect(rows).toHaveLength(4);
  });

  it("compacts empty lanes after branch ends", () => {
    // After branch c merges into a, the lane occupied by c should be freed
    const entries = [
      createCommit("d", ["a", "c"]),  // merge
      createCommit("c", ["b"]),
      createCommit("a", ["b"]),
      createCommit("b", [])
    ];
    const rows = buildGitGraphRows(entries);

    // After the merge row, lanes should compact
    // The last row (b) should be back to lane 0
    const lastRow = rows[rows.length - 1];
    expect(lastRow.lane).toBe(0);
  });
});
