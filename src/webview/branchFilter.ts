import { isOptionLikeBranchRef } from "../types/messageGuards";

export type BranchFilterError = {
  ok: false;
  code: "GIT_ERROR";
  message: string;
};

export type BranchFilterSuccess = {
  ok: true;
  branch?: string;
};

export type BranchFilterResult = BranchFilterSuccess | BranchFilterError;

export async function validateBranchFilter(
  branch: string | undefined,
  listBranches: (repoRoot: string) => Promise<string[]>,
  repoRoot: string,
): Promise<BranchFilterResult> {
  if (branch === undefined) {
    return { ok: true };
  }
  if (isOptionLikeBranchRef(branch)) {
    return { ok: false, code: "GIT_ERROR", message: "Invalid branch filter." };
  }
  const branches = await listBranches(repoRoot);
  if (!branches.includes(branch)) {
    return { ok: false, code: "GIT_ERROR", message: "Unknown branch filter." };
  }
  return { ok: true, branch };
}