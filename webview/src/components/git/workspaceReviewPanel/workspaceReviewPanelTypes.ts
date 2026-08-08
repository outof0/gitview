import type {
  ReviewDetailsSnapshot,
  ReviewFilters,
  ReviewListSnapshot,
} from "@gitview/shared/types/review";

export type WorkspaceReviewPanelProps = {
  snapshot: ReviewListSnapshot | null;
  details: ReviewDetailsSnapshot | null;
  loading: boolean;
  error: string | null;
  filters: ReviewFilters;
  selectedReviewId: string | null;
  busy?: boolean;
  onRefresh: () => void;
  onFiltersChange: (filters: ReviewFilters) => void;
  onSelectReview: (reviewId: string) => void;
  onProviderChange: (providerId: string) => void;
  selectedCommitSha?: string | null;
  onCommitFilterChange?: (sha: string | null) => void;
  onApprove?: () => void;
  onRequestChanges?: () => void;
  onMerge?: (method?: "merge" | "squash" | "rebase") => void;
  onApplySuggestion?: (suggestionId: string) => void;
  onClose?: () => void;
  onReopen?: () => void;
  onDeleteSourceBranch?: () => void;
  onCheckoutBranch?: () => void;
  canCreateReview?: boolean;
  createReviewDefaults?: {
    sourceBranch?: string;
    targetBranch?: string;
  };
  onCreateReview?: (opts: {
    title: string;
    sourceBranch: string;
    targetBranch: string;
    body?: string;
    draft?: boolean;
  }) => void;
  onCreateLineComment?: (opts: {
    path: string;
    line: number;
    body: string;
    side?: "LEFT" | "RIGHT";
  }) => void;
};