import type { BlameLine } from "../../types/blame";

export type ExecResult = {
  stdout: string;
  stderr: string;
};

export type GitExecOptions = {
  maxBuffer?: number;
  env?: NodeJS.ProcessEnv;
  /** Overrides DEFAULT_GIT_TIMEOUT_MS; large repos need longer for log/blame/fetch. */
  timeoutMs?: number;
  /** Kills the child process when the caller aborts (editor closed, user cancelled). */
  signal?: AbortSignal;
};

export type GitExecFn = (
  repoRoot: string,
  args: string[],
  opts?: GitExecOptions,
) => Promise<ExecResult>;

export type BlameCacheEntry = {
  ref: string;
  lines: BlameLine[];
  truncated: boolean;
  fetchedAt: number;
};

export const BLAME_CACHE_TTL_MS = 60_000;
/** Each entry holds up to MAX_BLAME_LINES rows, so the cache must stay bounded. */
export const BLAME_CACHE_MAX_ENTRIES = 64;
export const DEFAULT_LOG_LIMIT = 100;