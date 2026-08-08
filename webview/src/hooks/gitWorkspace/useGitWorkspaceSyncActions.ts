import { useCallback } from "react";
import { useGitWorkspaceStore } from "../../stores/gitWorkspaceStore";
import type { GitWorkspaceSyncApi } from "../../apps/gitWorkspace/gitWorkspaceControllerTypes";
import type { GitWorkspaceDeps } from "./gitWorkspaceDeps";

export function useGitWorkspaceSyncActions(deps: GitWorkspaceDeps): GitWorkspaceSyncApi {
  const { clientRef, activeRepo, runMutation, setSyncing } = deps.core;
  const {
    repoSnapshot,
    synchronousBranchControl,
    pullStrategy,
    dialogs,
    reviewSnapshot,
    reviewFilters,
    setWorkspaceNotification,
    setBranchesOpen,
    openDialog,
    closeDialog,
    setReviewLoading,
    setReviewError,
  } = deps.store;

  const handlePush = useCallback(async () => {
    if (!activeRepo) {
      return;
    }
    setSyncing(true);
    useGitWorkspaceStore.getState().setError(null);
    try {
      const result = await clientRef.current.push(activeRepo.id);
      if (result.upstreamRequired) {
        openDialog("pushUpstream", {
          branch: result.branch ?? activeRepo.currentBranch ?? "HEAD",
          remote: result.remote ?? "origin",
        });
      } else if (result.rejected) {
        setWorkspaceNotification({
          level: "warning",
          message: "Push was rejected by the remote.",
        });
      }
    } catch (err) {
      useGitWorkspaceStore.getState().setError(
        err instanceof Error ? err.message : "Push failed",
      );
    } finally {
      setSyncing(false);
    }
  }, [activeRepo, openDialog, setWorkspaceNotification]);

  const usesSyncBranchCheckout = useCallback(() => {
    return (
      (repoSnapshot?.repositories.length ?? 0) > 1 && synchronousBranchControl
    );
  }, [repoSnapshot?.repositories.length, synchronousBranchControl]);

  const handleBranchCheckout = useCallback(
    async (
      ref: string,
      opts?: { smart?: boolean; force?: boolean },
      confirmed = false,
    ) => {
      if (!activeRepo) {
        return;
      }
      if (usesSyncBranchCheckout()) {
        const result = await clientRef.current.syncBranchOperation(
          activeRepo.id,
          ref,
          { ...opts, confirmed },
        );
        if (result.confirmationRequired && result.targets) {
          openDialog("syncBranch", {
            ref: result.ref ?? ref,
            targets: result.targets,
            opts,
          });
          return;
        }
        const results = result.results ?? [];
        const succeeded = results.filter((result) => result.ok).length;
        const failed = results.filter(
          (result) => !result.ok && !result.error?.includes("not available"),
        ).length;
        if (failed > 0) {
          setWorkspaceNotification({
            level: "warning",
            message: `Branch checkout failed in ${failed} repositor${failed === 1 ? "y" : "ies"}.`,
          });
        } else if (succeeded > 0) {
          setWorkspaceNotification({
            level: "info",
            message: `Checked out ${ref} in ${succeeded} repositor${succeeded === 1 ? "y" : "ies"}.`,
          });
        }
        setBranchesOpen(false);
        return;
      }
      await clientRef.current.checkoutBranch(activeRepo.id, ref, opts);
      setBranchesOpen(false);
    },
    [
      activeRepo,
      setBranchesOpen,
      openDialog,
      setWorkspaceNotification,
      usesSyncBranchCheckout,
    ],
  );

  const confirmPushUpstream = useCallback(async () => {
    const pending = dialogs.pushUpstream;
    if (!activeRepo || !pending) {
      return;
    }
    closeDialog("pushUpstream");
    setSyncing(true);
    try {
      await clientRef.current.push(activeRepo.id, {
        setUpstream: true,
        remote: pending.remote,
      });
    } catch (err) {
      useGitWorkspaceStore.getState().setError(
        err instanceof Error ? err.message : "Push failed",
      );
    } finally {
      setSyncing(false);
    }
  }, [activeRepo, dialogs.pushUpstream, closeDialog]);

  const handleUpdateAllRoots = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await clientRef.current.updateAllRoots(pullStrategy);
      openDialog("updateAllRootsReport", { results: result.results ?? [] });
    } catch (err) {
      useGitWorkspaceStore.getState().setError(
        err instanceof Error ? err.message : "Update all roots failed",
      );
    } finally {
      setSyncing(false);
    }
  }, [pullStrategy, openDialog]);

  const loadReviews = useCallback(async () => {
    if (!activeRepo) {
      return;
    }
    setReviewLoading(true);
    setReviewError(null);
    try {
      await clientRef.current.listReviews(activeRepo.id, {
        providerId: reviewSnapshot?.selectedProviderId ?? undefined,
        filters: reviewFilters,
      });
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Failed to load reviews");
    }
  }, [
    activeRepo,
    reviewFilters,
    reviewSnapshot?.selectedProviderId,
    setReviewError,
    setReviewLoading,
  ]);

  const handleApplyNonConflicting = useCallback(() => {
    if (!activeRepo) {
      return;
    }
    void runMutation(async () => {
      const result = await clientRef.current.applyNonConflicting(activeRepo.id);
      const applied = result.applied.length;
      const skipped = result.skipped.length;
      setWorkspaceNotification({
        level: "info",
        message: `Applied ${applied} non-conflicting file${applied === 1 ? "" : "s"}${skipped > 0 ? `, skipped ${skipped}` : ""}`,
      });
    });
  }, [activeRepo, runMutation, setWorkspaceNotification]);

  return {
    handlePush,
    usesSyncBranchCheckout,
    handleBranchCheckout,
    confirmPushUpstream,
    handleUpdateAllRoots,
    loadReviews,
    handleApplyNonConflicting,
  };
}
