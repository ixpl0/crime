export interface GraphLine {
  fromLane: number;
  toLane: number;
  fromTop: boolean;
  toBottom: boolean;
  colorLane: number;
}

export interface GraphRow {
  commit: GitLogEntry;
  lane: number;
  colorLane: number;
  lines: GraphLine[];
}

function findCommitLaneIndices(activeLanes: readonly string[], hash: string) {
  const indices: number[] = [];
  for (let index = 0; index < activeLanes.length; index += 1) {
    if (activeLanes[index] === hash) {
      indices.push(index);
    }
  }

  return indices;
}

function ensureCommitLane(activeLanes: string[], hash: string, commitLanes: number[]) {
  if (commitLanes.length > 0) {
    return { commitLane: commitLanes[0], isNewLane: false };
  }

  const commitLane = activeLanes.length;
  activeLanes.push(hash);
  commitLanes.push(commitLane);
  return { commitLane, isNewLane: true };
}

function appendTopLines(
  lines: GraphLine[],
  activeLanes: readonly string[],
  commitHash: string,
  commitLane: number,
  isNewLane: boolean
) {
  const continuingLanes = new Set<number>();
  for (let laneIndex = 0; laneIndex < activeLanes.length; laneIndex += 1) {
    const laneHash = activeLanes[laneIndex];
    if (laneHash === "") {
      continue;
    }

    if (laneHash !== commitHash) {
      lines.push({ fromLane: laneIndex, toLane: laneIndex, fromTop: true, toBottom: false, colorLane: laneIndex });
      continuingLanes.add(laneIndex);
      continue;
    }

    if (laneIndex !== commitLane) {
      lines.push({ fromLane: laneIndex, toLane: commitLane, fromTop: true, toBottom: false, colorLane: laneIndex });
      continue;
    }

    if (!isNewLane) {
      lines.push({ fromLane: laneIndex, toLane: laneIndex, fromTop: true, toBottom: false, colorLane: laneIndex });
    }
  }

  return continuingLanes;
}

function clearConsumedLanes(nextLanes: string[], commitLanes: readonly number[]) {
  for (const lane of commitLanes) {
    nextLanes[lane] = "";
  }
}

function resolveParentTargetLane(
  nextLanes: readonly string[],
  parentHash: string,
  parentIndex: number,
  commitLane: number,
  commitLanes: readonly number[]
) {
  if (parentIndex === 0) {
    return commitLane;
  }

  const existingLane = nextLanes.indexOf(parentHash);
  if (existingLane !== -1) {
    return existingLane;
  }

  if (parentIndex < commitLanes.length) {
    return commitLanes[parentIndex];
  }

  const emptyLane = nextLanes.indexOf("");
  return emptyLane !== -1 ? emptyLane : nextLanes.length;
}

function appendParentLines(
  lines: GraphLine[],
  nextLanes: string[],
  commitLane: number,
  parentHashes: readonly string[],
  commitLanes: readonly number[]
) {
  for (let parentIndex = 0; parentIndex < parentHashes.length; parentIndex += 1) {
    const parentHash = parentHashes[parentIndex];
    const targetLane = resolveParentTargetLane(
      nextLanes,
      parentHash,
      parentIndex,
      commitLane,
      commitLanes
    );
    nextLanes[targetLane] = parentHash;
    lines.push({
      fromLane: commitLane,
      toLane: targetLane,
      fromTop: false,
      toBottom: true,
      colorLane: parentIndex === 0 ? commitLane : targetLane
    });
  }
}

function appendContinuingLines(lines: GraphLine[], continuingLanes: Iterable<number>) {
  for (const laneIndex of continuingLanes) {
    lines.push({
      fromLane: laneIndex,
      toLane: laneIndex,
      fromTop: false,
      toBottom: true,
      colorLane: laneIndex
    });
  }
}

function buildCompactionIndexMap(nextLanes: readonly string[]) {
  const indexMap = new Map<number, number>();
  let mappedIndex = 0;
  for (let index = 0; index < nextLanes.length; index += 1) {
    if (nextLanes[index] !== "") {
      indexMap.set(index, mappedIndex);
      mappedIndex += 1;
    }
  }

  return indexMap;
}

function compactColorLanes(nextLanes: readonly string[], colorLanes: readonly number[]) {
  const compacted: number[] = [];
  for (let index = 0; index < nextLanes.length; index += 1) {
    if (nextLanes[index] !== "") {
      compacted.push(index < colorLanes.length ? colorLanes[index] : index);
    }
  }

  return compacted;
}

function compactLanes(
  nextLanes: readonly string[],
  lines: readonly GraphLine[],
  colorLanes: readonly number[]
) {
  const hasEmptyLane = nextLanes.some((hash) => hash === "");
  if (!hasEmptyLane) {
    return { compactedLanes: [...nextLanes], remappedLines: [...lines], compactedColorLanes: [...colorLanes] };
  }

  const indexMap = buildCompactionIndexMap(nextLanes);
  const remappedLines = lines.map((line) => {
    if (!line.toBottom) {
      return line;
    }

    const mappedLane = indexMap.get(line.toLane);
    return mappedLane !== undefined && mappedLane !== line.toLane
      ? { ...line, toLane: mappedLane }
      : line;
  });

  return {
    compactedLanes: nextLanes.filter((hash) => hash !== ""),
    remappedLines,
    compactedColorLanes: compactColorLanes(nextLanes, colorLanes)
  };
}

function applyColorLanes(lines: readonly GraphLine[], colorLanes: readonly number[]): GraphLine[] {
  return lines.map((line) => {
    const mappedColor = colorLanes[line.colorLane];
    return mappedColor !== line.colorLane ? { ...line, colorLane: mappedColor } : line;
  });
}

function extendColorLanes(colorLanes: number[], targetLength: number, startIndex: number) {
  let index = startIndex;
  while (colorLanes.length < targetLength) {
    colorLanes.push(index);
    index += 1;
  }

  return index;
}

export function buildGitGraphRows(entries: readonly GitLogEntry[]): GraphRow[] {
  if (entries.length === 0) {
    return [];
  }

  const rows: GraphRow[] = [];
  let activeLanes: string[] = [];
  let colorLanes: number[] = [];
  let nextColorIndex = 0;
  for (const commit of entries) {
    const commitLanes = findCommitLaneIndices(activeLanes, commit.hash);
    const { commitLane, isNewLane } = ensureCommitLane(activeLanes, commit.hash, commitLanes);
    nextColorIndex = extendColorLanes(colorLanes, activeLanes.length, nextColorIndex);
    const lines: GraphLine[] = [];
    const continuingLanes = appendTopLines(lines, activeLanes, commit.hash, commitLane, isNewLane);
    const nextLanes = [...activeLanes];
    clearConsumedLanes(nextLanes, commitLanes);
    appendParentLines(lines, nextLanes, commitLane, commit.parentHashes, commitLanes);
    appendContinuingLines(lines, continuingLanes);
    nextColorIndex = extendColorLanes(colorLanes, nextLanes.length, nextColorIndex);
    const colorMappedLines = applyColorLanes(lines, colorLanes);
    const commitColorLane = colorLanes[commitLane];
    const { compactedLanes, remappedLines, compactedColorLanes } = compactLanes(nextLanes, colorMappedLines, colorLanes);
    activeLanes = compactedLanes;
    colorLanes = compactedColorLanes;
    rows.push({ commit, lane: commitLane, colorLane: commitColorLane, lines: remappedLines });
  }

  return rows;
}
