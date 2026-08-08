import type { GitExecFn } from "./types";
import { createStagingApi } from "./staging";

export type CommitInput = {
  message: string;
  paths?: string[];
  amend?: boolean;
  signoff?: boolean;
  gpgSign?: boolean;
  author?: string;
  skipHooks?: boolean;
  allowEmptyMessage?: boolean;
};

export type CommitResult = {
  sha: string;
};

export function createCommitApi(execGit: GitExecFn) {
  const staging = createStagingApi(execGit);

  async function resolveHeadSha(repoRoot: string): Promise<string> {
    const { stdout } = await execGit(repoRoot, ["rev-parse", "HEAD"]);
    return stdout.trim();
  }

  async function commit(repoRoot: string, input: CommitInput): Promise<CommitResult> {
    const message = input.message.trim();
    if (!message && !input.allowEmptyMessage) {
      throw new Error("Commit message cannot be empty.");
    }

    const args = ["commit"];
    if (input.amend) {
      args.push("--amend");
    }
    if (input.signoff) {
      args.push("--signoff");
    }
    if (input.gpgSign) {
      args.push("-S");
    }
    if (input.skipHooks) {
      args.push("--no-verify");
    }
    if (input.author) {
      args.push("--author", input.author);
    }
    args.push("-m", message);
    if (input.paths && input.paths.length > 0) {
      await staging.stageFiles(repoRoot, input.paths);
      args.push("--", ...input.paths);
    }

    const headBefore = await resolveHeadSha(repoRoot).catch(() => null);
    await execGit(repoRoot, args);
    const headAfter = await resolveHeadSha(repoRoot);
    if (headBefore === headAfter && !input.amend) {
      throw new Error("Nothing to commit.");
    }
    return { sha: headAfter };
  }

  return { commit };
}