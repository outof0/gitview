import { useEffect } from "react";
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
  const { loadReviews } = sync;
  const { loadStashes, loadShelves } = aux;
  const repoId = activeRepo?.id;

  useEffect(() => {
    if (
      workspaceTab !== "log" ||
      !repoId ||
      (activeHistoryScope && activeHistoryScope.repoId !== repoId)
    ) {
      return;
    }
    const hasScope = Boolean(activeHistoryScope);
    const timer = window.setTimeout(() => {
      void loadLog();
    }, hasScope ? 0 : 200);
    return () => window.clearTimeout(timer);
  }, [workspaceTab, repoId, logFilters, activeHistoryScope, loadLog]);

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
