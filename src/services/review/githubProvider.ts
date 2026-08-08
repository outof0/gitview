import type { GitExecFn } from "../git/types";
import type { Repository } from "../../shared/types/repository";
import type {
  ReviewDetailsSnapshot,
  ReviewFilters,
  ReviewItem,
  ReviewProviderInfo,
  ReviewSuggestion,
} from "../../shared/types/review";
import { applySuggestionToFile } from "./applySuggestion";
import { createGithubApi } from "./githubApi";
import { detectHostedRemote, readOriginRemoteUrl } from "./remoteDetect";
import { githubApiBaseUrl, parseGithubRemoteUrl } from "./githubRemote";
import type { ReviewFetch } from "./reviewFetch";
import type { Logger } from "../../observability/logger";

export type ReviewProviderContext = {
  execGit: GitExecFn;
  logger?: Logger;
  getAccessToken?: (providerId: string) => Promise<string | null>;
  getGithubApiBaseUrl?: () => string;
  getGitlabApiBaseUrl?: () => string;
  fetchFn?: ReviewFetch;
};

async function resolveGithubApi(ctx: ReviewProviderContext, repo: Repository) {
  const remoteUrl = await readOriginRemoteUrl(ctx.execGit, repo.rootPath);
  if (!remoteUrl || detectHostedRemote(remoteUrl) !== "github") {
    return null;
  }
  const coords = parseGithubRemoteUrl(remoteUrl);
  if (!coords) {
    return null;
  }
  const token = (await ctx.getAccessToken?.("github")) ?? null;
  if (!token) {
    return { coords, api: null, token: null };
  }
  const api = createGithubApi({
    token,
    apiBaseUrl: githubApiBaseUrl(coords.host, ctx.getGithubApiBaseUrl?.()),
    fetchFn: ctx.fetchFn,
  });
  return { coords, api, token };
}

export async function describeGithubProvider(
  ctx: ReviewProviderContext,
  repo: Repository,
): Promise<ReviewProviderInfo> {
  const resolved = await resolveGithubApi(ctx, repo);
  if (!resolved) {
    return {
      id: "github",
      displayName: "GitHub",
      available: false,
      authRequired: false,
      unavailableReason: "No GitHub remote configured for this repository.",
    };
  }
  if (!resolved.token || !resolved.api) {
    return {
      id: "github",
      displayName: "GitHub",
      available: true,
      authRequired: true,
      unavailableReason:
        "Connect a GitHub token via Command Palette: GitView: Set GitHub Review Token…",
    };
  }
  return {
    id: "github",
    displayName: "GitHub",
    available: true,
    authRequired: false,
  };
}

export async function listGithubReviews(
  ctx: ReviewProviderContext,
  repo: Repository,
  filters: ReviewFilters,
): Promise<{ items: ReviewItem[]; authRequired: boolean; unavailableReason?: string }> {
  const info = await describeGithubProvider(ctx, repo);
  if (!info.available) {
    return {
      items: [],
      authRequired: false,
      unavailableReason: info.unavailableReason,
    };
  }
  if (info.authRequired) {
    return {
      items: [],
      authRequired: true,
      unavailableReason: info.unavailableReason,
    };
  }
  const resolved = await resolveGithubApi(ctx, repo);
  if (!resolved?.api || !resolved.coords) {
    return { items: [], authRequired: true };
  }
  const state = filters.state ?? "open";
  const items = await resolved.api.listPullRequests(resolved.coords, state);
  return { items, authRequired: false };
}

export async function openGithubReview(
  ctx: ReviewProviderContext,
  repo: Repository,
  reviewId: string,
): Promise<ReviewDetailsSnapshot | null> {
  const resolved = await resolveGithubApi(ctx, repo);
  if (!resolved?.api || !resolved.coords) {
    return null;
  }
  const number = Number.parseInt(reviewId, 10);
  if (!Number.isFinite(number)) {
    return null;
  }
  const [prRaw, files, activity, mergeability, commits, reviewComments] =
    await Promise.all([
      resolved.api.getPullRequestRaw(resolved.coords, number),
      resolved.api.getPullRequestFiles(resolved.coords, number),
      resolved.api.getPullRequestTimeline(resolved.coords, number),
      resolved.api.getMergeability(resolved.coords, number),
      resolved.api.getPullRequestCommits(resolved.coords, number),
      resolved.api.getPullRequestReviewComments(resolved.coords, number),
    ]);
  const capabilities = resolved.api.getPullRequestCapabilities(prRaw);
  const reviewItem = {
    id: String(prRaw.number),
    number: prRaw.number,
    title: prRaw.title,
    state:
      prRaw.merged_at || prRaw.merged
        ? ("merged" as const)
        : prRaw.draft
          ? ("draft" as const)
          : prRaw.state,
    author: prRaw.user?.login ?? "unknown",
    createdAt: prRaw.created_at,
    updatedAt: prRaw.updated_at,
    sourceBranch: prRaw.head?.ref ?? "",
    targetBranch: prRaw.base?.ref ?? "",
    url: prRaw.html_url,
    draft: prRaw.draft,
  };
  return {
    repoId: repo.id,
    providerId: "github",
    review: reviewItem,
    timeline: activity.timeline,
    files,
    comments: [...activity.comments, ...reviewComments.comments],
    suggestions: reviewComments.suggestions,
    commits,
    canApprove: reviewItem.state === "open" || reviewItem.state === "draft",
    canRequestChanges: reviewItem.state === "open" || reviewItem.state === "draft",
    canMerge: mergeability.mergeable,
    canClose: capabilities.canClose,
    canReopen: capabilities.canReopen,
    canDeleteSourceBranch: capabilities.canDeleteSourceBranch,
    canCheckoutBranch: capabilities.canCheckoutBranch,
    mergeBlockedReason: mergeability.blockedReason,
    deleteSourceBranchBlockedReason: capabilities.deleteSourceBranchBlockedReason,
    checkoutBranchBlockedReason: capabilities.checkoutBranchBlockedReason,
    mergeMethods: ["merge", "squash", "rebase"],
    headCommitSha: prRaw.head?.sha ?? commits[0]?.sha,
    canCreateLineComment:
      reviewItem.state === "open" || reviewItem.state === "draft",
    refreshedAt: Date.now(),
  };
}

export async function createGithubReview(
  ctx: ReviewProviderContext,
  repo: Repository,
  opts: {
    title: string;
    sourceBranch: string;
    targetBranch: string;
    body?: string;
    draft?: boolean;
  },
): Promise<ReviewItem> {
  const resolved = await resolveGithubApi(ctx, repo);
  if (!resolved?.api || !resolved.coords) {
    throw new Error("GitHub provider is not authenticated.");
  }
  return resolved.api.createPullRequest(resolved.coords, opts);
}

export async function createGithubLineComment(
  ctx: ReviewProviderContext,
  repo: Repository,
  reviewId: string,
  opts: {
    path: string;
    line: number;
    body: string;
    side?: "LEFT" | "RIGHT";
  },
): Promise<{ commentId: string }> {
  const resolved = await resolveGithubApi(ctx, repo);
  if (!resolved?.api || !resolved.coords) {
    throw new Error("GitHub provider is not authenticated.");
  }
  const number = Number.parseInt(reviewId, 10);
  const pr = await resolved.api.getPullRequestRaw(resolved.coords, number);
  const commitId = pr.head?.sha;
  if (!commitId) {
    throw new Error("Pull request head commit is unavailable for line comments.");
  }
  return resolved.api.createPullReviewComment(resolved.coords, number, {
    ...opts,
    commitId,
  });
}

export async function submitGithubReview(
  ctx: ReviewProviderContext,
  repo: Repository,
  reviewId: string,
  event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
  body?: string,
): Promise<void> {
  const resolved = await resolveGithubApi(ctx, repo);
  if (!resolved?.api || !resolved.coords) {
    throw new Error("GitHub provider is not authenticated.");
  }
  const number = Number.parseInt(reviewId, 10);
  await resolved.api.submitReview(resolved.coords, number, event, body);
}

export async function applyGithubSuggestion(
  ctx: ReviewProviderContext,
  repo: Repository,
  reviewId: string,
  suggestionId: string,
  cachedSuggestions?: ReviewSuggestion[],
): Promise<{ path: string }> {
  const resolved = await resolveGithubApi(ctx, repo);
  if (!resolved?.api || !resolved.coords) {
    throw new Error("GitHub provider is not authenticated.");
  }
  const number = Number.parseInt(reviewId, 10);
  let suggestions = cachedSuggestions;
  if (!suggestions) {
    const fetched = await resolved.api.getPullRequestReviewComments(
      resolved.coords,
      number,
    );
    suggestions = fetched.suggestions;
  }
  const suggestion = suggestions.find((entry) => entry.id === suggestionId);
  if (!suggestion) {
    throw new Error("Review suggestion not found.");
  }
  await applySuggestionToFile(
    repo.rootPath,
    suggestion.path,
    suggestion.line,
    suggestion.startLine,
    suggestion.suggestionText,
  );
  return { path: suggestion.path };
}

export async function mergeGithubReview(
  ctx: ReviewProviderContext,
  repo: Repository,
  reviewId: string,
  method: "merge" | "squash" | "rebase" = "merge",
): Promise<void> {
  const resolved = await resolveGithubApi(ctx, repo);
  if (!resolved?.api || !resolved.coords) {
    throw new Error("GitHub provider is not authenticated.");
  }
  const number = Number.parseInt(reviewId, 10);
  await resolved.api.mergePullRequest(resolved.coords, number, method);
}

export async function closeGithubReview(
  ctx: ReviewProviderContext,
  repo: Repository,
  reviewId: string,
): Promise<void> {
  const resolved = await resolveGithubApi(ctx, repo);
  if (!resolved?.api || !resolved.coords) {
    throw new Error("GitHub provider is not authenticated.");
  }
  const number = Number.parseInt(reviewId, 10);
  await resolved.api.closePullRequest(resolved.coords, number);
}

export async function reopenGithubReview(
  ctx: ReviewProviderContext,
  repo: Repository,
  reviewId: string,
): Promise<void> {
  const resolved = await resolveGithubApi(ctx, repo);
  if (!resolved?.api || !resolved.coords) {
    throw new Error("GitHub provider is not authenticated.");
  }
  const number = Number.parseInt(reviewId, 10);
  await resolved.api.reopenPullRequest(resolved.coords, number);
}

export async function deleteGithubMergedSourceBranch(
  ctx: ReviewProviderContext,
  repo: Repository,
  reviewId: string,
): Promise<{ branch: string }> {
  const resolved = await resolveGithubApi(ctx, repo);
  if (!resolved?.api || !resolved.coords) {
    throw new Error("GitHub provider is not authenticated.");
  }
  const number = Number.parseInt(reviewId, 10);
  const pr = await resolved.api.getPullRequestRaw(resolved.coords, number);
  const capabilities = resolved.api.getPullRequestCapabilities(pr);
  if (!capabilities.canDeleteSourceBranch) {
    throw new Error(
      capabilities.deleteSourceBranchBlockedReason ??
        "Source branch cannot be deleted for this pull request.",
    );
  }
  const branch = pr.head?.ref?.trim();
  if (!branch) {
    throw new Error("Pull request has no source branch to delete.");
  }
  await resolved.api.deletePullRequestHeadBranch(resolved.coords, branch);
  return { branch };
}

export async function checkoutGithubReviewBranch(
  ctx: ReviewProviderContext,
  repo: Repository,
  reviewId: string,
): Promise<{ branch: string }> {
  const resolved = await resolveGithubApi(ctx, repo);
  if (!resolved?.api || !resolved.coords) {
    throw new Error("GitHub provider is not authenticated.");
  }
  const number = Number.parseInt(reviewId, 10);
  const pr = await resolved.api.getPullRequestRaw(resolved.coords, number);
  const capabilities = resolved.api.getPullRequestCapabilities(pr);
  if (!capabilities.canCheckoutBranch) {
    throw new Error(
      capabilities.checkoutBranchBlockedReason ??
        "This pull request cannot be checked out.",
    );
  }
  const localBranch = `review/pr-${number}`;
  await ctx.execGit(repo.rootPath, [
    "fetch",
    "origin",
    `refs/pull/${number}/head:${localBranch}`,
  ]);
  await ctx.execGit(repo.rootPath, ["switch", localBranch]);
  return { branch: localBranch };
}
