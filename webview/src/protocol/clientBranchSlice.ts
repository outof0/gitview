import type { ProtocolRequestFn } from "./clientCore";

export function createProtocolClientBranchMethods(request: ProtocolRequestFn) {
  return {
    listBranches: (repoId: string) =>
      request("branch.list", { repoId }),
    checkoutBranch: (
      repoId: string,
      ref: string,
      opts?: { smart?: boolean; force?: boolean },
    ) =>
      request(
        "branch.checkout",
        { repoId, ref, smart: opts?.smart, force: opts?.force },
      ),
    syncBranchOperation: (
      repoId: string,
      ref: string,
      opts?: { smart?: boolean; force?: boolean; confirmed?: boolean },
    ) =>
      request(
        "branch.syncOperation",
        {
          repoId,
          ref,
          smart: opts?.smart,
          force: opts?.force,
          confirmed: opts?.confirmed,
        },
      ),
    createBranch: (
      repoId: string,
      name: string,
      startPoint?: string,
      opts?: { checkout?: boolean; force?: boolean },
    ) =>
      request(
        "branch.create",
        { repoId, name, startPoint, ...opts },
      ),
    renameBranch: (repoId: string, oldName: string, newName: string) =>
      request(
        "branch.rename",
        { repoId, oldName, newName },
      ),
    deleteBranch: (repoId: string, name: string, force?: boolean) =>
      request(
        "branch.delete",
        { repoId, name, force },
      ),
    pushBranch: (
      repoId: string,
      name: string,
      opts?: { remote?: string; setUpstream?: boolean },
    ) =>
      request(
        "branch.push",
        { repoId, name, ...opts },
      ),
    favoriteBranch: (repoId: string, name: string) =>
      request("branch.favorite", { repoId, name }),
    compareBranchWithCurrent: (
      repoId: string,
      ref: string,
      path?: string,
    ) =>
      request(
        "branch.compareCurrent",
        { repoId, ref, path },
      ),
    compareBranchWithWorkingTree: (
      repoId: string,
      ref: string,
      path?: string,
    ) =>
      request(
        "branch.compareWorkingTree",
        { repoId, ref, path },
      ),
    compareBranchFile: (
      repoId: string,
      ref: string,
      path: string,
      mode: "current" | "workingTree",
    ) =>
      request(
        "branch.compareFile",
        { repoId, ref, path, mode },
      ),
    applyBranchCompareFile: (
      repoId: string,
      ref: string,
      path: string,
      mode: "current" | "workingTree",
    ) =>
      request(
        "branch.compareApplyFile",
        { repoId, ref, path, mode },
      ),
    mergeBranch: (
      repoId: string,
      ref: string,
      opts?: {
        noFf?: boolean;
        squash?: boolean;
        message?: string;
        noCommit?: boolean;
        log?: boolean;
      },
    ) =>
      request(
        "branch.merge",
        { repoId, ref, ...opts },
      ),
    rebaseOnto: (
      repoId: string,
      onto: string,
      opts?: { interactive?: boolean; from?: string; rebaseMerges?: boolean },
    ) =>
      request(
        "branch.rebaseOnto",
        { repoId, onto, ...opts },
      ),
    continueOperation: (repoId: string) =>
      request("operation.continue", { repoId }),
    skipOperation: (repoId: string) =>
      request("operation.skip", { repoId }),
    abortOperation: (repoId: string) =>
      request("operation.abort", { repoId }),
  };
}