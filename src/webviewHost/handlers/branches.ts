import type { BranchHandlerDeps } from "./branchHelpers";
import { createBranchHandlerContext } from "./branchHelpers";
import { createBranchCheckoutHandlers } from "./branchCheckout";
import { createBranchCrudHandlers } from "./branchCrud";
import { createBranchCompareHandlers } from "./branchCompare";
import { createBranchIntegrationHandlers } from "./branchIntegration";

export type { BranchHandlerDeps } from "./branchHelpers";

export function createBranchHandlers(deps: BranchHandlerDeps) {
  const ctx = createBranchHandlerContext(deps);
  return {
    ...createBranchCheckoutHandlers(ctx),
    ...createBranchCrudHandlers(ctx),
    ...createBranchCompareHandlers(ctx),
    ...createBranchIntegrationHandlers(ctx),
  };
}