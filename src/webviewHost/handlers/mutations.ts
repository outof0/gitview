import type { MutationHandlerDeps } from "./mutationHelpers";
import { createMutationHandlerContext } from "./mutationHelpers";
import { createStagingMutationHandlers } from "./mutationStaging";
import { createCommitMutationHandlers } from "./mutationCommit";
import { createSyncMutationHandlers } from "./mutationSync";

export type { MutationHandlerDeps } from "./mutationHelpers";

export function createMutationHandlers(deps: MutationHandlerDeps) {
  const ctx = createMutationHandlerContext(deps);
  return {
    ...createStagingMutationHandlers(ctx),
    ...createCommitMutationHandlers(ctx),
    ...createSyncMutationHandlers(ctx),
  };
}
