export type BlameLine = {
  lineNumber: number;
  sha: string;
  shortSha: string;
  author: string;
  authorEmail: string;
  authorTime: number;
  summary: string;
  /** Source line content from git blame --line-porcelain. */
  text?: string;
};

export const GIT_CHANGED_FILE_STATUSES = ["A", "M", "D", "R", "C", "U"] as const;

export type GitChangedFileStatus = (typeof GIT_CHANGED_FILE_STATUSES)[number];

const gitChangedFileStatusSet = new Set<string>(GIT_CHANGED_FILE_STATUSES);

export function isGitChangedFileStatus(
  value: string,
): value is GitChangedFileStatus {
  return gitChangedFileStatusSet.has(value);
}

export type GitChangedFile = {
  path: string;
  status: GitChangedFileStatus;
};

export type GitCommitEntry = {
  sha: string;
  shortSha: string;
  author: string;
  authorEmail: string;
  authorTime: number;
  subject: string;
  body?: string;
  parentShas?: string[];
  isMerge?: boolean;
  /** Decoration from `git log --decorate` / %D (branch & tag tips). */
  refs?: string[];
  changedFiles: GitChangedFile[];
};

export const BLAME_ERROR_CODES = [
  "FILE_NOT_AT_REF",
  "BINARY_FILE",
  "REF_NOT_FOUND",
  "INVALID_PATH",
  "GIT_ERROR",
] as const;

export type BlameErrorCode = (typeof BLAME_ERROR_CODES)[number];

const blameErrorCodeSet = new Set<string>(BLAME_ERROR_CODES);

export function isBlameErrorCode(value: string): value is BlameErrorCode {
  return blameErrorCodeSet.has(value);
}

export const LOG_ERROR_CODES = [
  "PATH_NOT_FOUND",
  "INVALID_PATH",
  "GIT_ERROR",
  "NO_REPO",
  "NO_WORKSPACE",
  "HOST_ERROR",
] as const;

export type LogErrorCode = (typeof LOG_ERROR_CODES)[number];

const logErrorCodeSet = new Set<string>(LOG_ERROR_CODES);

export function isLogErrorCode(value: string): value is LogErrorCode {
  return logErrorCodeSet.has(value);
}

export type BlameResult =
  | { ok: true; lines: BlameLine[]; truncated?: boolean }
  | { ok: false; code: BlameErrorCode; message: string };

export type LogResult =
  | { ok: true; commits: GitCommitEntry[] }
  | { ok: false; code: LogErrorCode; message: string };

export type CommitDetailResult =
  | { ok: true; commit: GitCommitEntry }
  | { ok: false; code: string; message: string };

export type BlameSide = "ours" | "theirs";

export function isBlameSide(value: unknown): value is BlameSide {
  return value === "ours" || value === "theirs";
}

export type LogOptions = {
  limit?: number;
  /** History tab branch filter — limit log to this branch ref. */
  branch?: string;
};

export type FilePatchResult =
  | { ok: true; patch: string }
  | { ok: false; code: string; message: string };

/** History tab — single panel (added/deleted) or split (modified). */
export type FileDiffPanel = {
  label: string;
  text: string;
};

export type FileDiffView = {
  layout: "single" | "split";
  status: GitChangedFileStatus;
  left: FileDiffPanel | null;
  right: FileDiffPanel | null;
  binary?: boolean;
};

export type FileDiffAtCommitResult =
  | { ok: true; diff: FileDiffView }
  | { ok: false; code: string; message: string };

export const CHANGES_FROM_SIDE_ERROR_CODES = [
  "NOT_IN_MERGE",
  "REF_NOT_FOUND",
  "INVALID_PATH",
  "GIT_ERROR",
  "NO_REPO",
  "NO_WORKSPACE",
  "HOST_ERROR",
] as const;

export type ChangesFromSideErrorCode =
  (typeof CHANGES_FROM_SIDE_ERROR_CODES)[number];

const changesFromSideErrorCodeSet = new Set<string>(
  CHANGES_FROM_SIDE_ERROR_CODES,
);

export function isChangesFromSideErrorCode(
  value: string,
): value is ChangesFromSideErrorCode {
  return changesFromSideErrorCodeSet.has(value);
}

/** "Show Details" / Changes from branch — commits since merge-base on one side. */
export type ChangesFromSideResult =
  | {
      ok: true;
      side: BlameSide;
      mergeBase: string;
      revisionRange: string;
      branchRef: string;
      commits: GitCommitEntry[];
      /** All paths touched by any commit in the range (for the file tree). */
      allChangedPaths: string[];
    }
  | { ok: false; code: ChangesFromSideErrorCode; message: string };

export type ChangesFromSideOptions = {
  /** When set, only commits touching this path (Filter by conflicted file). */
  filterPath?: string;
  limit?: number;
};
