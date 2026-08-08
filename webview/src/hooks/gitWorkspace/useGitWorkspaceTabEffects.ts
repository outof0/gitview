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
    logSnapshot,
    logLoading,
    stashSnapshot,
    shelfSnapshot,
    amend,
    selectedFilePath,
    reviewSnapshot,
    reviewLoading,
    setAmend,
  } = deps.store;
  const protectedBranch = activeRepo?.protectedBranch;

  const { loadLog, loadBlame } = loaders;
  const { loadReviews } = sync;
  const { loadStashes, loadShelves } = aux;

  useEffect(() => {
    if (workspaceTab === "log" && activeRepo && !logSnapshot && !logLoading) {
      void loadLog();
    }
  }, [workspaceTab, activeRepo, logSnapshot, logLoading, loadLog]);

  useEffect(() => {
    if (workspaceTab === "temporary" && activeRepo) {
      if (!stashSnapshot) {
        void loadStashes();
      }
      if (!shelfSnapshot) {
        void loadShelves();
      }
    }
  }, [workspaceTab, activeRepo, stashSnapshot, shelfSnapshot, loadStashes, loadShelves]);

  useEffect(() => {
    if (protectedBranch && amend) {
      setAmend(false);
    }
  }, [protectedBranch, amend, setAmend]);

  useEffect(() => {
    if (workspaceTab === "blame" && activeRepo && selectedFilePath) {
      void loadBlame();
    }
  }, [workspaceTab, activeRepo, selectedFilePath, loadBlame]);

  useEffect(() => {
    if (workspaceTab === "review" && activeRepo && !reviewSnapshot && !reviewLoading) {
      void loadReviews();
    }
  }, [workspaceTab, activeRepo, reviewSnapshot, reviewLoading, loadReviews]);
}