import { useCallback, useMemo, useRef, useState } from "react";
import { isSyncOperationActive } from "@gitview/shared/types/sync";
import type { GitWorkspaceCoreApi } from "../../apps/gitWorkspace/gitWorkspaceControllerTypes";
import { createProtocolClient } from "../../protocol/client";
import { useGitWorkspaceStore } from "../../stores/gitWorkspaceStore";
import { captureRepoToken, isRepoTokenCurrent } from "./repoScope";
import { useVsCodeApi } from "../useVsCodeApi";
import type { useGitWorkspaceStoreSlice } from "./useGitWorkspaceStoreSlice";

type StoreSlice = ReturnType<typeof useGitWorkspaceStoreSlice>;

/**
 * Apply a +/-1 delta to a per-repository counter map.
 *
 * Counts, not booleans: two overlapping requests for one repository both
 * raise the flag, and the first completion must not clear it while the
 * second is still in flight.
 */
function adjustCount(
  update: (updater: (prev: Record<string, number>) => Record<string, number>) => void,
  repoId: string,
  delta: number,
): void {
  update((prev) => {
    const next = (prev[repoId] ?? 0) + delta;
    if (next <= 0) {
      if (!(repoId in prev)) {
        return prev;
      }
      const { [repoId]: _removed, ...rest } = prev;
      return rest;
    }
    return { ...prev, [repoId]: next };
  });
}

export function useGitWorkspaceCore(store: StoreSlice): GitWorkspaceCoreApi {
  const { postMessage } = useVsCodeApi();
  const clientRef = useRef(createProtocolClient(postMessage));
  // Refresh busy state keyed by repository: a single global boolean lets
  // a stale refresh for repo A clear (or hold) the spinner of repo B. Each
  // request only ever touches its own key, so completions cannot leak
  // across repositories. The value is a count, not a flag: two overlapping
  // refreshes for the *same* repository must both settle before the spinner
  // stops.
  const [refreshingByRepo, setRefreshingByRepo] = useState<Record<string, number>>({});
  // Pending mutations keyed by repository: a single global boolean lets a
  // mutation for repo A clear the busy state of a still-running mutation for
  // repo B when the first one settles.
  const [pendingByRepo, setPendingByRepo] = useState<Record<string, number>>({});
  const [reviewSelectedCommitSha, setReviewSelectedCommitSha] = useState<string | null>(null);
  const { repoSnapshot } = store;

  const activeRepo = useMemo(() => {
    if (!repoSnapshot?.activeRepoId) {
      return null;
    }
    return repoSnapshot.repositories.find((repo) => repo.id === repoSnapshot.activeRepoId) ?? null;
  }, [repoSnapshot]);
  const syncOperation = useMemo(
    () =>
      activeRepo ? store.syncOperationForRepository(activeRepo.id) : null,
    [activeRepo, store.syncOperationForRepository, store.syncOperations],
  );
  const syncing =
    (activeRepo ? (pendingByRepo[activeRepo.id] ?? 0) > 0 : false) ||
    Boolean(syncOperation && isSyncOperationActive(syncOperation.event));

  const adjustPending = useCallback((repoId: string, delta: number) => {
    adjustCount(setPendingByRepo, repoId, delta);
  }, []);

  const setSyncing = useCallback(
    (busy: boolean, repoId?: string) => {
      const target =
        repoId ??
        useGitWorkspaceStore.getState().repoSnapshot?.activeRepoId ??
        null;
      if (!target) {
        return;
      }
      adjustPending(target, busy ? 1 : -1);
    },
    [adjustPending],
  );

  const runMutation = useCallback(async (fn: () => Promise<unknown>) => {
    if (!activeRepo) {
      return;
    }
    const requestToken = captureRepoToken(activeRepo.id);
    adjustPending(requestToken.repoId, 1);
    useGitWorkspaceStore.getState().setError(null);
    try {
      await fn();
    } catch (err) {
      // A failure for a repository that is no longer active must not
      // overwrite the UI of the repository the user is looking at now.
      if (isRepoTokenCurrent(requestToken)) {
        useGitWorkspaceStore.getState().setError(err instanceof Error ? err.message : "Git operation failed");
      }
    } finally {
      adjustPending(requestToken.repoId, -1);
    }
  }, [activeRepo, adjustPending]);

  const setRepoRefreshing = useCallback((repoId: string | null, busy: boolean) => {
    if (!repoId) {
      return;
    }
    adjustCount(setRefreshingByRepo, repoId, busy ? 1 : -1);
  }, []);

  const refreshing = activeRepo ? (refreshingByRepo[activeRepo.id] ?? 0) > 0 : false;

  const refresh = useCallback(async () => {
    const requestToken = activeRepo ? captureRepoToken(activeRepo.id) : null;
    setRepoRefreshing(requestToken?.repoId ?? null, true);
    try {
      await clientRef.current.refreshRepos(activeRepo?.id);
    } catch (err) {
      // A refresh failure for a departed repository must not surface on the
      // repository the user switched to.
      if (!requestToken || isRepoTokenCurrent(requestToken)) {
        useGitWorkspaceStore.getState().setError(err instanceof Error ? err.message : "Refresh failed");
      }
    } finally {
      // Always clear our own key: it belongs to this request's repository,
      // so it can neither leak into nor get stuck on another repository.
      setRepoRefreshing(requestToken?.repoId ?? null, false);
    }
  }, [activeRepo, setRepoRefreshing]);

  return {
    postMessage,
    clientRef,
    refreshing,
    syncing,
    setSyncing,
    syncOperation,
    reviewSelectedCommitSha,
    setReviewSelectedCommitSha,
    activeRepo,
    runMutation,
    refresh,
  };
}