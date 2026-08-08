import type { GitExecFn, GitExecOptions } from "./types";
import { NETWORK_GIT_TIMEOUT_MS } from "./exec";
import { isGitErrorCode } from "../../shared/errors/classifyGitError";

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

export function createSyncApi(execGit: GitExecFn) {
  async function fetch(repoRoot: string, remote = "origin"): Promise<void> {
    await execGit(repoRoot, ["fetch", remote], networkExecOptions);
  }

  async function pull(
    repoRoot: string,
    strategy: PullStrategy = "merge",
    remote = "origin",
  ): Promise<void> {
    const args = ["pull", remote];
    if (strategy === "rebase") {
      args.push("--rebase");
    } else if (strategy === "ff_only") {
      args.push("--ff-only");
    } else {
      args.push("--no-rebase");
    }
    await execGit(repoRoot, args, networkExecOptions);
  }

  async function push(
    repoRoot: string,
    opts?: { setUpstream?: boolean; remote?: string; branch?: string },
  ): Promise<PushResult> {
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
      await execGit(repoRoot, args, networkExecOptions);
      return { rejected: false, stderr: "" };
    } catch (err) {
      return {
        rejected: isGitErrorCode(err, "PUSH_REJECTED"),
        stderr: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async function updateAllRoots(
    repos: Array<{ id: string; name: string; rootPath: string }>,
    strategy: PullStrategy = "merge",
    remote = "origin",
  ): Promise<RootUpdateResult[]> {
    const results: RootUpdateResult[] = [];
    for (const repo of repos) {
      try {
        await fetch(repo.rootPath, remote);
        await pull(repo.rootPath, strategy, remote);
        results.push({ repoId: repo.id, name: repo.name, ok: true });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({
          repoId: repo.id,
          name: repo.name,
          ok: false,
          error: msg.replace(/.*Command failed: git[^\n]*\n?/i, "").trim() || msg,
        });
      }
    }
    return results;
  }

  return { fetch, pull, push, updateAllRoots };
}