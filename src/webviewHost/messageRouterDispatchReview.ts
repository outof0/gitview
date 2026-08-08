import { type WebviewToHost } from "../shared/protocol";
import type { MessageRouterContext } from "./messageRouterContext";

export async function dispatchReview(
  request: WebviewToHost,
  ctx: MessageRouterContext,
): Promise<boolean> {
  const { reviewHandlers } = ctx;
  switch (request.type) {
      case "review.list":
        await reviewHandlers.list(
          request.requestId,
          request.payload.repoId,
          request.payload.providerId,
          request.payload.filters,
        );
        return true;

      case "review.open":
        await reviewHandlers.open(
          request.requestId,
          request.payload.repoId,
          request.payload.providerId,
          request.payload.reviewId,
        );
        return true;

      case "review.submit":
        await reviewHandlers.submit(
          request.requestId,
          request.payload.repoId,
          request.payload.providerId,
          request.payload.reviewId,
          request.payload.event,
          request.payload.body,
        );
        return true;

      case "review.merge":
        await reviewHandlers.merge(
          request.requestId,
          request.payload.repoId,
          request.payload.providerId,
          request.payload.reviewId,
          request.payload.method,
        );
        return true;

      case "review.applySuggestion":
        await reviewHandlers.applySuggestion(
          request.requestId,
          request.payload.repoId,
          request.payload.providerId,
          request.payload.reviewId,
          request.payload.suggestionId,
        );
        return true;

      case "review.close":
        await reviewHandlers.close(
          request.requestId,
          request.payload.repoId,
          request.payload.providerId,
          request.payload.reviewId,
        );
        return true;

      case "review.reopen":
        await reviewHandlers.reopen(
          request.requestId,
          request.payload.repoId,
          request.payload.providerId,
          request.payload.reviewId,
        );
        return true;

      case "review.deleteSourceBranch":
        await reviewHandlers.deleteSourceBranch(
          request.requestId,
          request.payload.repoId,
          request.payload.providerId,
          request.payload.reviewId,
        );
        return true;

      case "review.checkoutBranch":
        await reviewHandlers.checkoutBranch(
          request.requestId,
          request.payload.repoId,
          request.payload.providerId,
          request.payload.reviewId,
        );
        return true;

      case "review.create":
        await reviewHandlers.create(
          request.requestId,
          request.payload.repoId,
          request.payload.providerId,
          {
            title: request.payload.title,
            sourceBranch: request.payload.sourceBranch,
            targetBranch: request.payload.targetBranch,
            body: request.payload.body,
            draft: request.payload.draft,
          },
        );
        return true;

      case "review.createLineComment":
        await reviewHandlers.createLineComment(
          request.requestId,
          request.payload.repoId,
          request.payload.providerId,
          request.payload.reviewId,
          {
            path: request.payload.path,
            line: request.payload.line,
            body: request.payload.body,
            side: request.payload.side,
          },
        );
        return true;
    default:
      return false;
  }
}
