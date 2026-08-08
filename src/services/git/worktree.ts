import * as path from "node:path";
import type { WorktreeEntry } from "../../shared/types/worktree";
import type { GitExecFn } from "./types";

export function createWorktreeApi(execGit: GitExecFn) {
  async function listWorktrees(
    repoRoot: string,
    mainRoot = repoRoot,
  ): Promise<WorktreeEntry[]> {
    const { stdout } = await execGit(repoRoot, [
      "worktree",
      "list",
      "--porcelain",
    ]);

    const entries: WorktreeEntry[] = [];
    let current: Partial<WorktreeEntry> | null = null;

    function flush() {
      if (!current?.path) {
        return;
      }
      entries.push({
        path: current.path,
        headSha: current.headSha ?? null,
        branch: current.branch ?? null,
        detached: Boolean(current.detached),
        bare: Boolean(current.bare),
        locked: Boolean(current.locked),
        prunable: Boolean(current.prunable),
        isMain: path.normalize(current.path) === path.normalize(mainRoot),
      });
    }

    for (const line of stdout.split("\n")) {
      if (!line.trim()) {
        flush();
        current = null;
        continue;
      }
      if (line.startsWith("worktree ")) {
        flush();
        current = { path: line.slice("worktree ".length).trim() };
        continue;
      }
      if (!current) {
        continue;
      }
      if (line.startsWith("HEAD ")) {
        current.headSha = line.slice("HEAD ".length).trim();
      } else if (line.startsWith("branch ")) {
        const ref = line.slice("branch ".length).trim();
        current.branch = ref.replace(/^refs\/heads\//, "");
        current.detached = false;
      } else if (line === "detached") {
        current.detached = true;
      } else if (line === "bare") {
        current.bare = true;
      } else if (line.startsWith("locked")) {
        current.locked = true;
      } else if (line === "prunable") {
        current.prunable = true;
      }
    }
    flush();
    return entries;
  }

  async function addWorktree(
    repoRoot: string,
    worktreePath: string,
    opts?: { branch?: string; newBranch?: string },
  ): Promise<void> {
    const args = ["worktree", "add"];
    if (opts?.newBranch) {
      args.push("-b", opts.newBranch);
    }
    args.push(worktreePath);
    if (opts?.branch && !opts.newBranch) {
      args.push(opts.branch);
    }
    await execGit(repoRoot, args);
  }

  async function removeWorktree(
    repoRoot: string,
    worktreePath: string,
    force = false,
  ): Promise<void> {
    const args = ["worktree", "remove"];
    if (force) {
      args.push("--force");
    }
    args.push(worktreePath);
    await execGit(repoRoot, args);
  }

  return { listWorktrees, addWorktree, removeWorktree };
}