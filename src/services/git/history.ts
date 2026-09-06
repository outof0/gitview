import { nonInteractiveContinueEnv } from "./exec";
import { assertSafeGitOperand } from "../../shared/lib/gitOperand";
import type { GitExecFn } from "./types";

export type ResetMode = "soft" | "mixed" | "hard" | "keep";

export function createHistoryApi(execGit: GitExecFn) {
  async function cherryPick(repoRoot: string, sha: string): Promise<void> {
    assertSafeGitOperand(sha, "commit");
    await execGit(repoRoot, ["cherry-pick", sha]);
  }

  async function revertCommit(repoRoot: string, sha: string): Promise<void> {
    assertSafeGitOperand(sha, "commit");
    await execGit(repoRoot, ["revert", "--no-edit", sha]);
  }

  async function resetTo(
    repoRoot: string,
    sha: string,
    mode: ResetMode,
  ): Promise<void> {
    // An option-shaped target turns `git reset --soft <sha>` into
    // `git reset --soft --hard`, which hard-resets and destroys uncommitted
    // work while the protocol only asked for a soft reset. The protocol
    // validator already rejects operands; assert again at the boundary.
    assertSafeGitOperand(sha, "commit");
    await execGit(repoRoot, ["reset", `--${mode}`, sha]);
  }

  async function undoLastCommit(repoRoot: string): Promise<void> {
    await execGit(repoRoot, ["reset", "--mixed", "HEAD~1"]);
  }

  async function cherryPickMultiple(
    repoRoot: string,
    shas: string[],
  ): Promise<void> {
    if (shas.length === 0) {
      return;
    }
    // One Git invocation for the whole batch, so the batch is a single
    // sequencer: if any commit conflicts, `cherry-pick --abort` restores the
    // repository to the state before the batch. One command per SHA made the
    // earlier picks permanent and un-abortable.
    for (const sha of shas) {
      assertSafeGitOperand(sha, "commit");
    }
    await execGit(repoRoot, ["cherry-pick", ...shas]);
  }

  async function revertMultiple(repoRoot: string, shas: string[]): Promise<void> {
    if (shas.length === 0) {
      return;
    }
    // Same single-sequencer reasoning as cherryPickMultiple. Reverts apply in
    // reverse (newest first), so the ordered list is passed as one command.
    const ordered = [...shas].reverse();
    for (const sha of ordered) {
      assertSafeGitOperand(sha, "commit");
    }
    await execGit(repoRoot, ["revert", "--no-edit", ...ordered]);
  }

  async function cherryPickContinue(repoRoot: string): Promise<void> {
    await execGit(repoRoot, ["cherry-pick", "--continue"], {
      env: nonInteractiveContinueEnv,
    });
  }

  async function cherryPickSkip(repoRoot: string): Promise<void> {
    await execGit(repoRoot, ["cherry-pick", "--skip"]);
  }

  async function cherryPickAbort(repoRoot: string): Promise<void> {
    await execGit(repoRoot, ["cherry-pick", "--abort"]);
  }

  async function revertContinue(repoRoot: string): Promise<void> {
    await execGit(repoRoot, ["revert", "--continue"], {
      env: nonInteractiveContinueEnv,
    });
  }

  async function revertAbort(repoRoot: string): Promise<void> {
    await execGit(repoRoot, ["revert", "--abort"]);
  }

  return {
    cherryPick,
    revertCommit,
    resetTo,
    undoLastCommit,
    cherryPickMultiple,
    revertMultiple,
    cherryPickContinue,
    cherryPickSkip,
    cherryPickAbort,
    revertContinue,
    revertAbort,
  };
}