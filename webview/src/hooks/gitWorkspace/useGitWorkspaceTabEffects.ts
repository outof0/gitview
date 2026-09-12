import { useEffect, useRef } from "react";
import type { GitWorkspaceDeps } from "./gitWorkspaceDeps";
import type { useGitWorkspaceLoaders } from "./useGitWorkspaceLoaders";
import type { useGitWorkspaceSyncActions } from "./useGitWorkspaceSyncActions";
import type { useGitWorkspaceAuxActions } from "./useGitWorkspaceAuxActions";

export function useGitWorkspaceTabEffects(
  deps: GitWorkspaceDeps,
  loaders: ReturnType<typeof useGitWorkspaceLoaders>,
  sync: ReturnType<typeof useGitWorkspaceSyncActions>,
  aux: ReturnType<typeof useGitWorkspaceAuxActions>,
) {
  const { activeRepo } = deps.core;
  const {
    workspaceTab,
    logFilters,
    activeHistoryScope,
    stashSnapshot,
    shelfSnapshot,
    amend,
    reviewSnapshot,
    reviewLoading,
    setAmend,
  } = deps.store;
  const protectedBranch = activeRepo?.protectedBranch;

  const { loadLog } = loaders;
  // Repo snapshots replace `activeRepo` identity on every refresh, which used
  // to restart this effect and re-query (blanking the list). Keep the latest
  // loader in a ref and depend on stable values instead.
  const loadLogRef = useRef(loadLog);
  loadLogRef.current = loadLog;
  const filtersKey = JSON.stringify(logFilters);
  const { loadReviews } = sync;
  const { loadStashes, loadShelves } = aux;
  const repoId = activeRepo?.id;
  const headSha = activeRepo?.headSha;

  useEffect(() => {
    if (
      workspaceTab !== "log" ||
      !repoId ||
      (activeHistoryScope && activeHistoryScope.repoId !== repoId)
    ) {
      return;
    }
    const hasScope = Boolean(activeHistoryScope);
    // First open queries immediately: the debounce only coalesces later filter
    // churn, and delaying the first page makes the panel flash a second loading.
    const hasSnapshot = Boolean(deps.store.logSnapshot);
    const timer = window.setTimeout(() => {
      void loadLogRef.current();
    }, hasScope || !hasSnapshot ? 0 : 200);
    return () => window.clearTimeout(timer);
  }, [workspaceTab, repoId, headSha, filtersKey, activeHistoryScope]);

  useEffect(() => {
    if (workspaceTab === "temporary" && repoId) {
      if (!stashSnapshot) {
        void loadStashes();
      }
      if (!shelfSnapshot) {
        void loadShelves();
      }
    }
  }, [workspaceTab, repoId, stashSnapshot, shelfSnapshot, loadStashes, loadShelves]);

  useEffect(() => {
    if (protectedBranch && amend) {
      setAmend(false);
    }
  }, [protectedBranch, amend, setAmend]);

  useEffect(() => {
    if (workspaceTab === "review" && repoId && !reviewSnapshot && !reviewLoading) {
      void loadReviews();
    }
  }, [workspaceTab, repoId, reviewSnapshot, reviewLoading, loadReviews]);
}
