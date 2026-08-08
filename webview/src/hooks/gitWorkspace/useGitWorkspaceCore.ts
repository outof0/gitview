import { useCallback, useMemo, useRef, useState } from "react";
import type { GitWorkspaceCoreApi } from "../../apps/gitWorkspace/gitWorkspaceControllerTypes";
import { createProtocolClient } from "../../protocol/client";
import { useGitWorkspaceStore } from "../../stores/gitWorkspaceStore";
import { useVsCodeApi } from "../useVsCodeApi";
import type { useGitWorkspaceStoreSlice } from "./useGitWorkspaceStoreSlice";

type StoreSlice = ReturnType<typeof useGitWorkspaceStoreSlice>;

export function useGitWorkspaceCore(store: StoreSlice): GitWorkspaceCoreApi {
  const { postMessage } = useVsCodeApi();
  const clientRef = useRef(createProtocolClient(postMessage));
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [reviewSelectedCommitSha, setReviewSelectedCommitSha] = useState<string | null>(null);
  const { repoSnapshot } = store;

  const activeRepo = useMemo(() => {
    if (!repoSnapshot?.activeRepoId) {
      return null;
    }
    return repoSnapshot.repositories.find((repo) => repo.id === repoSnapshot.activeRepoId) ?? null;
  }, [repoSnapshot]);

  const runMutation = useCallback(async (fn: () => Promise<unknown>) => {
    if (!activeRepo) {
      return;
    }
    setSyncing(true);
    useGitWorkspaceStore.getState().setError(null);
    try {
      await fn();
    } catch (err) {
      useGitWorkspaceStore.getState().setError(err instanceof Error ? err.message : "Git operation failed");
    } finally {
      setSyncing(false);
    }
  }, [activeRepo]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await clientRef.current.refreshRepos(activeRepo?.id);
    } catch (err) {
      useGitWorkspaceStore.getState().setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }, [activeRepo?.id]);

  return {
    postMessage,
    clientRef,
    refreshing,
    syncing,
    setSyncing,
    reviewSelectedCommitSha,
    setReviewSelectedCommitSha,
    activeRepo,
    runMutation,
    refresh,
  };
}