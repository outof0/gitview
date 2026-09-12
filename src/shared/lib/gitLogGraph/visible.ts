import type { LogCommitEntry } from "../../types/log";
import { displayLane } from "./dag";
import {
  colorLaneForLayoutIndex,
  importantHeadStarts,
} from "./fragmentColor";
import {
  GIT_LOG_GRAPH_ROW_HEIGHT,
  gitLogGraphWidth,
} from "./geometry";
import type {
  GitLogGraphEdge,
  GitLogGraphLayout,
  GitLogGraphTransition,
  PermanentGraph,
} from "./types";

export type VisibleGraphCommit = {
  sha: string;
  row: number;
  parentShas?: string[];
  parentPresent?: boolean[];
};

function followHiddenParent(
  parentSha: string,
  hiddenShas: ReadonlySet<string> | undefined,
  loadedBySha: ReadonlyMap<string, VisibleGraphCommit>,
): string {
  let current = parentSha;
  const seen = new Set<string>();
  while (hiddenShas?.has(current) && !seen.has(current)) {
    seen.add(current);
    const hidden = loadedBySha.get(current);
    const next = hidden?.parentShas?.[0];
    if (!next) {
      break;
    }
    current = next;
  }
  return current;
}

/**
 * Map the immutable DAG onto the current list rows. Filters, collapse, and
 * paging only change which nodes/edges are printed — never layoutIndex.
 */
export function buildVisibleGraphLayout(
  graph: PermanentGraph,
  options: {
    visibleCommits: readonly VisibleGraphCommit[];
    rowCount: number;
    loadedBySha?: ReadonlyMap<string, VisibleGraphCommit>;
    hiddenShas?: ReadonlySet<string>;
  },
): GitLogGraphLayout {
  const { visibleCommits, rowCount, hiddenShas } = options;
  const loadedBySha = options.loadedBySha ?? new Map(
    visibleCommits.map((commit) => [commit.sha, commit]),
  );
  const laneBySha = new Map<string, number>();
  const colorLaneBySha = new Map<string, number>();
  const rowBySha = new Map<string, number>();
  const transitionIndexBySha = new Map<string, number>();
  const transitions: GitLogGraphTransition[] = [];
  const visibleRows: number[] = [];
  const headStarts = importantHeadStarts(graph);
  let maxLane = 0;

  for (const commit of visibleCommits) {
    const nodeIndex = graph.indexBySha.get(commit.sha) ?? -1;
    const layoutIndex =
      nodeIndex < 0 ? 1 : graph.layoutIndex[nodeIndex] ?? 1;
    const lane = displayLane(layoutIndex);
    const colorLane = colorLaneForLayoutIndex(headStarts, layoutIndex);
    const row = transitions.length;
    laneBySha.set(commit.sha, lane);
    colorLaneBySha.set(commit.sha, colorLane);
    rowBySha.set(commit.sha, commit.row);
    transitionIndexBySha.set(commit.sha, row);
    maxLane = Math.max(maxLane, lane);
    visibleRows.push(commit.row);
    transitions.push({
      row,
      sha: commit.sha,
      lane,
      layoutIndex,
      nodeIndex,
      colorLane,
      parents: [],
      parentLanes: [],
    });
  }

  const edges: GitLogGraphEdge[] = [];
  const edgesByChildRow = new Map<number, GitLogGraphEdge[]>();
  const edgesByDownRow = new Map<number, GitLogGraphEdge[]>();
  let nextEdgeId = 0;

  const register = (edge: GitLogGraphEdge) => {
    edges.push(edge);
    const byChild = edgesByChildRow.get(edge.childRow);
    if (byChild) {
      byChild.push(edge);
    } else {
      edgesByChildRow.set(edge.childRow, [edge]);
    }
    if (edge.downRow === undefined) {
      return;
    }
    const byDown = edgesByDownRow.get(edge.downRow);
    if (byDown) {
      byDown.push(edge);
    } else {
      edgesByDownRow.set(edge.downRow, [edge]);
    }
  };

  for (const commit of visibleCommits) {
    const childRow = transitionIndexBySha.get(commit.sha);
    if (childRow === undefined) {
      continue;
    }
    const loaded = loadedBySha.get(commit.sha) ?? commit;
    const parentShas = loaded.parentShas ?? [];
    const present = loaded.parentPresent;
    const childLane = transitions[childRow]!.lane;
    const keptParents: string[] = [];
    const keptLanes: number[] = [];
    const seenParents = new Set<string>();
    for (let index = 0; index < parentShas.length; index += 1) {
      const declared = parentShas[index]!;
      if (present?.[index] === false || seenParents.has(declared)) {
        continue;
      }
      seenParents.add(declared);
      const targetSha = followHiddenParent(declared, hiddenShas, loadedBySha);
      if (hiddenShas?.has(targetSha)) {
        continue;
      }
      const parentNode = graph.indexBySha.get(targetSha) ?? -1;
      const parentLayout =
        parentNode < 0 ? 1 : graph.layoutIndex[parentNode] ?? 1;
      const parentLane = Math.max(childLane, displayLane(parentLayout));
      maxLane = Math.max(maxLane, parentLane);
      const downRow = transitionIndexBySha.get(targetSha);
      const childTransition = transitions[childRow]!;
      const edge: GitLogGraphEdge = {
        id: nextEdgeId,
        childRow,
        childSha: commit.sha,
        parentSha: targetSha,
        parentLane,
        upIndex: childTransition.nodeIndex,
        downIndex: parentNode,
        upLayoutIndex: childTransition.layoutIndex,
        downLayoutIndex: parentLayout,
      };
      nextEdgeId += 1;
      if (downRow !== undefined && downRow > childRow) {
        edge.downRow = downRow;
      }
      register(edge);
      keptParents.push(targetSha);
      keptLanes.push(parentLane);
    }
    transitions[childRow] = {
      ...transitions[childRow]!,
      parents: keptParents,
      parentLanes: keptLanes,
    };
  }

  return {
    laneBySha,
    colorLaneBySha,
    rowBySha,
    width: gitLogGraphWidth(maxLane),
    height: rowCount * GIT_LOG_GRAPH_ROW_HEIGHT,
    maxLane,
    transitions,
    visibleRows,
    edges,
    edgesByChildRow,
    edgesByDownRow,
  };
}

export function loadedCommitsFromLog(
  commits: readonly LogCommitEntry[],
): Map<string, VisibleGraphCommit> {
  const loaded = new Map<string, VisibleGraphCommit>();
  for (const commit of commits) {
    loaded.set(commit.sha, {
      sha: commit.sha,
      row: -1,
      parentShas: commit.parentShas,
      parentPresent: commit.parentPresent,
    });
  }
  return loaded;
}
