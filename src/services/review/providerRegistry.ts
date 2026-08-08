import type { Repository } from "../../shared/types/repository";
import type {
  ReviewDetailsSnapshot,
  ReviewFilters,
  ReviewItem,
  ReviewProviderInfo,
} from "../../shared/types/review";
import { filterReviewItems } from "../../shared/types/review";
import {
  applyGithubSuggestion,
  checkoutGithubReviewBranch,
  closeGithubReview,
  createGithubLineComment,
  createGithubReview,
  deleteGithubMergedSourceBranch,
  describeGithubProvider,
  listGithubReviews,
  mergeGithubReview,
  openGithubReview,
  reopenGithubReview,
  submitGithubReview,
  type ReviewProviderContext,
} from "./githubProvider";
import {
  applyGitlabSuggestion,
  checkoutGitlabReviewBranch,
  closeGitlabReview,
  createGitlabLineComment,
  createGitlabReview,
  deleteGitlabMergedSourceBranch,
  describeGitlabProvider,
  listGitlabReviews,
  mergeGitlabReview,
  openGitlabReview,
  reopenGitlabReview,
  submitGitlabReview,
} from "./gitlabProvider";
import { NOOP_LOGGER, errorLogFields } from "../../observability/logger";
import { sanitizeLogMessage } from "../../util/safeLog";

export type ReviewListResult = {
  items: ReviewItem[];
  authRequired: boolean;
  unavailableReason?: string;
};

export type ReviewCreateOptions = {
  title: string;
  sourceBranch: string;
  targetBranch: string;
  body?: string;
  draft?: boolean;
};

export type ReviewLineCommentOptions = {
  path: string;
  line: number;
  body: string;
  side?: "LEFT" | "RIGHT";
};

/** Stable provider contract. Mutation capabilities are opt-in. */
export interface ReviewProvider {
  readonly id: string;
  readonly displayName: string;
  describe(repo: Repository): Promise<ReviewProviderInfo>;
  listReviews(repo: Repository, filters: ReviewFilters): Promise<ReviewListResult>;
  openReview(repo: Repository, reviewId: string): Promise<ReviewDetailsSnapshot | null>;
  submitReview?(
    repo: Repository,
    reviewId: string,
    event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
    body?: string,
  ): Promise<void>;
  mergeReview?(
    repo: Repository,
    reviewId: string,
    method?: "merge" | "squash" | "rebase",
  ): Promise<void>;
  applySuggestion?(
    repo: Repository,
    reviewId: string,
    suggestionId: string,
    cachedSuggestions?: ReviewDetailsSnapshot["suggestions"],
  ): Promise<{ path: string }>;
  closeReview?(repo: Repository, reviewId: string): Promise<void>;
  reopenReview?(repo: Repository, reviewId: string): Promise<void>;
  deleteSourceBranch?(repo: Repository, reviewId: string): Promise<{ branch: string }>;
  checkoutReviewBranch?(repo: Repository, reviewId: string): Promise<{ branch: string }>;
  createReview?(repo: Repository, options: ReviewCreateOptions): Promise<ReviewItem>;
  createLineComment?(
    repo: Repository,
    reviewId: string,
    options: ReviewLineCommentOptions,
  ): Promise<{ commentId: string }>;
}

export interface ReviewProviderRegistry {
  registerProvider(provider: ReviewProvider): { dispose(): void };
  hasProvider(providerId: string): boolean;
  listProviders(repo: Repository): Promise<ReviewProviderInfo[]>;
  listReviews(
    repo: Repository,
    providerId: string,
    filters: ReviewFilters,
  ): Promise<ReviewListResult>;
  openReview(
    repo: Repository,
    providerId: string,
    reviewId: string,
  ): Promise<ReviewDetailsSnapshot | null>;
  submitReview(
    repo: Repository,
    providerId: string,
    reviewId: string,
    event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
    body?: string,
  ): Promise<void>;
  mergeReview(
    repo: Repository,
    providerId: string,
    reviewId: string,
    method?: "merge" | "squash" | "rebase",
  ): Promise<void>;
  applySuggestion(
    repo: Repository,
    providerId: string,
    reviewId: string,
    suggestionId: string,
    cachedSuggestions?: ReviewDetailsSnapshot["suggestions"],
  ): Promise<{ path: string }>;
  closeReview(repo: Repository, providerId: string, reviewId: string): Promise<void>;
  reopenReview(repo: Repository, providerId: string, reviewId: string): Promise<void>;
  deleteSourceBranch(
    repo: Repository,
    providerId: string,
    reviewId: string,
  ): Promise<{ branch: string }>;
  checkoutReviewBranch(
    repo: Repository,
    providerId: string,
    reviewId: string,
  ): Promise<{ branch: string }>;
  createReview(
    repo: Repository,
    providerId: string,
    options: ReviewCreateOptions,
  ): Promise<ReviewItem>;
  createLineComment(
    repo: Repository,
    providerId: string,
    reviewId: string,
    options: ReviewLineCommentOptions,
  ): Promise<{ commentId: string }>;
}

function createBuiltinProviders(ctx: ReviewProviderContext): ReviewProvider[] {
  return [
    {
      id: "github",
      displayName: "GitHub",
      describe: (repo) => describeGithubProvider(ctx, repo),
      listReviews: (repo, filters) => listGithubReviews(ctx, repo, filters),
      openReview: (repo, reviewId) => openGithubReview(ctx, repo, reviewId),
      submitReview: (repo, reviewId, event, body) =>
        submitGithubReview(ctx, repo, reviewId, event, body),
      mergeReview: (repo, reviewId, method) =>
        mergeGithubReview(ctx, repo, reviewId, method),
      applySuggestion: (repo, reviewId, suggestionId, suggestions) =>
        applyGithubSuggestion(ctx, repo, reviewId, suggestionId, suggestions),
      closeReview: (repo, reviewId) => closeGithubReview(ctx, repo, reviewId),
      reopenReview: (repo, reviewId) => reopenGithubReview(ctx, repo, reviewId),
      deleteSourceBranch: (repo, reviewId) =>
        deleteGithubMergedSourceBranch(ctx, repo, reviewId),
      checkoutReviewBranch: (repo, reviewId) =>
        checkoutGithubReviewBranch(ctx, repo, reviewId),
      createReview: (repo, options) => createGithubReview(ctx, repo, options),
      createLineComment: (repo, reviewId, options) =>
        createGithubLineComment(ctx, repo, reviewId, options),
    },
    {
      id: "gitlab",
      displayName: "GitLab",
      describe: (repo) => describeGitlabProvider(ctx, repo),
      listReviews: (repo, filters) => listGitlabReviews(ctx, repo, filters),
      openReview: (repo, reviewId) => openGitlabReview(ctx, repo, reviewId),
      submitReview: (repo, reviewId, event, body) =>
        submitGitlabReview(ctx, repo, reviewId, event, body),
      mergeReview: (repo, reviewId, method) =>
        mergeGitlabReview(ctx, repo, reviewId, method),
      applySuggestion: (repo, reviewId, suggestionId, suggestions) =>
        applyGitlabSuggestion(ctx, repo, reviewId, suggestionId, suggestions),
      closeReview: (repo, reviewId) => closeGitlabReview(ctx, repo, reviewId),
      reopenReview: (repo, reviewId) => reopenGitlabReview(ctx, repo, reviewId),
      deleteSourceBranch: (repo, reviewId) =>
        deleteGitlabMergedSourceBranch(ctx, repo, reviewId),
      checkoutReviewBranch: (repo, reviewId) =>
        checkoutGitlabReviewBranch(ctx, repo, reviewId),
      createReview: (repo, options) => createGitlabReview(ctx, repo, options),
      createLineComment: (repo, reviewId, options) =>
        createGitlabLineComment(ctx, repo, reviewId, options),
    },
  ];
}

function validateProvider(provider: ReviewProvider): void {
  if (!/^[a-z][a-z0-9.-]*$/.test(provider.id)) {
    throw new Error(
      `Invalid review provider id: ${provider.id}. Use lowercase letters, numbers, dots, or hyphens.`,
    );
  }
  if (!provider.displayName.trim()) {
    throw new Error(`Review provider ${provider.id} requires a display name.`);
  }
}

export function createReviewProviderRegistry(
  ctx: ReviewProviderContext,
  initialProviders: readonly ReviewProvider[] = createBuiltinProviders(ctx),
): ReviewProviderRegistry {
  const logger = ctx.logger ?? NOOP_LOGGER;
  const providers = new Map<string, ReviewProvider>();

  function registerProvider(provider: ReviewProvider): { dispose(): void } {
    validateProvider(provider);
    if (providers.has(provider.id)) {
      throw new Error(`Review provider is already registered: ${provider.id}`);
    }
    providers.set(provider.id, provider);
    let disposed = false;
    return {
      dispose() {
        if (!disposed && providers.get(provider.id) === provider) {
          providers.delete(provider.id);
        }
        disposed = true;
      },
    };
  }

  for (const provider of initialProviders) {
    registerProvider(provider);
  }

  function getProvider(providerId: string): ReviewProvider | undefined {
    return providers.get(providerId);
  }

  function requireProvider(providerId: string): ReviewProvider {
    const provider = getProvider(providerId);
    if (!provider) {
      throw new Error(`Unknown review provider: ${providerId}`);
    }
    return provider;
  }

  function unsupported(provider: ReviewProvider, operation: string): Error {
    return new Error(
      `Review provider ${provider.id} does not support ${operation}.`,
    );
  }

  async function listProviders(repo: Repository): Promise<ReviewProviderInfo[]> {
    return Promise.all(
      [...providers.values()].map(async (provider) => {
        try {
          const info = await provider.describe(repo);
          return { ...info, id: provider.id };
        } catch (error) {
          logger.warn("review.provider.describe.failed", {
            providerId: provider.id,
            repoId: repo.id,
            ...errorLogFields(error),
          });
          return {
            id: provider.id,
            displayName: provider.displayName,
            available: false,
            authRequired: false,
            unavailableReason: sanitizeLogMessage(
              error instanceof Error ? error.message : String(error),
            ),
          };
        }
      }),
    );
  }

  async function listReviews(
    repo: Repository,
    providerId: string,
    filters: ReviewFilters,
  ): Promise<ReviewListResult> {
    const provider = getProvider(providerId);
    if (!provider) {
      return {
        items: [],
        authRequired: false,
        unavailableReason: `Unknown review provider: ${providerId}`,
      };
    }
    const result = await provider.listReviews(repo, filters);
    return { ...result, items: filterReviewItems(result.items, filters) };
  }

  async function openReview(
    repo: Repository,
    providerId: string,
    reviewId: string,
  ): Promise<ReviewDetailsSnapshot | null> {
    return getProvider(providerId)?.openReview(repo, reviewId) ?? null;
  }

  async function submitReview(
    repo: Repository,
    providerId: string,
    reviewId: string,
    event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
    body?: string,
  ): Promise<void> {
    const provider = requireProvider(providerId);
    if (!provider.submitReview) {
      throw unsupported(provider, "submitting reviews");
    }
    await provider.submitReview(repo, reviewId, event, body);
  }

  async function mergeReview(
    repo: Repository,
    providerId: string,
    reviewId: string,
    method?: "merge" | "squash" | "rebase",
  ): Promise<void> {
    const provider = requireProvider(providerId);
    if (!provider.mergeReview) {
      throw unsupported(provider, "merging reviews");
    }
    await provider.mergeReview(repo, reviewId, method);
  }

  async function applySuggestion(
    repo: Repository,
    providerId: string,
    reviewId: string,
    suggestionId: string,
    cachedSuggestions?: ReviewDetailsSnapshot["suggestions"],
  ): Promise<{ path: string }> {
    const provider = requireProvider(providerId);
    if (!provider.applySuggestion) {
      throw unsupported(provider, "applying suggestions");
    }
    return provider.applySuggestion(
      repo,
      reviewId,
      suggestionId,
      cachedSuggestions,
    );
  }

  async function closeReview(
    repo: Repository,
    providerId: string,
    reviewId: string,
  ): Promise<void> {
    const provider = requireProvider(providerId);
    if (!provider.closeReview) {
      throw unsupported(provider, "closing reviews");
    }
    await provider.closeReview(repo, reviewId);
  }

  async function reopenReview(
    repo: Repository,
    providerId: string,
    reviewId: string,
  ): Promise<void> {
    const provider = requireProvider(providerId);
    if (!provider.reopenReview) {
      throw unsupported(provider, "reopening reviews");
    }
    await provider.reopenReview(repo, reviewId);
  }

  async function deleteSourceBranch(
    repo: Repository,
    providerId: string,
    reviewId: string,
  ): Promise<{ branch: string }> {
    const provider = requireProvider(providerId);
    if (!provider.deleteSourceBranch) {
      throw unsupported(provider, "deleting source branches");
    }
    return provider.deleteSourceBranch(repo, reviewId);
  }

  async function checkoutReviewBranch(
    repo: Repository,
    providerId: string,
    reviewId: string,
  ): Promise<{ branch: string }> {
    const provider = requireProvider(providerId);
    if (!provider.checkoutReviewBranch) {
      throw unsupported(provider, "checking out review branches");
    }
    return provider.checkoutReviewBranch(repo, reviewId);
  }

  async function createReview(
    repo: Repository,
    providerId: string,
    options: ReviewCreateOptions,
  ): Promise<ReviewItem> {
    const provider = requireProvider(providerId);
    if (!provider.createReview) {
      throw unsupported(provider, "creating reviews");
    }
    return provider.createReview(repo, options);
  }

  async function createLineComment(
    repo: Repository,
    providerId: string,
    reviewId: string,
    options: ReviewLineCommentOptions,
  ): Promise<{ commentId: string }> {
    const provider = requireProvider(providerId);
    if (!provider.createLineComment) {
      throw unsupported(provider, "creating line comments");
    }
    return provider.createLineComment(repo, reviewId, options);
  }

  return {
    registerProvider,
    hasProvider: (providerId) => providers.has(providerId),
    listProviders,
    listReviews,
    openReview,
    submitReview,
    mergeReview,
    applySuggestion,
    closeReview,
    reopenReview,
    deleteSourceBranch,
    checkoutReviewBranch,
    createReview,
    createLineComment,
  };
}
