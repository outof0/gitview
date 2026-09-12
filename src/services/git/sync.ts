import type { GitExecFn, GitExecOptions } from "./types";
import { NETWORK_GIT_TIMEOUT_MS } from "./exec";
import { isGitErrorCode } from "../../shared/errors/classifyGitError";
import { assertSafeGitOperand } from "../../shared/lib/gitOperand";

const networkExecOptions: GitExecOptions = {
  maxBuffer: 50 * 1024 * 1024,
  timeoutMs: NETWORK_GIT_TIMEOUT_MS,
};

export type PullStrategy = "merge" | "rebase" | "ff_only";

export type PushResult = {
  rejected: boolean;
  stderr: string;
};

export type RootUpdateResult = {
  repoId: string;
  name: string;
  ok: boolean;
  error?: string;
};

export type SyncExecutionOptions = {
  signal?: AbortSignal;
};

function networkOptions(options?: SyncExecutionOptions): GitExecOptions {
  return options?.signal
    ? { ...networkExecOptions, signal: options.signal }
    : networkExecOptions;
}

export function createSyncApi(execGit: GitExecFn) {
  async function fetch(
    repoRoot: string,
    remote = "origin",
    options?: SyncExecutionOptions,
  ): Promise<void> {
    assertSafeGitOperand(remote, "remote");
    await execGit(repoRoot, ["fetch", remote], networkOptions(options));
  }

  async function pull(
    repoRoot: string,
    strategy: PullStrategy = "merge",
    remote = "origin",
    options?: SyncExecutionOptions,
  ): Promise<void> {
    assertSafeGitOperand(remote, "remote");
    const args = ["pull", remote];
    if (strategy === "rebase") {
      args.push("--rebase");
    } else if (strategy === "ff_only") {
      args.push("--ff-only");
    } else {
      args.push("--no-rebase");
    }
    await execGit(repoRoot, args, networkOptions(options));
  }

  async function push(
    repoRoot: string,
    opts?: { setUpstream?: boolean; remote?: string; branch?: string },
    options?: SyncExecutionOptions,
  ): Promise<PushResult> {
    if (opts?.remote) {
      assertSafeGitOperand(opts.remote, "remote");
    }
    if (opts?.branch) {
      assertSafeGitOperand(opts.branch, "branch");
    }
    const args = ["push"];
    if (opts?.setUpstream) {
      args.push("-u");
    }
    if (opts?.remote) {
      args.push(opts.remote);
    }
    if (opts?.branch) {
      args.push(opts.branch);
    }
    try {
      await execGit(repoRoot, args, networkOptions(options));
      return { rejected: false, stderr: "" };
    } catch (err) {
      if (!isGitErrorCode(err, "PUSH_REJECTED")) {
        throw err;
      }
      return {
        rejected: true,
        stderr: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async function updateAllRoots(
    repos: Array<{ id: string; name: string; rootPath: string }>,
    strategy: PullStrategy = "merge",
    remote = "origin",
    options?: SyncExecutionOptions,
  ): Promise<RootUpdateResult[]> {
    const results: RootUpdateResult[] = [];
    for (const repo of repos) {
      try {
        await fetch(repo.rootPath, remote, options);
        await pull(repo.rootPath, strategy, remote, options);
        results.push({ repoId: repo.id, name: repo.name, ok: true });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({
          repoId: repo.id,
          name: repo.name,
          ok: false,
          error:
            msg.replace(/.*Command failed: git[^\n]*\n?/i, "").trim() || msg,
        });
      }
    }
    return results;
  }

  return { fetch, pull, push, updateAllRoots };
}
