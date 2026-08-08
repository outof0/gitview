import type { BlameLineEntry } from "./blame";

export type HistoryInitPayload = {
  path: string;
  isFolder: boolean;
  repoId: string;
  branches: string[];
  currentBranch: string;
};

export type BlamePreviewPayload = {
  relativePath: string;
  lines: BlameLineEntry[];
  headSha?: string | null;
  loading?: boolean;
  truncated?: boolean;
  /** 1-based line from the editor cursor when Annotate was invoked. */
  focusLine?: number;
};

export type FileAtRevisionResult = {
  sha: string;
  path: string;
  text?: string;
  binary?: boolean;
  deleted?: boolean;
  error?: { code: string; message: string };
};

export type CommitDetailResult = {
  commit?: import("./log").LogCommitEntry;
  error?: { code: string; message: string };
};