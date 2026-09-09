import { useCallback } from "react";
import {
  isConfirmationEvidence,
  type ConfirmationSubmission,
} from "@gitview/shared/types/confirmation";
import type { GitWorkspaceAuxApi } from "../../apps/gitWorkspace/gitWorkspaceControllerTypes";
import { isErrorCode } from "../../lib/errorCode";
import { captureRepoToken, isRepoTokenCurrent } from "./repoScope";
import { useGitWorkspaceStore } from "../../stores/gitWorkspaceStore";
import type { GitWorkspaceDeps } from "./gitWorkspaceDeps";
import { useRepoRequestScope } from "./useRepoRequestScope";

export function useGitWorkspaceAuxActions(deps: GitWorkspaceDeps): GitWorkspaceAuxApi {
  const { clientRef, activeRepo, setSyncing } = deps.core;
  const activeRepoId = activeRepo?.id;
  const { begin, isCurrent } = useRepoRequestScope();
  const {
    setTagsLoading,
    setWorktreesLoading,
    setWorkspaceNotification,
    openDialog,
    closeDialog,
  } = deps.store;

  const loadStashes = useCallback(async () => {
    if (!activeRepoId) {
      return;
    }
    const token = begin(activeRepoId, "stashes");
    try {
      await clientRef.current.listStashes(activeRepoId);
    } catch (err) {
      if (!isCurrent(token)) {
        return;
      }
      useGitWorkspaceStore.getState().setError(
        err instanceof Error ? err.message : "Failed to load stashes",
      );
    }
  }, [activeRepoId, begin, isCurrent]);

  const loadShelves = useCallback(async () => {
    if (!activeRepo) {
      return;
    }
    const token = begin(activeRepo.id, "shelves");
    try {
      await clientRef.current.listShelves(activeRepo.id);
    } catch (err) {
      if (!isCurrent(token)) {
        return;
      }
      useGitWorkspaceStore.getState().setError(
        err instanceof Error ? err.message : "Failed to load shelves",
      );
    }
  }, [activeRepo, begin, isCurrent]);

  const loadTags = useCallback(async () => {
    if (!activeRepo) {
      return;
    }
    const token = begin(activeRepo.id, "tags");
    setTagsLoading(true);
    try {
      await clientRef.current.listTags(activeRepo.id);
    } catch (err) {
      if (!isCurrent(token)) {
        return;
      }
      useGitWorkspaceStore.getState().setError(
        err instanceof Error ? err.message : "Failed to load tags",
      );
    } finally {
      // `applyTagSnapshot` also clears this. Keep both: see the note in
      // `useGitWorkspaceLoaders.loadBranches`.
      if (isCurrent(token)) {
        setTagsLoading(false);
      }
    }
  }, [activeRepo, begin, isCurrent, setTagsLoading]);

  const loadWorktrees = useCallback(async () => {
    if (!activeRepo) {
      return;
    }
    const token = begin(activeRepo.id, "worktrees");
    setWorktreesLoading(true);
    try {
      await clientRef.current.listWorktrees(activeRepo.id);
    } catch (err) {
      if (!isCurrent(token)) {
        return;
      }
      useGitWorkspaceStore.getState().setError(
        err instanceof Error ? err.message : "Failed to load worktrees",
      );
    } finally {
      if (isCurrent(token)) {
        setWorktreesLoading(false);
      }
    }
  }, [activeRepo, begin, isCurrent, setWorktreesLoading]);

  const handleRemoveWorktree = useCallback(
    async (path: string, confirmation?: ConfirmationSubmission) => {
      if (!activeRepo) {
        return;
      }
      const requestToken = captureRepoToken(activeRepo.id);
      setSyncing(true, activeRepo.id);
      useGitWorkspaceStore.getState().setError(null);
      try {
        await clientRef.current.removeWorktree(activeRepo.id, path, confirmation);
        if (isRepoTokenCurrent(requestToken)) {
          closeDialog("worktreeRemove");
        }
      } catch (err) {
        if (!isRepoTokenCurrent(requestToken)) {
          return;
        }
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
        setSyncing(false, activeRepo.id);
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
      const requestToken = captureRepoToken(activeRepo.id);
      setSyncing(true, activeRepo.id);
      useGitWorkspaceStore.getState().setError(null);
      try {
        await clientRef.current.rollbackFiles(activeRepo.id, paths, confirmation);
        if (isRepoTokenCurrent(requestToken)) {
          closeDialog("rollbackConfirm");
        }
      } catch (err) {
        if (!isRepoTokenCurrent(requestToken)) {
          return;
        }
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
          if (!confirmation && isErrorCode(err, "CONFIRMATION_REQUIRED")) {
            // The preflight dialog already collected the user's explicit
            // choice. Keep the host-side evidence/fingerprint check, but
            // satisfy the legacy typed-value field internally so users do not
            // have to type "ROLLBACK" or "DELETE" for a second confirmation.
            try {
              await clientRef.current.rollbackFiles(activeRepo.id, paths, {
                evidence: nextConfirmation,
                typedValue: nextConfirmation.expectedTypedValue,
              });
              return;
            } catch (retryError) {
              if (!isRepoTokenCurrent(requestToken)) {
                return;
              }
              const retryMessage =
                retryError instanceof Error
                  ? retryError.message
                  : "Rollback failed";
              if (
                isErrorCode(retryError, "CONFIRMATION_REQUIRED") ||
                isErrorCode(retryError, "CONFIRMATION_STALE")
              ) {
                useGitWorkspaceStore.getState().setWorkspaceNotification({
                  level: "warning",
                  message:
                    "Repository changes detected before rollback. Review the file and try again.",
                });
              } else {
                useGitWorkspaceStore.getState().setError(retryMessage);
              }
              return;
            }
          }
          openDialog("rollbackConfirm", { confirmation: nextConfirmation });
          if (isErrorCode(err, "CONFIRMATION_STALE")) {
            useGitWorkspaceStore.getState().setError(message);
          }
        } else {
          useGitWorkspaceStore.getState().setError(message);
        }
      } finally {
        setSyncing(false, activeRepo.id);
      }
    },
    [activeRepo, openDialog, closeDialog],
  );
  return { loadStashes, loadShelves, loadTags, loadWorktrees, handleRemoveWorktree, handleCopyHash, handleRollback };
}
