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
  author?: string;
  since?: string;
  until?: string;
  path?: string;
  /** File history uses --follow; folder history scopes to directory. */
  isFolder?: boolean;
  /** Full-repo log (annotate mode) — ignores path scoping. */
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

export type LogSnapshot = {
  repoId: string;
  branch: string | null;
  commits: LogCommitEntry[];
  refreshedAt: number;
  filters?: LogQueryFilters;
};