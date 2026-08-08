import { createError } from "../../shared/errors/codes";
import { createHostError, createHostResponse } from "../../shared/protocol";
import { formatReviewHandlerError, type ReviewHandlerContext } from "./reviewHelpers";

export function createReviewMutationHandlers(ctx: ReviewHandlerContext) {
  const { deps, registry, resolveRepo, publishReviewDetails } = ctx;
  return {
    async submit(
      requestId: string,
      repoId: string,
      providerId: string,
      reviewId: string,
      event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
      body?: string,
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
              "Repository not found for review submit.",
            ),
          ),
        );
        return;
      }
      try {
        await registry.submitReview(repo, providerId, reviewId, event, body);
        await publishReviewDetails(repo, providerId, reviewId);
        deps.postMessage(
          createHostResponse(requestId, "review.submit", { ok: true }),
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

    async applySuggestion(
      requestId: string,
      repoId: string,
      providerId: string,
      reviewId: string,
      suggestionId: string,
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
              "Repository not found for review suggestion.",
            ),
          ),
        );
        return;
      }
      try {
        const result = await registry.applySuggestion(
          repo,
          providerId,
          reviewId,
          suggestionId,
        );
        deps.postMessage(
          createHostResponse(requestId, "review.applySuggestion", {
            suggestionId,
            path: result.path,
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

    async merge(
      requestId: string,
      repoId: string,
      providerId: string,
      reviewId: string,
      method?: "merge" | "squash" | "rebase",
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
              "Repository not found for review merge.",
            ),
          ),
        );
        return;
      }
      try {
        await registry.mergeReview(repo, providerId, reviewId, method);
        await publishReviewDetails(repo, providerId, reviewId);
        deps.postMessage(
          createHostResponse(requestId, "review.merge", { ok: true }),
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

    async close(
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
              "Repository not found for review close.",
            ),
          ),
        );
        return;
      }
      try {
        await registry.closeReview(repo, providerId, reviewId);
        await publishReviewDetails(repo, providerId, reviewId);
        deps.postMessage(
          createHostResponse(requestId, "review.close", { ok: true }),
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

    async reopen(
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
              "Repository not found for review reopen.",
            ),
          ),
        );
        return;
      }
      try {
        await registry.reopenReview(repo, providerId, reviewId);
        await publishReviewDetails(repo, providerId, reviewId);
        deps.postMessage(
          createHostResponse(requestId, "review.reopen", { ok: true }),
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

    async deleteSourceBranch(
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
              "Repository not found for review branch delete.",
            ),
          ),
        );
        return;
      }
      try {
        const result = await registry.deleteSourceBranch(
          repo,
          providerId,
          reviewId,
        );
        await publishReviewDetails(repo, providerId, reviewId);
        deps.postMessage(
          createHostResponse(requestId, "review.deleteSourceBranch", {
            ok: true,
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
    },  };
}
