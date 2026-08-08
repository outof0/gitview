import type { ReviewHandlerDeps } from "./reviewHelpers";
import { createReviewHandlerContext } from "./reviewHelpers";
import { createReviewListHandlers } from "./reviewList";
import { createReviewMutationHandlers } from "./reviewMutations";
import { createReviewCreateHandlers } from "./reviewCreate";

export type { ReviewHandlerDeps } from "./reviewHelpers";

export function createReviewHandlers(deps: ReviewHandlerDeps) {
  const ctx = createReviewHandlerContext(deps);
  return {
    ...createReviewListHandlers(ctx),
    ...createReviewMutationHandlers(ctx),
    ...createReviewCreateHandlers(ctx),
  };
}
