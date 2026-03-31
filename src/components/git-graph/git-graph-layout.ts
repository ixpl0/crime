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

function appendVerticalLines(
  lines: GraphLine[],
  activeLanes: readonly string[],
  commitLane: number,
  isNewLane: boolean
) {
  // Top half: vertical segment into the commit circle
  if (!isNewLane) {
    lines.push({ fromLane: commitLane, toLane: commitLane, fromTop: true, toBottom: false, colorLane: commitLane });
  }

  // Bottom half: vertical segment out of the commit circle (for first parent)
  lines.push({ fromLane: commitLane, toLane: commitLane, fromTop: false, toBottom: true, colorLane: commitLane });
}

function appendContinuingLines(
  lines: GraphLine[],
  activeLanes: readonly string[],
  commitHash: string,
  commitLane: number
) {
  for (let laneIndex = 0; laneIndex < activeLanes.length; laneIndex += 1) {
    const laneHash = activeLanes[laneIndex];
    if (laneHash === "" || laneIndex === commitLane) {
      continue;
    }

    if (laneHash === commitHash) {
      // Висячий конец: ветка сходится к коммиту, цвет — этой ветки
      lines.push({ fromLane: laneIndex, toLane: commitLane, fromTop: true, toBottom: false, colorLane: laneIndex });
      continue;
    }

    lines.push({ fromLane: laneIndex, toLane: laneIndex, fromTop: true, toBottom: false, colorLane: laneIndex });
    lines.push({ fromLane: laneIndex, toLane: laneIndex, fromTop: false, toBottom: true, colorLane: laneIndex });
  }
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

function appendParentLanes(
  lines: GraphLine[],
  deferredLines: GraphLine[],
  nextLanes: string[],
  commitLane: number,
  parentHashes: readonly string[],
  commitLanes: readonly number[]
) {
  for (let parentIndex = 0; parentIndex < parentHashes.length; parentIndex += 1) {
    const parentHash = parentHashes[parentIndex];
    const targetLane = resolveParentTargetLane(nextLanes, parentHash, parentIndex, commitLane, commitLanes);
    nextLanes[targetLane] = parentHash;

    if (parentIndex > 0 && targetLane > commitLane) {
      // Мерж слева направо: от кружка к низу правой ветки
      lines.push({
        fromLane: commitLane, toLane: targetLane,
        fromTop: false, toBottom: true, colorLane: targetLane
      });
    } else if (parentIndex > 0 && targetLane < commitLane) {
      // Мерж справа налево: от низа отрезка под кружком — в следующем ряду
      deferredLines.push({
        fromLane: commitLane, toLane: targetLane,
        fromTop: true, toBottom: false, colorLane: commitLane
      });
    }
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

interface LayoutState {
  activeLanes: string[];
  colorLanes: number[];
  nextColorIndex: number;
  pendingDeferred: GraphLine[];
}

function buildRow(commit: GitLogEntry, state: LayoutState) {
  const commitLanes = findCommitLaneIndices(state.activeLanes, commit.hash);
  const { commitLane, isNewLane } = ensureCommitLane(state.activeLanes, commit.hash, commitLanes);
  state.nextColorIndex = extendColorLanes(state.colorLanes, state.activeLanes.length, state.nextColorIndex);
  const lines: GraphLine[] = [...state.pendingDeferred];
  state.pendingDeferred = [];
  appendVerticalLines(lines, state.activeLanes, commitLane, isNewLane);
  appendContinuingLines(lines, state.activeLanes, commit.hash, commitLane);
  const nextLanes = [...state.activeLanes];
  clearConsumedLanes(nextLanes, commitLanes);
  const deferredLines: GraphLine[] = [];
  appendParentLanes(lines, deferredLines, nextLanes, commitLane, commit.parentHashes, commitLanes);
  state.nextColorIndex = extendColorLanes(state.colorLanes, nextLanes.length, state.nextColorIndex);
  const colorMappedLines = applyColorLanes(lines, state.colorLanes);
  const commitColorLane = state.colorLanes[commitLane];
  const { compactedLanes, remappedLines, compactedColorLanes } = compactLanes(nextLanes, colorMappedLines, state.colorLanes);
  state.pendingDeferred = compactLanes(nextLanes, applyColorLanes(deferredLines, state.colorLanes), state.colorLanes).remappedLines;
  state.activeLanes = compactedLanes;
  state.colorLanes = compactedColorLanes;
  return { commit, lane: commitLane, colorLane: commitColorLane, lines: remappedLines };
}

export function buildGitGraphRows(entries: readonly GitLogEntry[]): GraphRow[] {
  if (entries.length === 0) {
    return [];
  }

  const state: LayoutState = { activeLanes: [], colorLanes: [], nextColorIndex: 0, pendingDeferred: [] };
  return entries.map((commit) => buildRow(commit, state));
}
