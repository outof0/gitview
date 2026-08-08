import type { GitExecFn } from "./types";

export function createRepoApi(execGit: GitExecFn) {
  async function findRepoRoot(startPath: string): Promise<string | null> {
    try {
      const { stdout } = await execGit(startPath, [
        "rev-parse",
        "--show-toplevel",
      ]);
      return stdout.trim() || null;
    } catch {
      return null;
    }
  }

  async function getBranchInfo(repoRoot: string): Promise<{
    currentBranch: string;
    mergeHead?: string;
    rebaseInProgress: boolean;
    mergeInProgress: boolean;
    operation: "merge" | "rebase" | "cherry-pick" | "revert" | "none";
  }> {
    let currentBranch = "HEAD";
    try {
      const { stdout } = await execGit(repoRoot, [
        "symbolic-ref",
        "--short",
        "HEAD",
      ]);
      currentBranch = stdout.trim();
    } catch {
      try {
        const { stdout } = await execGit(repoRoot, [
          "rev-parse",
          "--short",
          "HEAD",
        ]);
        currentBranch = stdout.trim();
      } catch {
        // no commits
      }
    }

    let mergeHead: string | undefined;
    let mergeInProgress = false;
    try {
      const { stdout } = await execGit(repoRoot, [
        "rev-parse",
        "--verify",
        "MERGE_HEAD",
      ]);
      mergeHead = stdout.trim();
      mergeInProgress = true;
    } catch {
      // no merge in progress
    }

    let rebaseInProgress = false;
    try {
      await execGit(repoRoot, ["rev-parse", "--verify", "REBASE_HEAD"]);
      rebaseInProgress = true;
    } catch {
      // not in rebase
    }

    let operation: "merge" | "rebase" | "cherry-pick" | "revert" | "none" =
      "none";
    if (mergeInProgress) {
      operation = "merge";
    } else if (rebaseInProgress) {
      operation = "rebase";
    }

    return {
      currentBranch,
      mergeHead,
      rebaseInProgress,
      mergeInProgress,
      operation,
    };
  }

  async function listBranches(repoRoot: string): Promise<string[]> {
    try {
      const { stdout } = await execGit(repoRoot, [
        "for-each-ref",
        "--format=%(refname:short)",
        "refs/heads/",
      ]);
      const local = stdout
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      return [...new Set(local)].sort();
    } catch {
      return [];
    }
  }

  return { findRepoRoot, getBranchInfo, listBranches };
}