import { useCallback } from "react";
import { useGitWorkspaceStore } from "../../stores/gitWorkspaceStore";
import { isDestructiveRollbackError } from "../../apps/gitWorkspace/hostMessageGuards";
import type { GitWorkspaceAuxApi } from "../../apps/gitWorkspace/gitWorkspaceControllerTypes";
import type { GitWorkspaceDeps } from "./gitWorkspaceDeps";

export function useGitWorkspaceAuxActions(deps: GitWorkspaceDeps): GitWorkspaceAuxApi {
  const { clientRef, activeRepo, setSyncing } = deps.core;
  const {
    setTagsLoading,
    setWorktreesLoading,
    setWorkspaceNotification,
    openDialog,
    closeDialog,
  } = deps.store;

  const loadStashes = useCallback(async () => {
    if (!activeRepo) {
      return;
    }
    try {
      await clientRef.current.listStashes(activeRepo.id);
    } catch (err) {
      useGitWorkspaceStore.getState().setError(
        err instanceof Error ? err.message : "Failed to load stashes",
      );
    }
  }, [activeRepo]);

  const loadShelves = useCallback(async () => {
    if (!activeRepo) {
      return;
    }
    try {
      await clientRef.current.listShelves(activeRepo.id);
    } catch (err) {
      useGitWorkspaceStore.getState().setError(
        err instanceof Error ? err.message : "Failed to load shelves",
      );
    }
  }, [activeRepo]);

  const loadTags = useCallback(async () => {
    if (!activeRepo) {
      return;
    }
    setTagsLoading(true);
    try {
      await clientRef.current.listTags(activeRepo.id);
    } catch (err) {
      setTagsLoading(false);
      useGitWorkspaceStore.getState().setError(
        err instanceof Error ? err.message : "Failed to load tags",
      );
    }
  }, [activeRepo, setTagsLoading]);

  const loadWorktrees = useCallback(async () => {
    if (!activeRepo) {
      return;
    }
    setWorktreesLoading(true);
    try {
      await clientRef.current.listWorktrees(activeRepo.id);
    } catch (err) {
      setWorktreesLoading(false);
      useGitWorkspaceStore.getState().setError(
        err instanceof Error ? err.message : "Failed to load worktrees",
      );
    }
  }, [activeRepo, setWorktreesLoading]);

  const handleRemoveWorktree = useCallback(
    async (path: string, force = false, confirmed = false) => {
      if (!activeRepo) {
        return;
      }
      setSyncing(true);
      try {
        await clientRef.current.removeWorktree(
          activeRepo.id,
          path,
          force,
          confirmed,
        );
        closeDialog("worktreeRemove");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Remove worktree failed";
        if (
          !force &&
          message.toLowerCase().includes("requires confirmation")
        ) {
          openDialog("worktreeRemove", { path, forceRequired: true });
        } else {
          useGitWorkspaceStore.getState().setError(message);
        }
      } finally {
        setSyncing(false);
      }
    },
    [activeRepo, openDialog, closeDialog],
  );

  const handleCopyHash = useCallback(async (sha: string) => {
    try {
      await navigator.clipboard.writeText(sha);
      setWorkspaceNotification({
        level: "info",
        message: `Copied commit hash ${sha.slice(0, 7)}`,
      });
    } catch {
      setWorkspaceNotification({
        level: "error",
        message: "Failed to copy commit hash to clipboard",
      });
    }
  }, [setWorkspaceNotification]);

  const handleRollback = useCallback(
    async (paths: string[], confirmed?: boolean) => {
      if (!activeRepo) {
        return;
      }
      setSyncing(true);
      useGitWorkspaceStore.getState().setError(null);
      try {
        await clientRef.current.rollbackFiles(activeRepo.id, paths, confirmed);
        closeDialog("rollbackConfirm");
      } catch (err) {
        const pending = isDestructiveRollbackError(err);
        if (pending) {
          openDialog("rollbackConfirm", { paths });
        } else {
          useGitWorkspaceStore.getState().setError(
            err instanceof Error ? err.message : "Rollback failed",
          );
        }
      } finally {
        setSyncing(false);
      }
    },
    [activeRepo, openDialog, closeDialog],
  );
  return { loadStashes, loadShelves, loadTags, loadWorktrees, handleRemoveWorktree, handleCopyHash, handleRollback };
}
