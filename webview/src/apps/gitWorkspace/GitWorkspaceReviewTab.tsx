import type { GitWorkspaceController } from "./gitWorkspaceControllerTypes";
import { WorkspaceReviewPanel } from "../../components/git/WorkspaceReviewPanel";

export function GitWorkspaceReviewTab({ ctx }: { ctx: GitWorkspaceController }) {
  if (ctx.workspaceTab !== "review") {
    return null;
  }
  const {
    clientRef,
    syncing,
    reviewSelectedCommitSha,
    setReviewSelectedCommitSha,
    openDialog,

    reviewSnapshot,
    reviewDetails,
    reviewLoading,
    reviewError,
    reviewFilters,
    selectedReviewId,
    setReviewLoading,
    setReviewError,
    setReviewFilters,
    setSelectedReviewId,
    activeRepo,
    runMutation,
    refresh,
    loadReviews,
  } = ctx;

  return (
    <WorkspaceReviewPanel
          snapshot={reviewSnapshot}
          details={reviewDetails}
          loading={reviewLoading}
          error={reviewError}
          filters={reviewFilters}
          selectedReviewId={selectedReviewId}
          busy={syncing}
          onRefresh={() => void loadReviews()}
          onFiltersChange={(filters) => {
            setReviewFilters(filters);
            if (activeRepo) {
              setReviewLoading(true);
              void clientRef.current
                .listReviews(activeRepo.id, {
                  providerId: reviewSnapshot?.selectedProviderId ?? undefined,
                  filters,
                })
                .catch((err: unknown) => {
                  setReviewError(
                    err instanceof Error ? err.message : "Failed to load reviews",
                  );
                });
            }
          }}
          onSelectReview={(reviewId) => {
            setSelectedReviewId(reviewId);
            setReviewSelectedCommitSha(null);
            if (activeRepo && reviewSnapshot?.selectedProviderId) {
              void runMutation(() =>
                clientRef.current.openReview(
                  activeRepo.id,
                  reviewSnapshot.selectedProviderId!,
                  reviewId,
                ),
              );
            }
          }}
          selectedCommitSha={reviewSelectedCommitSha}
          onCommitFilterChange={setReviewSelectedCommitSha}
          onApprove={() =>
            activeRepo &&
            reviewSnapshot?.selectedProviderId &&
            selectedReviewId &&
            void runMutation(() =>
              clientRef.current.submitReview(
                activeRepo.id,
                reviewSnapshot.selectedProviderId!,
                selectedReviewId,
                "APPROVE",
              ),
            )
          }
          onRequestChanges={() =>
            activeRepo &&
            reviewSnapshot?.selectedProviderId &&
            selectedReviewId &&
            void runMutation(() =>
              clientRef.current.submitReview(
                activeRepo.id,
                reviewSnapshot.selectedProviderId!,
                selectedReviewId,
                "REQUEST_CHANGES",
              ),
            )
          }
          onApplySuggestion={(suggestionId) =>
            activeRepo &&
            reviewSnapshot?.selectedProviderId &&
            selectedReviewId &&
            void runMutation(async () => {
              await clientRef.current.applyReviewSuggestion(
                activeRepo.id,
                reviewSnapshot.selectedProviderId!,
                selectedReviewId,
                suggestionId,
              );
              await refresh();
            })
          }
          onMerge={(method) =>
            activeRepo &&
            reviewSnapshot?.selectedProviderId &&
            selectedReviewId &&
            void runMutation(() =>
              clientRef.current.mergeReview(
                activeRepo.id,
                reviewSnapshot.selectedProviderId!,
                selectedReviewId,
                method,
              ),
            )
          }
          onCheckoutBranch={() =>
            activeRepo &&
            reviewSnapshot?.selectedProviderId &&
            selectedReviewId &&
            void runMutation(async () => {
              await clientRef.current.checkoutReviewBranch(
                activeRepo.id,
                reviewSnapshot.selectedProviderId!,
                selectedReviewId,
              );
              await refresh();
            })
          }
          onClose={() =>
            activeRepo &&
            reviewSnapshot?.selectedProviderId &&
            selectedReviewId &&
            void runMutation(() =>
              clientRef.current.closeReview(
                activeRepo.id,
                reviewSnapshot.selectedProviderId!,
                selectedReviewId,
              ),
            )
          }
          onReopen={() =>
            activeRepo &&
            reviewSnapshot?.selectedProviderId &&
            selectedReviewId &&
            void runMutation(() =>
              clientRef.current.reopenReview(
                activeRepo.id,
                reviewSnapshot.selectedProviderId!,
                selectedReviewId,
              ),
            )
          }
          onDeleteSourceBranch={() =>
            reviewDetails?.review.sourceBranch &&
            openDialog("deleteReviewSourceBranch", {
              branchName: reviewDetails.review.sourceBranch,
            })
          }
          canCreateReview={
            Boolean(
              reviewSnapshot?.selectedProviderId &&
                !reviewSnapshot.authRequired &&
                reviewSnapshot.providers.find(
                  (provider: { id: string }) =>
                    provider.id === reviewSnapshot.selectedProviderId,
                )?.available,
            )
          }
          createReviewDefaults={{
            sourceBranch: activeRepo?.currentBranch ?? undefined,
            targetBranch:
              activeRepo?.upstream?.split("/").slice(1).join("/") ?? "main",
          }}
          onCreateReview={(opts) =>
            activeRepo &&
            reviewSnapshot?.selectedProviderId &&
            void runMutation(async () => {
              const item = await clientRef.current.createReview(
                activeRepo.id,
                reviewSnapshot.selectedProviderId!,
                opts,
              );
              setSelectedReviewId(item.id);
              await clientRef.current.openReview(
                activeRepo.id,
                reviewSnapshot.selectedProviderId!,
                item.id,
              );
              await loadReviews();
            })
          }
          onCreateLineComment={(opts) =>
            activeRepo &&
            reviewSnapshot?.selectedProviderId &&
            selectedReviewId &&
            void runMutation(() =>
              clientRef.current.createReviewLineComment(
                activeRepo.id,
                reviewSnapshot.selectedProviderId!,
                selectedReviewId,
                opts,
              ),
            )
          }
          onProviderChange={(providerId) => {
            if (!activeRepo) {
              return;
            }
            setReviewLoading(true);
            void clientRef.current
              .listReviews(activeRepo.id, { providerId, filters: reviewFilters })
              .catch((err: unknown) => {
                setReviewError(
                  err instanceof Error ? err.message : "Failed to load reviews",
                );
              });
          }}
        />
  );
}
