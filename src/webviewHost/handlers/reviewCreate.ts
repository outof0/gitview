import { createError } from "../../shared/errors/codes";
import { createHostError, createHostResponse } from "../../shared/protocol";
import { formatReviewHandlerError, type ReviewHandlerContext } from "./reviewHelpers";

export function createReviewCreateHandlers(ctx: ReviewHandlerContext) {
  const { deps, registry, resolveRepo, publishReviewDetails } = ctx;
  return {
    async create(
      requestId: string,
      repoId: string,
      providerId: string,
      opts: {
        title: string;
        sourceBranch: string;
        targetBranch: string;
        body?: string;
        draft?: boolean;
      },
    ) {
      if (!deps.trusted) {
        deps.postMessage(
          createHostError(
            requestId,
            createError(
              "WORKSPACE_UNTRUSTED",
              "Review actions are disabled in untrusted workspaces.",
            ),
          ),
        );
        return;
      }
      const repo = await resolveRepo(repoId);
      if (!repo) {
        deps.postMessage(
          createHostError(
            requestId,
            createError(
              "REPOSITORY_NOT_FOUND",
              "Repository not found for review create.",
            ),
          ),
        );
        return;
      }
      try {
        const item = await registry.createReview(repo, providerId, opts);
        deps.postMessage(
          createHostResponse(requestId, "review.create", item),
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

    async createLineComment(
      requestId: string,
      repoId: string,
      providerId: string,
      reviewId: string,
      opts: {
        path: string;
        line: number;
        body: string;
        side?: "LEFT" | "RIGHT";
      },
    ) {
      if (!deps.trusted) {
        deps.postMessage(
          createHostError(
            requestId,
            createError(
              "WORKSPACE_UNTRUSTED",
              "Review actions are disabled in untrusted workspaces.",
            ),
          ),
        );
        return;
      }
      const repo = await resolveRepo(repoId);
      if (!repo) {
        deps.postMessage(
          createHostError(
            requestId,
            createError(
              "REPOSITORY_NOT_FOUND",
              "Repository not found for review line comment.",
            ),
          ),
        );
        return;
      }
      try {
        const result = await registry.createLineComment(
          repo,
          providerId,
          reviewId,
          opts,
        );
        await publishReviewDetails(repo, providerId, reviewId);
        deps.postMessage(
          createHostResponse(requestId, "review.createLineComment", result),
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

    async checkoutBranch(
      requestId: string,
      repoId: string,
      providerId: string,
      reviewId: string,
    ) {
      if (!deps.trusted) {
        deps.postMessage(
          createHostError(
            requestId,
            createError(
              "WORKSPACE_UNTRUSTED",
              "Review actions are disabled in untrusted workspaces.",
            ),
          ),
        );
        return;
      }
      const repo = await resolveRepo(repoId);
      if (!repo) {
        deps.postMessage(
          createHostError(
            requestId,
            createError(
              "REPOSITORY_NOT_FOUND",
              "Repository not found for review checkout.",
            ),
          ),
        );
        return;
      }
      try {
        const result = await registry.checkoutReviewBranch(
          repo,
          providerId,
          reviewId,
        );
        await deps.refreshCoordinator.refreshNow(repo.id);
        deps.postMessage(
          createHostResponse(requestId, "review.checkoutBranch", {
            branch: result.branch,
          }),
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
  };
}
