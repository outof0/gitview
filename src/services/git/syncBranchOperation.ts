import type { SyncBranchResult, SyncBranchTarget } from "../../shared/types/branch";
import type { Repository } from "../../shared/types/repository";
import { createBranchApi, type CheckoutOptions } from "./branch";
import type { GitExecFn } from "./types";

export function createSyncBranchOperationApi(execGit: GitExecFn) {
  const branches = createBranchApi(execGit);

  async function planTargets(
    repos: Repository[],
    ref: string,
  ): Promise<SyncBranchTarget[]> {
    const targets: SyncBranchTarget[] = [];
    for (const repo of repos) {
      const entries = await branches.listBranchEntries(repo.rootPath, repo.id);
      // Look the ref up instead of classifying it by spelling. A local branch
      // with a slash in its name (`feature/login`) used to be searched for among
      // remotes only, and was reported as unavailable in every repository.
      // Local wins when both exist — that is what the user means.
      const target =
        entries.find((entry) => !entry.remote && entry.name === ref) ??
        entries.find((entry) => entry.remote && entry.fullName === ref);
      const available = target?.headSha != null;
      targets.push({
        repoId: repo.id,
        name: repo.name,
        available,
        currentBranch: repo.currentBranch,
        targetSha: target?.headSha ?? null,
        unavailableReason: available
          ? undefined
          : `Branch "${ref}" is not available in this repository.`,
      });
    }
    return targets;
  }

  async function checkoutRef(
    repoRoot: string,
    ref: string,
    opts?: CheckoutOptions,
  ): Promise<void> {
    if ((await branches.resolveRefKind(repoRoot, ref)) === "remote") {
      await branches.checkoutRemoteAsTracking(repoRoot, ref, opts);
      return;
    }
    await branches.checkout(repoRoot, ref, opts);
  }

  async function execute(
    repos: Repository[],
    ref: string,
    opts?: CheckoutOptions,
    plannedTargets?: SyncBranchTarget[],
  ): Promise<SyncBranchResult[]> {
    const targets = plannedTargets ?? (await planTargets(repos, ref));
    const applicable = targets.filter((target) => target.available);
    const repoById = new Map(repos.map((repo) => [repo.id, repo]));
    const results: SyncBranchResult[] = [];

    for (const target of applicable) {
      const repo = repoById.get(target.repoId);
      if (!repo) {
        continue;
      }
      try {
        await checkoutRef(repo.rootPath, ref, opts);
        results.push({
          repoId: target.repoId,
          name: target.name,
          ok: true,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({
          repoId: target.repoId,
          name: target.name,
          ok: false,
          error: msg.replace(/.*Command failed: git[^\n]*\n?/i, "").trim() || msg,
        });
      }
    }

    for (const target of targets.filter((entry) => !entry.available)) {
      results.push({
        repoId: target.repoId,
        name: target.name,
        ok: false,
        skipped: true,
        error: target.unavailableReason,
      });
    }

    return results;
  }

  return { planTargets, execute };
}