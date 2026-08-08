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
import { createGitlabApi } from "./gitlabApi";
import {
  gitlabApiBaseUrl,
  parseGitlabRemoteUrl,
} from "./gitlabRemote";
import { detectHostedRemote, readOriginRemoteUrl } from "./remoteDetect";
import type { ReviewFetch } from "./reviewFetch";

export type GitlabProviderContext = {
  execGit: GitExecFn;
  getAccessToken?: (providerId: string) => Promise<string | null>;
  getGitlabApiBaseUrl?: () => string;
  fetchFn?: ReviewFetch;
};

async function resolveGitlabApi(ctx: GitlabProviderContext, repo: Repository) {
  const remoteUrl = await readOriginRemoteUrl(ctx.execGit, repo.rootPath);
  if (!remoteUrl || detectHostedRemote(remoteUrl) !== "gitlab") {
    return null;
  }
  const coords = parseGitlabRemoteUrl(remoteUrl);
  if (!coords) {
    return null;
  }
  const token = (await ctx.getAccessToken?.("gitlab")) ?? null;
  if (!token) {
    return { coords, api: null, token: null };
  }
  const api = createGitlabApi({
    token,
    apiBaseUrl: gitlabApiBaseUrl(coords.host, ctx.getGitlabApiBaseUrl?.()),
    fetchFn: ctx.fetchFn,
  });
  return { coords, api, token };
}

export async function describeGitlabProvider(
  ctx: GitlabProviderContext,
  repo: Repository,
): Promise<ReviewProviderInfo> {
  const resolved = await resolveGitlabApi(ctx, repo);
  if (!resolved) {
    return {
      id: "gitlab",
      displayName: "GitLab",
      available: false,
      authRequired: false,
      unavailableReason: "No GitLab remote configured for this repository.",
    };
  }
  if (!resolved.token || !resolved.api) {
    return {
      id: "gitlab",
      displayName: "GitLab",
      available: true,
      authRequired: true,
      unavailableReason:
        "Connect a GitLab token via Command Palette: GitView: Set GitLab Review Token…",
    };
  }
  return {
    id: "gitlab",
    displayName: "GitLab",
    available: true,
    authRequired: false,
  };
}

export async function listGitlabReviews(
  ctx: GitlabProviderContext,
  repo: Repository,
  filters: ReviewFilters,
): Promise<{ items: ReviewItem[]; authRequired: boolean; unavailableReason?: string }> {
  const info = await describeGitlabProvider(ctx, repo);
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
  const resolved = await resolveGitlabApi(ctx, repo);
  if (!resolved?.api || !resolved.coords) {
    return { items: [], authRequired: true };
  }
  const state = filters.state ?? "open";
  const items = await resolved.api.listMergeRequests(resolved.coords, state);
  return { items, authRequired: false };
}

export async function openGitlabReview(
  ctx: GitlabProviderContext,
  repo: Repository,
  reviewId: string,
): Promise<ReviewDetailsSnapshot | null> {
  const resolved = await resolveGitlabApi(ctx, repo);
  if (!resolved?.api || !resolved.coords) {
    return null;
  }
  const iid = Number.parseInt(reviewId, 10);
  if (!Number.isFinite(iid)) {
    return null;
  }
  const [mrRaw, files, activity, discussions, mergeability, commits] =
    await Promise.all([
      resolved.api.getMergeRequestRaw(resolved.coords, iid),
      resolved.api.getMergeRequestFiles(resolved.coords, iid),
      resolved.api.getMergeRequestTimeline(resolved.coords, iid),
      resolved.api.getMergeRequestDiscussions(resolved.coords, iid),
      resolved.api.getMergeability(resolved.coords, iid),
      resolved.api.getMergeRequestCommits(resolved.coords, iid),
    ]);
  const capabilities = resolved.api.getMergeRequestCapabilities(mrRaw);
  const reviewItem = {
    id: String(mrRaw.iid),
    number: mrRaw.iid,
    title: mrRaw.title,
    state:
      mrRaw.state === "merged" || mrRaw.merged_at
        ? ("merged" as const)
        : mrRaw.draft || mrRaw.work_in_progress
          ? ("draft" as const)
          : mrRaw.state === "opened"
            ? ("open" as const)
            : ("closed" as const),
    author: mrRaw.author?.username ?? "unknown",
    createdAt: mrRaw.created_at,
    updatedAt: mrRaw.updated_at,
    sourceBranch: mrRaw.source_branch ?? "",
    targetBranch: mrRaw.target_branch ?? "",
    url: mrRaw.web_url,
    draft: mrRaw.draft ?? mrRaw.work_in_progress,
  };
  return {
    repoId: repo.id,
    providerId: "gitlab",
    review: reviewItem,
    timeline: activity.timeline,
    files,
    comments: [...activity.comments, ...discussions.comments],
    suggestions: discussions.suggestions,
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
    headCommitSha: mrRaw.diff_refs?.head_sha ?? commits[0]?.sha,
    canCreateLineComment:
      reviewItem.state === "open" || reviewItem.state === "draft",
    refreshedAt: Date.now(),
  };
}

export async function createGitlabReview(
  ctx: GitlabProviderContext,
  repo: Repository,
  opts: {
    title: string;
    sourceBranch: string;
    targetBranch: string;
    body?: string;
  },
): Promise<ReviewItem> {
  const resolved = await resolveGitlabApi(ctx, repo);
  if (!resolved?.api || !resolved.coords) {
    throw new Error("GitLab provider is not authenticated.");
  }
  return resolved.api.createMergeRequest(resolved.coords, opts);
}

export async function createGitlabLineComment(
  ctx: GitlabProviderContext,
  repo: Repository,
  reviewId: string,
  opts: {
    path: string;
    line: number;
    body: string;
  },
): Promise<{ commentId: string }> {
  const resolved = await resolveGitlabApi(ctx, repo);
  if (!resolved?.api || !resolved.coords) {
    throw new Error("GitLab provider is not authenticated.");
  }
  const iid = Number.parseInt(reviewId, 10);
  const mr = await resolved.api.getMergeRequestRaw(resolved.coords, iid);
  const baseSha = mr.diff_refs?.base_sha;
  const startSha = mr.diff_refs?.start_sha;
  const headSha = mr.diff_refs?.head_sha;
  if (!baseSha || !startSha || !headSha) {
    throw new Error(
      "Merge request diff refs are unavailable for line comments.",
    );
  }
  return resolved.api.createMergeRequestLineComment(resolved.coords, iid, {
    ...opts,
    baseSha,
    startSha,
    headSha,
  });
}

export async function submitGitlabReview(
  ctx: GitlabProviderContext,
  repo: Repository,
  reviewId: string,
  event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
  body?: string,
): Promise<void> {
  const resolved = await resolveGitlabApi(ctx, repo);
  if (!resolved?.api || !resolved.coords) {
    throw new Error("GitLab provider is not authenticated.");
  }
  const iid = Number.parseInt(reviewId, 10);
  await resolved.api.submitReview(resolved.coords, iid, event, body);
}

export async function applyGitlabSuggestion(
  ctx: GitlabProviderContext,
  repo: Repository,
  reviewId: string,
  suggestionId: string,
  cachedSuggestions?: ReviewSuggestion[],
): Promise<{ path: string }> {
  const resolved = await resolveGitlabApi(ctx, repo);
  if (!resolved?.api || !resolved.coords) {
    throw new Error("GitLab provider is not authenticated.");
  }
  const iid = Number.parseInt(reviewId, 10);
  let suggestions = cachedSuggestions;
  if (!suggestions) {
    const fetched = await resolved.api.getMergeRequestDiscussions(
      resolved.coords,
      iid,
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

export async function mergeGitlabReview(
  ctx: GitlabProviderContext,
  repo: Repository,
  reviewId: string,
  method: "merge" | "squash" | "rebase" = "merge",
): Promise<void> {
  const resolved = await resolveGitlabApi(ctx, repo);
  if (!resolved?.api || !resolved.coords) {
    throw new Error("GitLab provider is not authenticated.");
  }
  const iid = Number.parseInt(reviewId, 10);
  await resolved.api.mergeMergeRequest(resolved.coords, iid, method);
}

export async function closeGitlabReview(
  ctx: GitlabProviderContext,
  repo: Repository,
  reviewId: string,
): Promise<void> {
  const resolved = await resolveGitlabApi(ctx, repo);
  if (!resolved?.api || !resolved.coords) {
    throw new Error("GitLab provider is not authenticated.");
  }
  const iid = Number.parseInt(reviewId, 10);
  await resolved.api.closeMergeRequest(resolved.coords, iid);
}

export async function reopenGitlabReview(
  ctx: GitlabProviderContext,
  repo: Repository,
  reviewId: string,
): Promise<void> {
  const resolved = await resolveGitlabApi(ctx, repo);
  if (!resolved?.api || !resolved.coords) {
    throw new Error("GitLab provider is not authenticated.");
  }
  const iid = Number.parseInt(reviewId, 10);
  await resolved.api.reopenMergeRequest(resolved.coords, iid);
}

export async function deleteGitlabMergedSourceBranch(
  ctx: GitlabProviderContext,
  repo: Repository,
  reviewId: string,
): Promise<{ branch: string }> {
  const resolved = await resolveGitlabApi(ctx, repo);
  if (!resolved?.api || !resolved.coords) {
    throw new Error("GitLab provider is not authenticated.");
  }
  const iid = Number.parseInt(reviewId, 10);
  const mr = await resolved.api.getMergeRequestRaw(resolved.coords, iid);
  const capabilities = resolved.api.getMergeRequestCapabilities(mr);
  if (!capabilities.canDeleteSourceBranch) {
    throw new Error(
      capabilities.deleteSourceBranchBlockedReason ??
        "Source branch cannot be deleted for this merge request.",
    );
  }
  const branch = mr.source_branch?.trim();
  if (!branch) {
    throw new Error("Merge request has no source branch to delete.");
  }
  await resolved.api.deleteSourceBranch(resolved.coords, branch);
  return { branch };
}

export async function checkoutGitlabReviewBranch(
  ctx: GitlabProviderContext,
  repo: Repository,
  reviewId: string,
): Promise<{ branch: string }> {
  const resolved = await resolveGitlabApi(ctx, repo);
  if (!resolved?.api || !resolved.coords) {
    throw new Error("GitLab provider is not authenticated.");
  }
  const iid = Number.parseInt(reviewId, 10);
  const mr = await resolved.api.getMergeRequestRaw(resolved.coords, iid);
  const capabilities = resolved.api.getMergeRequestCapabilities(mr);
  if (!capabilities.canCheckoutBranch) {
    throw new Error(
      capabilities.checkoutBranchBlockedReason ??
        "This merge request cannot be checked out.",
    );
  }
  const localBranch = `review/mr-${iid}`;
  await ctx.execGit(repo.rootPath, [
    "fetch",
    "origin",
    `refs/merge-requests/${iid}/head:${localBranch}`,
  ]);
  await ctx.execGit(repo.rootPath, ["switch", localBranch]);
  return { branch: localBranch };
}
