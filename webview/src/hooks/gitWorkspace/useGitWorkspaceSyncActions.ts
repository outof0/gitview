import { useCallback, useEffect, useRef } from "react";
import {
  isConfirmationEvidence,
  type ConfirmationSubmission,
} from "@gitview/shared/types/confirmation";
import {
  isSyncOperationActive,
  type SyncOperationEvent,
  type SyncOperationKind,
} from "@gitview/shared/types/sync";
import { isErrorCode } from "../../lib/errorCode";
import { useGitWorkspaceStore } from "../../stores/gitWorkspaceStore";
import type { GitWorkspaceSyncOperation } from "../../stores/gitWorkspaceStoreTypes";
import type { GitWorkspaceDialogPayloads } from "../../stores/gitWorkspaceDialogs";
import type { GitWorkspaceSyncApi } from "../../apps/gitWorkspace/gitWorkspaceControllerTypes";
import { ProtocolRequestTimeoutError } from "../../protocol/clientCore";
import type { GitWorkspaceDeps } from "./gitWorkspaceDeps";

type RootUpdateResult =
  GitWorkspaceDialogPayloads["updateAllRootsReport"]["results"][number];

type TrackedSyncResult<T> = {
  response: T | null;
  operation: GitWorkspaceSyncOperation | null;
};

function terminalSyncError(event: SyncOperationEvent): string | undefined {
  if (event.state === "failed" || event.state === "cancel_confirmed") {
    return event.outcome.message;
  }
  return undefined;
}

function updateAllResults(event: SyncOperationEvent): RootUpdateResult[] {
  const progress = "progress" in event ? event.progress : undefined;
  return (progress?.roots ?? []).map((root) => {
    if (root.state === "succeeded") {
      return { repoId: root.repoId, name: root.name, ok: true };
    }
    if (
      root.state === "failed" ||
      root.state === "cancelled" ||
      root.state === "skipped"
    ) {
      return {
        repoId: root.repoId,
        name: root.name,
        ok: false,
        error: root.outcome.message,
      };
    }
    return {
      repoId: root.repoId,
      name: root.name,
      ok: false,
      error: root.state === "pending" ? "Not started" : "Still running",
    };
  });
}

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
    syncOperations = [],
  } = deps.store;
  const trackedUpdateAllIds = useRef(new Set<string>());
  const reportedUpdateAllIds = useRef(new Set<string>());
  const pendingUpstreamPushIds = useRef(new Set<string>());
  const pendingRootRetryIds = useRef(new Map<string, string>());

  const runTrackedSyncRequest = useCallback(
    async <T>(
      repoId: string,
      operation: SyncOperationKind,
      request: () => Promise<T>,
      failureMessage: string,
    ): Promise<TrackedSyncResult<T>> => {
      const knownOperationIds = new Set(
        useGitWorkspaceStore
          .getState()
          .syncOperations.map((record) => record.event.operationId),
      );
      setSyncing(true);
      useGitWorkspaceStore.getState().setError(null);
      try {
        const response = await request();
        const current = useGitWorkspaceStore
          .getState()
          .syncOperationForRepository(repoId, operation);
        return {
          response,
          operation:
            current && !knownOperationIds.has(current.event.operationId)
              ? current
              : null,
        };
      } catch (err) {
        const state = useGitWorkspaceStore.getState();
        const current = state.syncOperationForRepository(repoId, operation);
        const startedForRequest =
          current !== null &&
          !knownOperationIds.has(current.event.operationId);
        if (
          err instanceof ProtocolRequestTimeoutError &&
          startedForRequest &&
          isSyncOperationActive(current.event)
        ) {
          state.markSyncOperationOutcomeUnknown(current.event.operationId);
          return { response: null, operation: current };
        }
        if (startedForRequest && !isSyncOperationActive(current.event)) {
          return { response: null, operation: current };
        }
        state.setError(err instanceof Error ? err.message : failureMessage);
        return {
          response: null,
          operation: startedForRequest ? current : null,
        };
      } finally {
        setSyncing(false);
      }
    },
    [setSyncing],
  );

  const showUpdateAllReport = useCallback(
    (event: SyncOperationEvent) => {
      if (
        event.operation !== "update_all_roots" ||
        event.state !== "completed" ||
        reportedUpdateAllIds.current.has(event.operationId)
      ) {
        return;
      }
      const results = updateAllResults(event);
      if (results.length === 0) {
        return;
      }
      reportedUpdateAllIds.current.add(event.operationId);
      openDialog("updateAllRootsReport", { results });
    },
    [openDialog],
  );

  const updateRootReport = useCallback(
    (repoId: string, event: SyncOperationEvent | null) => {
      const state = useGitWorkspaceStore.getState();
      const report = state.dialogs.updateAllRootsReport;
      if (!report) {
        return;
      }
      const error = event ? terminalSyncError(event) : undefined;
      state.openDialog("updateAllRootsReport", {
        results: report.results.map((result) =>
          result.repoId === repoId
            ? {
                ...result,
                ok: error === undefined,
                error,
              }
            : result,
        ),
      });
    },
    [],
  );

  useEffect(() => {
    for (const operation of syncOperations) {
      const event = operation.event;
      if (event.operation === "update_all_roots") {
        if (isSyncOperationActive(event)) {
          trackedUpdateAllIds.current.add(event.operationId);
        } else if (trackedUpdateAllIds.current.delete(event.operationId)) {
          showUpdateAllReport(event);
        }
      }
      if (
        pendingUpstreamPushIds.current.has(event.operationId) &&
        !isSyncOperationActive(event)
      ) {
        pendingUpstreamPushIds.current.delete(event.operationId);
        if (event.state === "completed") {
          closeDialog("pushUpstream");
        }
      }
      const retryRepoId = pendingRootRetryIds.current.get(event.operationId);
      if (retryRepoId && !isSyncOperationActive(event)) {
        pendingRootRetryIds.current.delete(event.operationId);
        updateRootReport(retryRepoId, event);
      }
    }
  }, [
    closeDialog,
    showUpdateAllReport,
    syncOperations,
    updateRootReport,
  ]);

  const handleFetch = useCallback(async () => {
    if (!activeRepo) {
      return;
    }
    await runTrackedSyncRequest(
      activeRepo.id,
      "fetch",
      () => clientRef.current.fetch(activeRepo.id),
      "Fetch failed",
    );
  }, [activeRepo, clientRef, runTrackedSyncRequest]);

  const handlePull = useCallback(
    async (strategy: "merge" | "rebase" | "ff_only") => {
      if (!activeRepo) {
        return;
      }
      await runTrackedSyncRequest(
        activeRepo.id,
        "pull",
        () => clientRef.current.pull(activeRepo.id, strategy),
        "Pull failed",
      );
    },
    [activeRepo, clientRef, runTrackedSyncRequest],
  );

  const handleCancelSync = useCallback(
    async (operationId: string) => {
      try {
        const result = await clientRef.current.cancelSync(operationId);
        if (!result.accepted) {
          setWorkspaceNotification({
            level: "warning",
            message: result.message,
          });
        }
      } catch (err) {
        useGitWorkspaceStore.getState().setError(
          err instanceof Error ? err.message : "Cancellation failed",
        );
      }
    },
    [clientRef, setWorkspaceNotification],
  );

  const handlePush = useCallback(async () => {
    if (!activeRepo) {
      return;
    }
    const execution = await runTrackedSyncRequest(
      activeRepo.id,
      "push",
      () => clientRef.current.push(activeRepo.id),
      "Push failed",
    );
    const result = execution.response;
    if (result?.upstreamRequired) {
      openDialog("pushUpstream", {
        branch: result.branch ?? activeRepo.currentBranch ?? "HEAD",
        remote: result.remote ?? "origin",
      });
    } else if (result?.rejected && !execution.operation) {
      setWorkspaceNotification({
        level: "warning",
        message: result.message ?? "Push was rejected by the remote.",
      });
    }
  }, [
    activeRepo,
    clientRef,
    openDialog,
    runTrackedSyncRequest,
    setWorkspaceNotification,
  ]);

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
      confirmation?: ConfirmationSubmission,
    ) => {
      if (!activeRepo) {
        return;
      }
      try {
        if (usesSyncBranchCheckout()) {
          const result = await clientRef.current.syncBranchOperation(
            activeRepo.id,
            ref,
            { ...opts, confirmed, confirmation },
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
          closeDialog("syncBranch");
          closeDialog("forceCheckout");
          setBranchesOpen(false);
          return;
        }
        await clientRef.current.checkoutBranch(activeRepo.id, ref, {
          ...opts,
          confirmation,
        });
        closeDialog("forceCheckout");
        setBranchesOpen(false);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Branch checkout failed";
        const details = (err as { details?: { confirmation?: unknown } }).details;
        const nextConfirmation = isConfirmationEvidence(details?.confirmation)
          ? details.confirmation
          : undefined;
        if (
          (nextConfirmation?.action === "force_checkout" ||
            nextConfirmation?.action === "force_checkout_multi") &&
          (isErrorCode(err, "CONFIRMATION_REQUIRED") ||
            isErrorCode(err, "CONFIRMATION_STALE"))
        ) {
          openDialog("forceCheckout", {
            ref,
            opts: { ...opts, force: true },
            confirmation: nextConfirmation,
          });
          if (isErrorCode(err, "CONFIRMATION_STALE")) {
            useGitWorkspaceStore.getState().setError(message);
          }
          return;
        }
        throw err;
      }
    },
    [
      activeRepo,
      closeDialog,
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
    const execution = await runTrackedSyncRequest(
      activeRepo.id,
      "push",
      () =>
        clientRef.current.push(activeRepo.id, {
          setUpstream: true,
          remote: pending.remote,
        }),
      "Push failed",
    );
    const event = execution.operation?.event;
    if (execution.response?.ok || event?.state === "completed") {
      closeDialog("pushUpstream");
    } else if (event && isSyncOperationActive(event)) {
      pendingUpstreamPushIds.current.add(event.operationId);
    }
  }, [
    activeRepo,
    clientRef,
    closeDialog,
    dialogs.pushUpstream,
    runTrackedSyncRequest,
  ]);

  const handleUpdateAllRoots = useCallback(async () => {
    if (!activeRepo) {
      return;
    }
    const execution = await runTrackedSyncRequest(
      activeRepo.id,
      "update_all_roots",
      () => clientRef.current.updateAllRoots(pullStrategy),
      "Update all roots failed",
    );
    const event = execution.operation?.event;
    if (event) {
      if (isSyncOperationActive(event)) {
        trackedUpdateAllIds.current.add(event.operationId);
      } else {
        showUpdateAllReport(event);
      }
      return;
    }
    if (execution.response) {
      openDialog("updateAllRootsReport", {
        results: execution.response.results ?? [],
      });
    }
  }, [
    activeRepo,
    clientRef,
    openDialog,
    pullStrategy,
    runTrackedSyncRequest,
    showUpdateAllReport,
  ]);

  const handleRetrySyncRoot = useCallback(
    async (repoId: string) => {
      const execution = await runTrackedSyncRequest(
        repoId,
        "pull",
        () => clientRef.current.pull(repoId, pullStrategy),
        "Root update failed",
      );
      const event = execution.operation?.event;
      if (event) {
        if (isSyncOperationActive(event)) {
          pendingRootRetryIds.current.set(event.operationId, repoId);
        } else {
          updateRootReport(repoId, event);
        }
      } else if (execution.response?.ok) {
        updateRootReport(repoId, null);
      }
    },
    [clientRef, pullStrategy, runTrackedSyncRequest, updateRootReport],
  );

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
    handleFetch,
    handlePull,
    handleCancelSync,
    handlePush,
    usesSyncBranchCheckout,
    handleBranchCheckout,
    confirmPushUpstream,
    handleUpdateAllRoots,
    handleRetrySyncRoot,
    loadReviews,
    handleApplyNonConflicting,
  };
}
