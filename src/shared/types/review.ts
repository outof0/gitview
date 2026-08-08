export type ReviewProviderId = "github" | "gitlab" | string;

export type ReviewItemState = "open" | "closed" | "merged" | "draft";

export type ReviewFilters = {
  state?: "open" | "closed" | "all";
  author?: string;
  label?: string;
  assignee?: string;
  milestone?: string;
  sort?: "updated" | "created";
  search?: string;
};

export type ReviewProviderInfo = {
  id: ReviewProviderId;
  displayName: string;
  available: boolean;
  authRequired: boolean;
  unavailableReason?: string;
};

export type ReviewItem = {
  id: string;
  number: number;
  title: string;
  state: ReviewItemState;
  author: string;
  createdAt: string;
  updatedAt: string;
  sourceBranch: string;
  targetBranch: string;
  url?: string;
  draft?: boolean;
  labels?: string[];
  assignees?: string[];
  milestone?: string;
};

export type ReviewTimelineEntry = {
  id: string;
  kind: "comment" | "review" | "commit" | "event";
  author: string;
  body: string;
  createdAt: string;
};

export type ReviewFile = {
  id: string;
  path: string;
  status: string;
  additions: number;
  deletions: number;
};

export type ReviewSuggestion = {
  id: string;
  commentId: string;
  author: string;
  path: string;
  line: number;
  startLine?: number;
  body: string;
  suggestionText: string;
  createdAt: string;
};

export type ReviewComment = {
  id: string;
  author: string;
  body: string;
  path?: string;
  line?: number;
  createdAt: string;
  pending?: boolean;
  hasSuggestion?: boolean;
};

export type ReviewListSnapshot = {
  repoId: string;
  providers: ReviewProviderInfo[];
  selectedProviderId: string | null;
  items: ReviewItem[];
  authRequired: boolean;
  unavailableReason?: string;
  filters: ReviewFilters;
  refreshedAt: number;
};

export type ReviewCommit = {
  sha: string;
  message: string;
  author: string;
  createdAt: string;
};

export type ReviewDetailsSnapshot = {
  repoId: string;
  providerId: ReviewProviderId;
  review: ReviewItem;
  timeline: ReviewTimelineEntry[];
  files: ReviewFile[];
  comments: ReviewComment[];
  suggestions: ReviewSuggestion[];
  commits: ReviewCommit[];
  canApprove: boolean;
  canRequestChanges: boolean;
  canMerge: boolean;
  canClose: boolean;
  canReopen: boolean;
  canDeleteSourceBranch: boolean;
  canCheckoutBranch: boolean;
  mergeBlockedReason?: string;
  deleteSourceBranchBlockedReason?: string;
  checkoutBranchBlockedReason?: string;
  /** Provider-supported merge strategies for the Merge actions row. */
  mergeMethods?: Array<"merge" | "squash" | "rebase">;
  /** Head commit SHA for inline review comments. */
  headCommitSha?: string;
  canCreateLineComment?: boolean;
  refreshedAt: number;
};

export function filterReviewItems(
  items: ReviewItem[],
  filters: ReviewFilters,
): ReviewItem[] {
  let result = [...items];
  if (filters.state && filters.state !== "all") {
    result = result.filter((item) => {
      if (filters.state === "open") {
        return item.state === "open" || item.state === "draft";
      }
      return item.state === "closed" || item.state === "merged";
    });
  }
  if (filters.author?.trim()) {
    const author = filters.author.trim().toLowerCase();
    result = result.filter((item) =>
      item.author.toLowerCase().includes(author),
    );
  }
  if (filters.label?.trim()) {
    const label = filters.label.trim().toLowerCase();
    result = result.filter((item) =>
      (item.labels ?? []).some((entry) => entry.toLowerCase().includes(label)),
    );
  }
  if (filters.assignee?.trim()) {
    const assignee = filters.assignee.trim().toLowerCase();
    result = result.filter((item) =>
      (item.assignees ?? []).some((entry) =>
        entry.toLowerCase().includes(assignee),
      ),
    );
  }
  if (filters.milestone?.trim()) {
    const milestone = filters.milestone.trim().toLowerCase();
    result = result.filter((item) =>
      (item.milestone ?? "").toLowerCase().includes(milestone),
    );
  }
  if (filters.search?.trim()) {
    const query = filters.search.trim().toLowerCase();
    result = result.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        String(item.number).includes(query) ||
        item.sourceBranch.toLowerCase().includes(query) ||
        (item.labels ?? []).some((entry) => entry.toLowerCase().includes(query)) ||
        (item.assignees ?? []).some((entry) =>
          entry.toLowerCase().includes(query),
        ) ||
        (item.milestone ?? "").toLowerCase().includes(query),
    );
  }
  const sort = filters.sort ?? "updated";
  result.sort((a, b) => {
    const left = sort === "created" ? a.createdAt : a.updatedAt;
    const right = sort === "created" ? b.createdAt : b.updatedAt;
    return right.localeCompare(left);
  });
  return result;
}