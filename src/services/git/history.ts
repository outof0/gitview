import { nonInteractiveContinueEnv } from "./exec";
import type { GitExecFn } from "./types";

export type ResetMode = "soft" | "mixed" | "hard" | "keep";

export function createHistoryApi(execGit: GitExecFn) {
  async function cherryPick(repoRoot: string, sha: string): Promise<void> {
    await execGit(repoRoot, ["cherry-pick", sha]);
  }

  async function revertCommit(repoRoot: string, sha: string): Promise<void> {
    await execGit(repoRoot, ["revert", "--no-edit", sha]);
  }

  async function resetTo(
    repoRoot: string,
    sha: string,
    mode: ResetMode,
  ): Promise<void> {
    await execGit(repoRoot, ["reset", `--${mode}`, sha]);
  }

  async function undoLastCommit(repoRoot: string): Promise<void> {
    await execGit(repoRoot, ["reset", "--mixed", "HEAD~1"]);
  }

  async function cherryPickMultiple(
    repoRoot: string,
    shas: string[],
  ): Promise<void> {
    for (const sha of shas) {
      await cherryPick(repoRoot, sha);
    }
  }

  async function revertMultiple(repoRoot: string, shas: string[]): Promise<void> {
    for (const sha of [...shas].reverse()) {
      await revertCommit(repoRoot, sha);
    }
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