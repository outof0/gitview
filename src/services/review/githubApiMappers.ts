import type {
  ReviewComment,
  ReviewItem,
  ReviewItemState,
  ReviewSuggestion,
  ReviewTimelineEntry,
} from "../../shared/types/review";
import { parseSuggestionFromBody } from "./suggestionParse";
import type {
  GithubIssueComment,
  GithubPullRequest,
  GithubPullReviewComment,
  GithubReview,
} from "./githubApiTypes";

export function mapGithubState(pr: GithubPullRequest): ReviewItemState {
  if (pr.merged_at || pr.merged) {
    return "merged";
  }
  if (pr.draft) {
    return "draft";
  }
  return pr.state;
}

export function pullRequestCapabilities(pr: GithubPullRequest) {
  const merged = Boolean(pr.merged_at || pr.merged);
  const open = pr.state === "open";
  const headRepo = pr.head?.repo?.full_name;
  const baseRepo = pr.base?.repo?.full_name;
  const sameRepo = Boolean(
    headRepo && baseRepo && headRepo.toLowerCase() === baseRepo.toLowerCase(),
  );
  const sourceBranch = pr.head?.ref ?? "";

  return {
    canClose: open && !merged,
    canReopen: pr.state === "closed" && !merged,
    canDeleteSourceBranch: merged && sameRepo && Boolean(sourceBranch),
    deleteSourceBranchBlockedReason:
      merged && !sameRepo
        ? "Source branch is on a fork and cannot be deleted from this repository."
        : undefined,
    canCheckoutBranch: !merged,
    checkoutBranchBlockedReason: merged
      ? "Pull request is already merged."
      : undefined,
  };
}

export function mapGithubItem(
  pr: GithubPullRequest,
  meta: {
    labels?: string[];
    assignees?: string[];
    milestone?: string;
  } = {},
): ReviewItem {
  return {
    id: String(pr.number),
    number: pr.number,
    title: pr.title,
    state: mapGithubState(pr),
    author: pr.user?.login ?? "unknown",
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    sourceBranch: pr.head?.ref ?? "",
    targetBranch: pr.base?.ref ?? "",
    url: pr.html_url,
    draft: pr.draft,
    labels: meta.labels ?? [],
    assignees: meta.assignees ?? [],
    milestone: meta.milestone,
  };
}

export function buildGithubTimeline(
  issueComments: GithubIssueComment[],
  reviews: GithubReview[],
): { timeline: ReviewTimelineEntry[]; comments: ReviewComment[] } {
  const timeline: ReviewTimelineEntry[] = [
    ...issueComments.map((comment) => ({
      id: `issue-comment-${comment.id}`,
      kind: "comment" as const,
      author: comment.user?.login ?? "unknown",
      body: comment.body ?? "",
      createdAt: comment.created_at,
    })),
    ...reviews.map((review) => ({
      id: `review-${review.id}`,
      kind: "review" as const,
      author: review.user?.login ?? "unknown",
      body: review.body ?? review.state,
      createdAt: review.submitted_at ?? new Date(0).toISOString(),
    })),
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const comments: ReviewComment[] = issueComments.map((comment) => ({
    id: String(comment.id),
    author: comment.user?.login ?? "unknown",
    body: comment.body ?? "",
    createdAt: comment.created_at,
  }));

  return { timeline, comments };
}

export function buildGithubReviewComments(
  reviewComments: GithubPullReviewComment[],
): { comments: ReviewComment[]; suggestions: ReviewSuggestion[] } {
  const comments: ReviewComment[] = [];
  const suggestions: ReviewSuggestion[] = [];

  for (const comment of reviewComments) {
    const body = comment.body ?? "";
    const suggestionText = parseSuggestionFromBody(body);
    const line = comment.line ?? comment.original_line ?? null;
    comments.push({
      id: String(comment.id),
      author: comment.user?.login ?? "unknown",
      body,
      path: comment.path,
      line: line ?? undefined,
      createdAt: comment.created_at,
      hasSuggestion: suggestionText !== null,
    });
    if (suggestionText && comment.path && line) {
      suggestions.push({
        id: `suggestion-${comment.id}`,
        commentId: String(comment.id),
        author: comment.user?.login ?? "unknown",
        path: comment.path,
        line,
        startLine: comment.start_line ?? undefined,
        body,
        suggestionText,
        createdAt: comment.created_at,
      });
    }
  }

  return { comments, suggestions };
}
