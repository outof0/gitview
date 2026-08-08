import type { ReviewFilters } from "@gitview/shared/types/review";
import type { ProtocolRequestFn } from "./clientCore";

export function createProtocolClientReviewMethods(request: ProtocolRequestFn) {
  return {
    listReviews: (
      repoId: string,
      opts?: { providerId?: string; filters?: ReviewFilters },
    ) =>
      request(
        "review.list",
        { repoId, providerId: opts?.providerId, filters: opts?.filters },
      ),
    openReview: (repoId: string, providerId: string, reviewId: string) =>
      request(
        "review.open",
        { repoId, providerId, reviewId },
      ),
    submitReview: (
      repoId: string,
      providerId: string,
      reviewId: string,
      event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
      body?: string,
    ) =>
      request(
        "review.submit",
        { repoId, providerId, reviewId, event, body },
      ),
    mergeReview: (
      repoId: string,
      providerId: string,
      reviewId: string,
      method?: "merge" | "squash" | "rebase",
    ) =>
      request(
        "review.merge",
        { repoId, providerId, reviewId, method },
      ),
    applyReviewSuggestion: (
      repoId: string,
      providerId: string,
      reviewId: string,
      suggestionId: string,
    ) =>
      request(
        "review.applySuggestion",
        { repoId, providerId, reviewId, suggestionId },
      ),
    closeReview: (repoId: string, providerId: string, reviewId: string) =>
      request(
        "review.close",
        { repoId, providerId, reviewId },
      ),
    reopenReview: (repoId: string, providerId: string, reviewId: string) =>
      request(
        "review.reopen",
        { repoId, providerId, reviewId },
      ),
    deleteReviewSourceBranch: (
      repoId: string,
      providerId: string,
      reviewId: string,
    ) =>
      request(
        "review.deleteSourceBranch",
        { repoId, providerId, reviewId },
      ),
    checkoutReviewBranch: (
      repoId: string,
      providerId: string,
      reviewId: string,
    ) =>
      request(
        "review.checkoutBranch",
        { repoId, providerId, reviewId },
      ),
    createReview: (
      repoId: string,
      providerId: string,
      opts: {
        title: string;
        sourceBranch: string;
        targetBranch: string;
        body?: string;
        draft?: boolean;
      },
    ) =>
      request("review.create", { repoId, providerId, ...opts }),
    createReviewLineComment: (
      repoId: string,
      providerId: string,
      reviewId: string,
      opts: {
        path: string;
        line: number;
        body: string;
        side?: "LEFT" | "RIGHT";
      },
    ) =>
      request(
        "review.createLineComment",
        { repoId, providerId, reviewId, ...opts },
      ),
  };
}