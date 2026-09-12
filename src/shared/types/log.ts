export type LogChangedFile = {
  path: string;
  status: "A" | "M" | "D" | "R" | "C" | "U";
};

export type LogCommitEntry = {
  sha: string;
  shortSha: string;
  author: string;
  authorEmail: string;
  authorTime: number;
  subject: string;
  body?: string;
  parentShas?: string[];
  /**
   * Whether each entry in `parentShas` survives the active log filter. The
   * permanent DAG still contains every parent; this only hides a print edge.
   * `undefined` means every parent is part of the filtered history.
   */
  parentPresent?: boolean[];
  isMerge?: boolean;
  /** Branch/tag decorations for Log chips (JB git_log_view). */
  refs?: string[];
  changedFiles: LogChangedFile[];
};

export type LogQueryRange = "all" | "incoming" | "outgoing";

export type ResetMode = "soft" | "mixed" | "hard" | "keep";

export type LogGraphSort = "date" | "topological";

export type LogQueryFilters = {
  branch?: string;
  limit?: number;
  /** Number of newest matching commits already loaded by the caller. */
  skip?: number;
  author?: string;
  since?: string;
  until?: string;
  path?: string;
  /** File history uses --follow; folder history scopes to directory. */
  isFolder?: boolean;
  /** Explicit full-repository log — ignores path scoping. */
  scope?: "repo";
  grep?: string;
  range?: LogQueryRange;
  noMerges?: boolean;
  firstParent?: boolean;
  collapseLinear?: boolean;
  graphSort?: LogGraphSort;
  highlightCurrentBranch?: boolean;
  compactRows?: boolean;
};

/** Compare log queries while treating pagination as transport state. */
export function logQueryFiltersEqual(
  a?: LogQueryFilters,
  b?: LogQueryFilters,
): boolean {
  const left: Record<string, unknown> = { ...a };
  const right: Record<string, unknown> = { ...b };
  delete left.skip;
  delete right.skip;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (left[key] !== right[key] && !(left[key] == null && right[key] == null)) {
      return false;
    }
  }
  return true;
}

export type LogSnapshot = {
  repoId: string;
  branch: string | null;
  commits: LogCommitEntry[];
  refreshedAt: number;
  filters?: LogQueryFilters;
  /** Whether another page of matching commits is available. */
  hasMore?: boolean;
};

export type LogDagNode = {
  sha: string;
  parentShas: string[];
  timestamp: number;
};

/**
 * Lightweight whole-repo commit DAG. Layout is computed from this snapshot
 * alone; paged log rows only choose which nodes are painted.
 */
export type LogDagSnapshot = {
  repoId: string;
  headSha: string | null;
  /** Ref tips in importance order: HEAD, then remaining unique tips. */
  refTips: string[];
  /** Newest-first reachable commits. */
  nodes: LogDagNode[];
  generatedAt: number;
};
