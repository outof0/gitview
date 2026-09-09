import type { LogCommitEntry } from "@gitview/shared/types/log";

export const GIT_LOG_GRAPH_ROW_HEIGHT = 24;
const GIT_LOG_GRAPH_LANE_WIDTH = 14;
const GIT_LOG_GRAPH_LANE_PAD = 10;
export const GIT_LOG_GRAPH_DOT_RADIUS = 4.5;

const GIT_LOG_LANE_COLORS = [
  "var(--gitview-graph-purple)",
  "var(--gitview-graph-green)",
  "var(--gitview-graph-pink)",
  "var(--gitview-graph-blue)",
  "var(--gitview-graph-cyan)",
  "var(--gitview-graph-orange)",
  "var(--gitview-graph-yellow)",
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
  const rowBySha = new Map(commits.map((commit, row) => [commit.sha, row]));
  /** active[i] = SHA we next expect on this lane (or null if free). */
  const active: Array<string | null> = [];

  const trimTrailingEmptyLanes = () => {
    while (active.at(-1) === null) {
      active.pop();
    }
  };

  const reserveParent = (lane: number, parentSha: string) => {
    const existingLane = active.findIndex((sha) => sha === parentSha);
    if (existingLane >= 0) {
      return;
    }
    active[lane] = parentSha;
  };

  /**
   * Merge lanes are opened immediately to the right of the merge lane. A
   * generic "first free lane" choice lets an active branch on the left steal
   * the slot, which makes later edges cross and differs from git/JB graph
   * layout. Reuse an empty slot directly to the right when possible; insert
   * only when another active lane already occupies that position.
   */
  const reserveMergeParent = (lane: number, parentSha: string) => {
    if (active.includes(parentSha)) {
      return;
    }
    const targetLane = lane + 1;
    if (targetLane >= active.length) {
      active.push(parentSha);
      return;
    }
    if (active[targetLane] === null) {
      active[targetLane] = parentSha;
      return;
    }
    active.splice(targetLane, 0, parentSha);
  };

  for (let row = 0; row < commits.length; row += 1) {
    const commit = commits[row]!;
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

    const parents = (commit.parentShas ?? []).filter((parentSha) => {
      const parentRow = rowBySha.get(parentSha);
      return parentRow !== undefined && parentRow > row;
    });
    if (parents.length === 0) {
      active[lane] = null;
      trimTrailingEmptyLanes();
      continue;
    }

    // First parent continues on the same lane (git / JB convention).
    reserveParent(lane, parents[0]!);

    // Additional parents (merge sides) open or reuse lanes immediately to the
    // right of the merge lane, preserving the visual order of active branches.
    for (let i = 1; i < parents.length; i += 1) {
      reserveMergeParent(lane, parents[i]!);
    }
    trimTrailingEmptyLanes();
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

export type GitLogGraphLayoutOptions = {
  /** Visible list row for each commit. Collapsed placeholders occupy rows too. */
  rowBySha?: ReadonlyMap<string, number>;
  /** Total visible rows, including collapsed placeholders. */
  rowCount?: number;
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
  rowBySha: ReadonlyMap<string, number> = new Map(
    commits.map((commit, row) => [commit.sha, row]),
  ),
): GitLogGraphEdge[] {
  const edges: GitLogGraphEdge[] = [];

  for (let row = 0; row < commits.length; row += 1) {
    const commit = commits[row]!;
    const childLane = laneBySha.get(commit.sha);
    if (childLane === undefined) {
      continue;
    }

    const xChild = laneCenterX(childLane);
    const childRow = rowBySha.get(commit.sha);
    if (childRow === undefined) {
      continue;
    }
    const yChild =
      childRow * GIT_LOG_GRAPH_ROW_HEIGHT + GIT_LOG_GRAPH_ROW_HEIGHT / 2;

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

export function gitLogGraphWidth(
  laneBySha: ReadonlyMap<string, number>,
): number {
  let maxLane = 0;
  for (const lane of laneBySha.values()) {
    maxLane = Math.max(maxLane, lane);
  }
  return GIT_LOG_GRAPH_LANE_PAD * 2 + (maxLane + 1) * GIT_LOG_GRAPH_LANE_WIDTH;
}

export function buildGitLogGraphLayout(
  commits: readonly LogCommitEntry[],
  options: GitLogGraphLayoutOptions = {},
) {
  const laneBySha = assignCommitLanes(commits);
  const rowBySha =
    options.rowBySha ?? new Map(commits.map((commit, row) => [commit.sha, row]));
  const rowCount = options.rowCount ?? commits.length;
  return {
    laneBySha,
    width: gitLogGraphWidth(laneBySha),
    height: rowCount * GIT_LOG_GRAPH_ROW_HEIGHT,
    rowBySha,
    edges: buildGitLogGraphEdges(commits, laneBySha, rowBySha),
  };
}

export type GitLogGraphLayout = ReturnType<typeof buildGitLogGraphLayout>;
