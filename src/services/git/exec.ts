import { execFile } from "child_process";
import { promisify } from "util";
import type { GitExecFn } from "./types";
import type { Logger } from "../../observability/logger";
import { NOOP_LOGGER, errorLogFields } from "../../observability/logger";
import { isGitErrorCode } from "../../shared/errors/classifyGitError";

const execFileAsync = promisify(execFile);

/** Env overrides so git merge/rebase/cherry-pick --continue never opens an editor. */
export const nonInteractiveContinueEnv: NodeJS.ProcessEnv = {
  GIT_EDITOR: "true",
  GIT_MERGE_AUTOEDIT: "no",
};

/**
 * Git translates its diagnostics under a localized locale, which would silently
 * break `classifyGitError`. Pinning the child process to the C locale keeps
 * stderr identical for every user regardless of their shell environment.
 */
const stableLocaleEnv: NodeJS.ProcessEnv = {
  LC_ALL: "C",
  LANG: "C",
  LANGUAGE: "C",
  // Without this a credential prompt on an HTTPS remote blocks the child until
  // the timeout kills it, which surfaces as an unexplained "timed out" error.
  GIT_TERMINAL_PROMPT: "0",
};

export const DEFAULT_GIT_TIMEOUT_MS = 30_000;
/** Network operations depend on remote and link speed, not repository size. */
export const NETWORK_GIT_TIMEOUT_MS = 300_000;

function normalizeGitExecutable(path: string | null | undefined): string {
  const trimmed = typeof path === "string" ? path.trim() : "";
  return trimmed.length > 0 ? trimmed : "git";
}

function createExec(executable: () => string, logger: Logger): GitExecFn {
  return async (repoRoot, args, opts) => {
    const startedAt = Date.now();
    const operation = args[0] ?? "unknown";
    try {
      const result = await execFileAsync(executable(), ["--no-pager", ...args], {
        cwd: repoRoot,
        maxBuffer: opts?.maxBuffer ?? 10 * 1024 * 1024,
        timeout: opts?.timeoutMs ?? DEFAULT_GIT_TIMEOUT_MS,
        signal: opts?.signal,
        env: { ...process.env, ...stableLocaleEnv, ...opts?.env },
      });
      logger.debug("git.command.completed", {
        operation,
        durationMs: Date.now() - startedAt,
      });
      return { stdout: result.stdout, stderr: result.stderr };
    } catch (error) {
      logger.warn("git.command.failed", {
        operation,
        durationMs: Date.now() - startedAt,
        ...errorLogFields(error),
      });
      throw error;
    }
  };
}

export type ConfigurableGitRunner = {
  execGit: GitExecFn;
  getExecutable: () => string;
  setExecutable: (path: string | null | undefined) => void;
};

/** A scoped runner; changing it never mutates another extension/test instance. */
export function createConfigurableGitRunner(
  initialExecutable?: string | null,
  logger: Logger = NOOP_LOGGER,
): ConfigurableGitRunner {
  let executable = normalizeGitExecutable(initialExecutable);
  return {
    execGit: createExec(() => executable, logger),
    getExecutable: () => executable,
    setExecutable: (next) => {
      executable = normalizeGitExecutable(next);
    },
  };
}

export function createDefaultExecGit(
  executable?: string | null,
  logger: Logger = NOOP_LOGGER,
): GitExecFn {
  const resolved = normalizeGitExecutable(executable);
  return createExec(() => resolved, logger);
}

export const defaultExecGit: GitExecFn = createDefaultExecGit();

export function isFileNotAtRefError(err: unknown): boolean {
  return isGitErrorCode(err, "PATH_NOT_AT_REF");
}

export function isBinaryBlameError(err: unknown): boolean {
  return isGitErrorCode(err, "BINARY_FILE");
}
