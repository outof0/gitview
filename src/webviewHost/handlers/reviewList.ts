import { createError } from "../../shared/errors/codes";
import { createHostError, createHostResponse } from "../../shared/protocol";
import type { ReviewFilters, ReviewListSnapshot } from "../../shared/types/review";
import { formatReviewHandlerError, type ReviewHandlerContext } from "./reviewHelpers";

export function createReviewListHandlers(ctx: ReviewHandlerContext) {
  const { deps, registry, resolveRepo } = ctx;
  return {
    async list(
      requestId: string,
      repoId: string,
      providerId?: string,
      filters: ReviewFilters = {},
    ) {
      const repo = await resolveRepo(repoId);
      if (!repo) {
        deps.postMessage(
          createHostError(
            requestId,
            createError(
              "REPOSITORY_NOT_FOUND",
              "Repository not found for review list.",
            ),
          ),
        );
        return;
      }
      try {
        const providers = await registry.listProviders(repo);
        const selectedProvider =
          providerId ??
          providers.find((provider) => provider.available)?.id ??
          providers[0]?.id ??
          null;
        let items: ReviewListSnapshot["items"] = [];
        let authRequired = false;
        let unavailableReason: string | undefined;
        if (selectedProvider) {
          const result = await registry.listReviews(repo, selectedProvider, filters);
          items = result.items;
          authRequired = result.authRequired;
          unavailableReason = result.unavailableReason;
        }
        const snapshot: ReviewListSnapshot = {
          repoId: repo.id,
          providers,
          selectedProviderId: selectedProvider,
          items,
          authRequired,
          unavailableReason,
          filters,
          refreshedAt: Date.now(),
        };
        deps.postMessage({
          protocolVersion: 1,
          type: "review.snapshot",
          payload: snapshot,
        });
        deps.postMessage(
          createHostResponse(requestId, "review.list", snapshot),
        );
      } catch (err) {
        deps.postMessage(
          createHostError(
            requestId,
            createError(
              "GIT_COMMAND_FAILED",
              formatReviewHandlerError(err),
            ),
          ),
        );
      }
    },

    async open(
      requestId: string,
      repoId: string,
      providerId: string,
      reviewId: string,
    ) {
      const repo = await resolveRepo(repoId);
      if (!repo) {
        deps.postMessage(
          createHostError(
            requestId,
            createError(
              "REPOSITORY_NOT_FOUND",
              "Repository not found for review details.",
            ),
          ),
        );
        return;
      }
      try {
        const details = await registry.openReview(repo, providerId, reviewId);
        if (!details) {
          deps.postMessage(
            createHostError(
              requestId,
              createError(
                "NOT_IMPLEMENTED",
                "Review provider is unavailable for this repository.",
              ),
            ),
          );
          return;
        }
        deps.postMessage({
          protocolVersion: 1,
          type: "review.details",
          payload: details,
        });
        deps.postMessage(createHostResponse(requestId, "review.open", details));
      } catch (err) {
        deps.postMessage(
          createHostError(
            requestId,
            createError(
              "GIT_COMMAND_FAILED",
              formatReviewHandlerError(err),
            ),
          ),
        );
      }
    },
  };
}
