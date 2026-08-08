export type StashEntry = {
  index: number;
  ref: string;
  branch: string | null;
  message: string;
  sha: string | null;
  /** ISO 8601 commit date. */
  authoredAt?: string | null;
  /** Human-readable age, e.g. "2 hours ago". */
  relativeDate?: string | null;
  /** Populated lazily when a stash is selected, not during list refresh. */
  fileCount?: number | null;
  hasUntracked?: boolean;
};

export type StashListSnapshot = {
  repoId: string;
  stashes: StashEntry[];
  refreshedAt: number;
};

/**
 * Which of a stash commit's parents a file came from. A stash is a merge
 * commit: `^1` is the base, `^2` the index state, and `^3` the untracked files
 * (present only when stashed with `--include-untracked`).
 */
export type StashFileOrigin = "tracked" | "untracked" | "index";

export type StashFileStatus = "A" | "M" | "D" | "R" | "C" | "T" | "U";

export type StashFileEntry = {
  path: string;
  /** Rename/copy source, otherwise null. */
  oldPath: string | null;
  status: StashFileStatus;
  origin: StashFileOrigin;
};

export type StashDetail = {
  repoId: string;
  index: number;
  ref: string;
  sha: string | null;
  branch: string | null;
  message: string;
  authoredAt: string | null;
  hasUntracked: boolean;
  /** Tracked changes plus untracked additions. */
  files: StashFileEntry[];
  /** Files that were staged when the stash was created. */
  indexFiles: StashFileEntry[];
  refreshedAt: number;
};
