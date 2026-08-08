import { createError } from "../../shared/errors/codes";
import {
  createHostError,
  type HostToWebview,
} from "../../shared/protocol";
import {
  createReviewProviderRegistry,
  type ReviewProviderRegistry,
} from "../../services/review/providerRegistry";
import type { RepositoryService } from "../../services/repositoryService";
import type { RefreshCoordinator } from "../../services/watchers/refreshCoordinator";
import type { GitExecFn } from "../../services/git/types";
import type { Repository } from "../../shared/types/repository";

import type { ReviewFetch } from "../../services/review/reviewFetch";
import { sanitizeLogMessage } from "../../util/safeLog";

export type ReviewHandlerDeps = {
  execGit: GitExecFn;
  repositoryService: RepositoryService;
  refreshCoordinator: RefreshCoordinator;
  trusted: boolean;
  workspaceFolders: Array<{ uriPath: string; name: string }>;
  postMessage: (message: HostToWebview) => void;
  getReviewAccessToken?: (providerId: string) => Promise<string | null>;
  getGithubApiBaseUrl?: () => string;
  getGitlabApiBaseUrl?: () => string;
  reviewFetchFn?: ReviewFetch;
  reviewProviderRegistry?: ReviewProviderRegistry;
};

export function formatReviewHandlerError(err: unknown): string {
  return sanitizeLogMessage(err instanceof Error ? err.message : String(err));
}

export function createReviewHandlerContext(deps: ReviewHandlerDeps) {
  const registry =
    deps.reviewProviderRegistry ??
    createReviewProviderRegistry({
      execGit: deps.execGit,
      getAccessToken: deps.getReviewAccessToken,
      getGithubApiBaseUrl: deps.getGithubApiBaseUrl,
      getGitlabApiBaseUrl: deps.getGitlabApiBaseUrl,
      fetchFn: deps.reviewFetchFn,
    });

  async function discoverRepos(explicitRepoId?: string) {
    return deps.repositoryService.discoverRepositories({
      workspaceFolders: deps.workspaceFolders,
      explicitRepoId,
      trusted: deps.trusted,
    });
  }

  async function resolveRepo(repoId: string) {
    const repos = await discoverRepos(repoId);
    return deps.repositoryService.resolveRepositoryForResource(
      repos,
      undefined,
      repoId,
    );
  }

  async function publishReviewDetails(
    repo: Repository,
    providerId: string,
    reviewId: string,
  ) {
    const details = await registry.openReview(repo, providerId, reviewId);
    if (details) {
      deps.postMessage({
        protocolVersion: 1,
        type: "review.details",
        payload: details,
      });
    }
  }

  async function requireTrusted(requestId: string): Promise<boolean> {
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
      return false;
    }
    return true;
  }

  return { deps, registry, resolveRepo, publishReviewDetails, requireTrusted };
}

export type ReviewHandlerContext = ReturnType<typeof createReviewHandlerContext>;
