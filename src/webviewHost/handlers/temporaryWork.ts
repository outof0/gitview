import type { TemporaryWorkHandlerDeps } from "./temporaryWorkHelpers";
import { createTemporaryWorkContext } from "./temporaryWorkHelpers";
import { createStashHandlers } from "./temporaryWorkStash";
import { createShelfHandlers } from "./temporaryWorkShelf";
import { createPatchHandlers } from "./temporaryWorkPatch";

export type { TemporaryWorkHandlerDeps } from "./temporaryWorkHelpers";

export function createTemporaryWorkHandlers(deps: TemporaryWorkHandlerDeps) {
  const ctx = createTemporaryWorkContext(deps);
  return {
    ...createStashHandlers(ctx),
    ...createShelfHandlers(ctx),
    ...createPatchHandlers(ctx),
  };
}
