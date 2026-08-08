import type { GitExecFn } from "./types";

export type MergeBranchOptions = {
  noFf?: boolean;
  squash?: boolean;
  message?: string;
  /** Stage the merge result but leave it uncommitted (--no-commit). */
  noCommit?: boolean;
  /** Append one-line descriptions of merged commits (--log). */
  log?: boolean;
};

export type RebaseOntoOptions = {
  interactive?: boolean;
  /** Branch to rebase; defaults to the current one. */
  from?: string;
  /** Keep merge commits instead of flattening them (--rebase-merges). */
  rebaseMerges?: boolean;
};

export function createIntegrationApi(execGit: GitExecFn) {
  async function mergeBranch(
    repoRoot: string,
    ref: string,
    opts?: MergeBranchOptions,
  ): Promise<void> {
    const args = ["merge"];
    if (opts?.noFf) {
      args.push("--no-ff");
    }
    if (opts?.squash) {
      args.push("--squash");
    }
    if (opts?.noCommit) {
      args.push("--no-commit");
    }
    if (opts?.log) {
      args.push("--log");
    }
    // --squash and --no-commit both leave the commit to the user, so -m would
    // be rejected by git.
    if (opts?.message?.trim() && !opts.squash && !opts.noCommit) {
      args.push("-m", opts.message.trim());
    }
    args.push(ref);
    await execGit(repoRoot, args);
  }

  async function rebaseOnto(
    repoRoot: string,
    onto: string,
    opts?: RebaseOntoOptions,
  ): Promise<void> {
    const args = ["rebase"];
    if (opts?.interactive) {
      args.push("-i");
    }
    if (opts?.rebaseMerges) {
      args.push("--rebase-merges");
    }
    args.push(onto);
    if (opts?.from?.trim()) {
      args.push(opts.from.trim());
    }
    await execGit(repoRoot, args);
  }

  return { mergeBranch, rebaseOnto };
}