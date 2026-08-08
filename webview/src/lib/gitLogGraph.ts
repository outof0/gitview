import type { LogCommitEntry } from "@gitview/shared/types/log";

export const GIT_LOG_GRAPH_ROW_HEIGHT = 24;
export const GIT_LOG_GRAPH_LANE_WIDTH = 14;
export const GIT_LOG_GRAPH_LANE_PAD = 10;
export const GIT_LOG_GRAPH_DOT_RADIUS = 4.5;

export const GIT_LOG_LANE_COLORS = [
  "#6b4fd8",
  "#2aa198",
  "#d14b72",
  "#5b6bdc",
  "#b446a4",
  "#e67e22",
  "#1abc9c",
] as const;

export function gitLogLaneColor(lane: number): string {
  return (
    GIT_LOG_LANE_COLORS[lane % GIT_LOG_LANE_COLORS.length] ??
    GIT_LOG_LANE_COLORS[0]
  );
}

export function laneCenterX(lane: number): number {
  return (
    GIT_LOG_GRAPH_LANE_PAD +
    lane * GIT_LOG_GRAPH_LANE_WIDTH +
    GIT_LOG_GRAPH_LANE_WIDTH / 2
  );
}

/**
 * Assign a stable lane index per commit (newest-first log order).
 *
 * Topology input is real git parent SHAs (`commit.parentShas` from `%P`).
 * Lane indices are a packing heuristic (same class as git log --graph / JB Log):
 * they only choose *where* to draw, not *which* commits link together.
 */
export function assignCommitLanes(
  commits: readonly LogCommitEntry[],
): Map<string, number> {
  const laneBySha = new Map<string, number>();
  /** active[i] = SHA we next expect on this lane (or null if free). */
  const active: Array<string | null> = [];

  for (const commit of commits) {
    let lane = active.findIndex((sha) => sha === commit.sha);
    if (lane < 0) {
      lane = active.findIndex((sha) => sha === null);
      if (lane < 0) {
        lane = active.length;
        active.push(null);
      }
    }

    // Clear *every* lane waiting for this commit (a SHA may be reserved
    // on multiple lanes after merges); otherwise stale waiters produce
    // phantom parallel rails.
    for (let i = 0; i < active.length; i += 1) {
      if (active[i] === commit.sha) {
        active[i] = null;
      }
    }

    while (active.length <= lane) {
      active.push(null);
    }
    laneBySha.set(commit.sha, lane);

    const parents = commit.parentShas ?? [];
    if (parents.length === 0) {
      active[lane] = null;
      continue;
    }

    // First parent continues on the same lane (git / JB convention).
    active[lane] = parents[0]!;

    // Additional parents (merge sides) open or reuse lanes.
    for (let i = 1; i < parents.length; i += 1) {
      const parentSha = parents[i]!;
      const already = active.findIndex((sha) => sha === parentSha);
      if (already >= 0) {
        continue;
      }
      let mergeLane = active.findIndex((sha) => sha === null);
      if (mergeLane < 0) {
        mergeLane = active.length;
        active.push(parentSha);
      } else {
        active[mergeLane] = parentSha;
      }
    }
  }

  return laneBySha;
}

export type GitLogGraphEdge = {
  d: string;
  color: string;
  /** Real child commit SHA (edge source). */
  childSha: string;
  /** Real parent commit SHA from git `%P` (edge target). */
  parentSha: string;
};

export type GitLogGraphPassThrough = {
  row: number;
  lane: number;
};

/**
 * Build SVG path for a parent link (geometry only).
 * Same lane → vertical. Different lane → diagonal zigzag (JB-like).
 */
export function buildParentEdgePath(
  xChild: number,
  yChild: number,
  xParent: number,
  yParent: number,
): string {
  const r = GIT_LOG_GRAPH_DOT_RADIUS;
  const yStart = yChild + r;
  const yEnd = yParent - r;

  if (Math.abs(xChild - xParent) < 0.5) {
    return `M ${xChild} ${yStart} L ${xParent} ${yEnd}`;
  }

  // Diagonal into the parent lane, then vertical if parent is further down.
  const yDiagEnd = Math.min(
    yStart + GIT_LOG_GRAPH_ROW_HEIGHT * 0.85,
    (yStart + yEnd) / 2 + GIT_LOG_GRAPH_ROW_HEIGHT * 0.15,
  );

  if (yEnd <= yDiagEnd + 1) {
    return `M ${xChild} ${yStart} L ${xParent} ${yEnd}`;
  }

  return [
    `M ${xChild} ${yStart}`,
    `L ${xParent} ${yDiagEnd}`,
    `L ${xParent} ${yEnd}`,
  ].join(" ");
}

/**
 * @deprecated Pass-through painting was removed (double-drew verticals).
 * Kept for API compatibility; always returns [].
 */
export function buildGitLogGraphPassThrough(
  _commits: readonly LogCommitEntry[],
): GitLogGraphPassThrough[] {
  return [];
}

/**
 * One SVG edge per real parent link where *both* endpoints are in `commits`.
 *
 * This is NOT “connect consecutive list rows”. An edge exists only when
 * `parentSha` appears in `commit.parentShas` (from git) and that parent is
 * also present in the loaded list (below the child in newest-first order).
 * Missing parents (filtered out of the list) produce no edge — honest gap,
 * not a fake link to the next row.
 */
export function buildGitLogGraphEdges(
  commits: readonly LogCommitEntry[],
  laneBySha: ReadonlyMap<string, number>,
): GitLogGraphEdge[] {
  const rowBySha = new Map(commits.map((commit, row) => [commit.sha, row]));
  const edges: GitLogGraphEdge[] = [];

  for (let row = 0; row < commits.length; row += 1) {
    const commit = commits[row]!;
    const childLane = laneBySha.get(commit.sha);
    if (childLane === undefined) {
      continue;
    }

    const xChild = laneCenterX(childLane);
    const yChild =
      row * GIT_LOG_GRAPH_ROW_HEIGHT + GIT_LOG_GRAPH_ROW_HEIGHT / 2;

    const parents = commit.parentShas ?? [];
    for (let i = 0; i < parents.length; i += 1) {
      const parentSha = parents[i]!;
      const parentRow = rowBySha.get(parentSha);
      const parentLane = laneBySha.get(parentSha);
      if (parentRow === undefined || parentLane === undefined) {
        // Parent not in this loaded list — do not invent a link.
        continue;
      }
      // Newest-first: parent must appear further down.
      if (parentRow <= row) {
        continue;
      }

      const xParent = laneCenterX(parentLane);
      const yParent =
        parentRow * GIT_LOG_GRAPH_ROW_HEIGHT + GIT_LOG_GRAPH_ROW_HEIGHT / 2;

      // First parent keeps the child-lane color; merge sides use parent lane.
      const color = gitLogLaneColor(i === 0 ? childLane : parentLane);

      edges.push({
        d: buildParentEdgePath(xChild, yChild, xParent, yParent),
        color,
        childSha: commit.sha,
        parentSha,
      });
    }
  }

  return edges;
}

export function gitLogGraphWidth(laneBySha: ReadonlyMap<string, number>): number {
  let maxLane = 0;
  for (const lane of laneBySha.values()) {
    maxLane = Math.max(maxLane, lane);
  }
  return GIT_LOG_GRAPH_LANE_PAD * 2 + (maxLane + 1) * GIT_LOG_GRAPH_LANE_WIDTH;
}

export function buildGitLogGraphLayout(commits: readonly LogCommitEntry[]) {
  const laneBySha = assignCommitLanes(commits);
  return {
    laneBySha,
    width: gitLogGraphWidth(laneBySha),
    height: commits.length * GIT_LOG_GRAPH_ROW_HEIGHT,
    edges: buildGitLogGraphEdges(commits, laneBySha),
    passThrough: buildGitLogGraphPassThrough(commits),
  };
}

export type GitLogGraphLayout = ReturnType<typeof buildGitLogGraphLayout>;
