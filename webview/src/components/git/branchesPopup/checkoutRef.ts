import type { BranchEntry } from "@gitview/shared/types/branch";

export function checkoutRef(branch: BranchEntry): string {
  return branch.remote ? branch.fullName : branch.name;
}