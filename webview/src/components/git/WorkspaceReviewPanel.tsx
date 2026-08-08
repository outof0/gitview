import { useState } from "react";
import { WorkspaceReviewCreateForm } from "./workspaceReviewPanel/WorkspaceReviewCreateForm";
import { WorkspaceReviewDetails } from "./workspaceReviewPanel/WorkspaceReviewDetails";
import { WorkspaceReviewList } from "./workspaceReviewPanel/WorkspaceReviewList";
import { WorkspaceReviewToolbar } from "./workspaceReviewPanel/WorkspaceReviewToolbar";
import type { WorkspaceReviewPanelProps } from "./workspaceReviewPanel/workspaceReviewPanelTypes";

export function WorkspaceReviewPanel({
  snapshot,
  details,
  loading,
  error,
  filters,
  selectedReviewId,
  busy = false,
  onRefresh,
  onFiltersChange,
  onSelectReview,
  onProviderChange,
  selectedCommitSha = null,
  onCommitFilterChange,
  onApprove,
  onRequestChanges,
  onMerge,
  onApplySuggestion,
  onClose,
  onReopen,
  onDeleteSourceBranch,
  onCheckoutBranch,
  canCreateReview = false,
  createReviewDefaults,
  onCreateReview,
  onCreateLineComment,
}: WorkspaceReviewPanelProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);

  return (
    <div className="flex-1 min-h-0 flex flex-col" data-testid="workspace-review-panel">
      <WorkspaceReviewToolbar
        snapshot={snapshot}
        filters={filters}
        busy={busy}
        canCreateReview={canCreateReview}
        onRefresh={onRefresh}
        onFiltersChange={onFiltersChange}
        onProviderChange={onProviderChange}
        onCreateReview={
          onCreateReview
            ? () => setShowCreateForm((open) => !open)
            : undefined
        }
      />

      {showCreateForm && onCreateReview && (
        <WorkspaceReviewCreateForm
          busy={busy}
          createReviewDefaults={createReviewDefaults}
          onCreateReview={onCreateReview}
          onClose={() => setShowCreateForm(false)}
        />
      )}

      {loading && (
        <div className="px-3 py-2 text-[12px] text-[var(--vscode-descriptionForeground)]">
          Loading reviews…
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="px-3 py-2 text-[12px] text-[var(--vscode-errorForeground)]"
          data-testid="review-error"
        >
          {error}
        </div>
      )}
      {snapshot?.authRequired && (
        <div
          role="alert"
          className="px-3 py-2 text-[12px] text-[var(--vscode-inputValidation-warningForeground)]"
          data-testid="review-auth-required"
        >
          Connect a provider token to load pull requests and merge requests.
        </div>
      )}
      {snapshot?.unavailableReason && !snapshot.authRequired && (
        <div
          role="status"
          className="px-3 py-2 text-[12px] text-[var(--vscode-descriptionForeground)]"
          data-testid="review-unavailable"
        >
          {snapshot.unavailableReason}
        </div>
      )}

      <div className="flex-1 min-h-0 flex">
        <WorkspaceReviewList
          snapshot={snapshot}
          loading={loading}
          selectedReviewId={selectedReviewId}
          onSelectReview={onSelectReview}
        />
        <WorkspaceReviewDetails
          details={details}
          busy={busy}
          selectedCommitSha={selectedCommitSha}
          onCommitFilterChange={onCommitFilterChange}
          onApprove={onApprove}
          onRequestChanges={onRequestChanges}
          onMerge={onMerge}
          onApplySuggestion={onApplySuggestion}
          onClose={onClose}
          onReopen={onReopen}
          onDeleteSourceBranch={onDeleteSourceBranch}
          onCheckoutBranch={onCheckoutBranch}
          onCreateLineComment={onCreateLineComment}
        />
      </div>
    </div>
  );
}