import { useCallback } from "react";
import {
  isConfirmationEvidence,
  type ConfirmationSubmission,
} from "@gitview/shared/types/confirmation";
import type { GitWorkspaceAuxApi } from "../../apps/gitWorkspace/gitWorkspaceControllerTypes";
import { isErrorCode } from "../../lib/errorCode";
import { useGitWorkspaceStore } from "../../stores/gitWorkspaceStore";
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
    async (path: string, confirmation?: ConfirmationSubmission) => {
      if (!activeRepo) {
        return;
      }
      setSyncing(true);
      useGitWorkspaceStore.getState().setError(null);
      try {
        await clientRef.current.removeWorktree(activeRepo.id, path, confirmation);
        closeDialog("worktreeRemove");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Remove worktree failed";
        const details = (err as { details?: { confirmation?: unknown } }).details;
        const nextConfirmation = isConfirmationEvidence(details?.confirmation)
          ? details.confirmation
          : undefined;
        if (
          nextConfirmation?.action === "remove_dirty_worktree" &&
          (isErrorCode(err, "CONFIRMATION_REQUIRED") ||
            isErrorCode(err, "CONFIRMATION_STALE"))
        ) {
          openDialog("worktreeRemove", { confirmation: nextConfirmation });
          if (isErrorCode(err, "CONFIRMATION_STALE")) {
            useGitWorkspaceStore.getState().setError(message);
          }
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
    async (paths: string[], confirmation?: ConfirmationSubmission) => {
      if (!activeRepo) {
        return;
      }
      setSyncing(true);
      useGitWorkspaceStore.getState().setError(null);
      try {
        await clientRef.current.rollbackFiles(activeRepo.id, paths, confirmation);
        closeDialog("rollbackConfirm");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Rollback failed";
        const details = (err as { details?: { confirmation?: unknown } }).details;
        const nextConfirmation = isConfirmationEvidence(details?.confirmation)
          ? details.confirmation
          : undefined;
        if (
          nextConfirmation?.action === "rollback" &&
          (isErrorCode(err, "CONFIRMATION_REQUIRED") ||
            isErrorCode(err, "CONFIRMATION_STALE"))
        ) {
          openDialog("rollbackConfirm", { confirmation: nextConfirmation });
          if (isErrorCode(err, "CONFIRMATION_STALE")) {
            useGitWorkspaceStore.getState().setError(message);
          }
        } else {
          useGitWorkspaceStore.getState().setError(message);
        }
      } finally {
        setSyncing(false);
      }
    },
    [activeRepo, openDialog, closeDialog],
  );
  return { loadStashes, loadShelves, loadTags, loadWorktrees, handleRemoveWorktree, handleCopyHash, handleRollback };
}
