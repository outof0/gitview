export {
  GIT_LOG_GRAPH_DOT_RADIUS,
  GIT_LOG_GRAPH_LONG_EDGE_ROWS,
  GIT_LOG_GRAPH_ROW_HEIGHT,
  buildGraphCanvasPrimitives,
  hitTestGraphPrimitives,
  buildPermanentGraph,
  buildVisibleGraphLayout,
  dagSnapshotFromCommits,
  gitLogGraphWidth,
  gitLogLaneColor,
  laneCenterX,
  loadedCommitsFromLog,
  measureGraphLayout,
  printEdgesMatchDag,
} from "@gitview/shared/lib/gitLogGraph";
export type {
  GitLogGraphArrow,
  GraphHit,
  GitLogGraphDot,
  GitLogGraphEdge,
  GitLogGraphLayout,
  GitLogGraphLine,
  GitLogGraphTransition,
  PermanentGraph,
} from "@gitview/shared/lib/gitLogGraph";

import type { LogCommitEntry } from "@gitview/shared/types/log";
import {
  buildPermanentGraph,
  buildVisibleGraphLayout,
  dagSnapshotFromCommits,
  loadedCommitsFromLog,
} from "@gitview/shared/lib/gitLogGraph";
import type { GitLogGraphLayout } from "@gitview/shared/lib/gitLogGraph";

export type GitLogGraphLayoutOptions = {
  rowBySha?: ReadonlyMap<string, number>;
  rowCount?: number;
  hiddenShas?: ReadonlySet<string>;
  loadedBySha?: ReadonlyMap<
    string,
    { sha: string; row: number; parentShas?: string[]; parentPresent?: boolean[] }
  >;
  permanentGraph?: ReturnType<typeof buildPermanentGraph>;
};

/**
 * Visible-graph print of `commits` using a permanent DAG. When the caller
 * omits `permanentGraph`, the loaded commits are treated as the snapshot —
 * tests and playground only. Production always passes the repo DAG.
 */
export function buildGitLogGraphLayout(
  commits: readonly LogCommitEntry[],
  options: GitLogGraphLayoutOptions = {},
): GitLogGraphLayout {
  const graph =
    options.permanentGraph ??
    buildPermanentGraph(dagSnapshotFromCommits(commits));
  const rowBySha =
    options.rowBySha ??
    new Map(commits.map((commit, row) => [commit.sha, row]));
  const visibleCommits = commits.map((commit) => ({
    sha: commit.sha,
    row: rowBySha.get(commit.sha) ?? 0,
    parentShas: commit.parentShas,
    parentPresent: commit.parentPresent,
  }));
  return buildVisibleGraphLayout(graph, {
    visibleCommits,
    rowCount: options.rowCount ?? commits.length,
    hiddenShas: options.hiddenShas,
    loadedBySha: options.loadedBySha ?? loadedCommitsFromLog(commits),
  });
}
