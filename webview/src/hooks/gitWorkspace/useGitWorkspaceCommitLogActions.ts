import { useCallback } from "react";
import type { CommitCheckIssue } from "@gitview/shared/types/commitCheck";
import {
  isConfirmationEvidence,
  type ConfirmationSubmission,
} from "@gitview/shared/types/confirmation";
import type { DiffLineSelection } from "@gitview/shared/types/diff";
import type { ResetMode } from "@gitview/shared/types/log";
import { useGitWorkspaceStore } from "../../stores/gitWorkspaceStore";
import { isErrorCode } from "../../lib/errorCode";
import { captureRepoToken, isRepoTokenCurrent } from "./repoScope";
import type { GitWorkspaceCommitLogApi } from "../../apps/gitWorkspace/gitWorkspaceControllerTypes";
import type { GitWorkspaceDeps } from "./gitWorkspaceDeps";
import type { useGitWorkspaceLoaders } from "./useGitWorkspaceLoaders";

export function useGitWorkspaceCommitLogActions(
  deps: GitWorkspaceDeps,
  loaders: ReturnType<typeof useGitWorkspaceLoaders>,
): GitWorkspaceCommitLogApi {
  const { loadLog, loadLogFileDiff, loadBranches } = loaders;
  const { clientRef, activeRepo, setSyncing } = deps.core;
  const {
    commitScope,
    commitMessage,
    amend,
    signoff,
    gpgSign,
    author,
    runChecks,
    runHooks,
    commitAfterChecksConfirmed,
    selectedFilePath,
    setCommitMessage,
    setWorkspaceNotification,
    setCommitAfterChecksConfirmed,
    openDialog,
    closeDialog,
  } = deps.store;

  const commit = useCallback(
    async (pushAfter: boolean, confirmedChecks = false) => {
      if (!activeRepo) {
        return;
      }
      // All completion effects below are scoped to this repository: if the
      // user switches repos while the commit runs, repo A's late completion
      // must not erase repo B's draft, dialogs, or notifications.
      const requestToken = captureRepoToken(activeRepo.id);
      const paths = [...commitScope];
      setSyncing(true, activeRepo.id);
      useGitWorkspaceStore.getState().setError(null);
      try {
        const result = await clientRef.current.createCommit({
          repoId: activeRepo.id,
          message: commitMessage,
          paths,
          amend,
          signoff,
          gpgSign,
          author: author.trim() || undefined,
          skipHooks: !runHooks,
          runChecks,
          confirmedChecks: confirmedChecks || commitAfterChecksConfirmed,
          pushAfter,
        });
        if (!isRepoTokenCurrent(requestToken)) {
          return;
        }
        if (result.upstreamRequired) {
          openDialog("pushUpstream", {
            branch: activeRepo.currentBranch ?? "HEAD",
            remote: "origin",
          });
        } else if (result.pushRejected) {
          setWorkspaceNotification({
            level: "warning",
            message: result.pushError
              ? `Commit succeeded but push was rejected: ${result.pushError}`
              : "Commit succeeded but push was rejected.",
          });
        } else if (result.pushError) {
          setWorkspaceNotification({
            level: "warning",
            message: `Commit succeeded but push failed: ${result.pushError}`,
          });
        }
        closeDialog("commitCheckWarnings");
        setCommitAfterChecksConfirmed(false);
        setCommitMessage("");
      } catch (err) {
        if (!isRepoTokenCurrent(requestToken)) {
          return;
        }
        const message = err instanceof Error ? err.message : "Commit failed";
        const details = (err as { details?: { issues?: CommitCheckIssue[] } }).details;
        if (
          message.toLowerCase().includes("commit checks reported warnings") ||
          (details?.issues && details.issues.length > 0)
        ) {
          openDialog("commitCheckWarnings", { issues: details?.issues ?? [] });
        } else if (message.toLowerCase().includes("commit checks")) {
          useGitWorkspaceStore.getState().setError(message);
        } else {
          useGitWorkspaceStore.getState().setError(message);
        }
      } finally {
        setSyncing(false, activeRepo.id);
      }
    },
    [
      activeRepo,
      amend,
      author,
      commitAfterChecksConfirmed,
      commitMessage,
      commitScope,
      gpgSign,
      runChecks,
      runHooks,
      setCommitAfterChecksConfirmed,
      setCommitMessage,
      openDialog,
      closeDialog,
      setWorkspaceNotification,
      signoff,
    ],
  );

  const handleRewriteHistory = useCallback(
    async (
      sha: string,
      action: "squash" | "fixup" | "drop",
      confirmed = false,
      confirmation?: ConfirmationSubmission,
    ) => {
      if (!activeRepo) {
        return;
      }
      const requestToken = captureRepoToken(activeRepo.id);
      setSyncing(true, activeRepo.id);
      useGitWorkspaceStore.getState().setError(null);
      try {
        if (action === "drop") {
          await clientRef.current.dropCommit(activeRepo.id, sha, confirmation);
        } else {
          await clientRef.current.rewriteCommit(
            activeRepo.id,
            sha,
            action,
            confirmed,
          );
        }
        if (isRepoTokenCurrent(requestToken)) {
          closeDialog("rewrite");
        }
        await loadLog();
      } catch (err) {
        if (!isRepoTokenCurrent(requestToken)) {
          return;
        }
        const message = err instanceof Error ? err.message : "Rewrite failed";
        const details = (err as { details?: { confirmation?: unknown } }).details;
        const nextConfirmation = isConfirmationEvidence(details?.confirmation)
          ? details.confirmation
          : undefined;
        if (
          action === "drop" &&
          nextConfirmation?.action === "drop_commit" &&
          (isErrorCode(err, "CONFIRMATION_REQUIRED") ||
            isErrorCode(err, "CONFIRMATION_STALE"))
        ) {
          openDialog("rewrite", { sha, action, confirmation: nextConfirmation });
          if (isErrorCode(err, "CONFIRMATION_STALE")) {
            useGitWorkspaceStore.getState().setError(message);
          }
        } else if (isErrorCode(err, "CONFIRMATION_REQUIRED")) {
          openDialog("rewrite", { sha, action });
        } else {
          useGitWorkspaceStore.getState().setError(message);
        }
      } finally {
        setSyncing(false, activeRepo.id);
      }
    },
    [activeRepo, loadLog, openDialog, closeDialog],
  );

  const handleDropSelected = useCallback(
    async (
      sha: string,
      path: string,
      selection: { hunkIndexes?: number[]; lines?: DiffLineSelection[] },
      confirmation?: ConfirmationSubmission,
    ) => {
      if (!activeRepo) {
        return;
      }
      const requestToken = captureRepoToken(activeRepo.id);
      setSyncing(true, activeRepo.id);
      useGitWorkspaceStore.getState().setError(null);
      try {
        await clientRef.current.dropSelectedChanges(activeRepo.id, sha, path, {
          ...selection,
          confirmation,
        });
        if (isRepoTokenCurrent(requestToken)) {
          closeDialog("dropSelected");
        }
        await loadLog();
        if (selectedFilePath === path) {
          void loadLogFileDiff(sha, path, "M");
        }
      } catch (err) {
        if (!isRepoTokenCurrent(requestToken)) {
          return;
        }
        const message = err instanceof Error ? err.message : "Drop selected failed";
        const details = (err as { details?: { confirmation?: unknown } }).details;
        const nextConfirmation = isConfirmationEvidence(details?.confirmation)
          ? details.confirmation
          : undefined;
        if (
          nextConfirmation?.action === "drop_selected" &&
          (isErrorCode(err, "CONFIRMATION_REQUIRED") ||
            isErrorCode(err, "CONFIRMATION_STALE"))
        ) {
          openDialog("dropSelected", {
            sha,
            path,
            ...selection,
            confirmation: nextConfirmation,
          });
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
    [
      activeRepo,
      loadLog,
      loadLogFileDiff,
      selectedFilePath,
      openDialog,
      closeDialog,
    ],
  );

  const handleDeleteBranch = useCallback(
    async (name: string, force = false) => {
      if (!activeRepo) {
        return;
      }
      const requestToken = captureRepoToken(activeRepo.id);
      setSyncing(true, activeRepo.id);
      useGitWorkspaceStore.getState().setError(null);
      try {
        await clientRef.current.deleteBranch(activeRepo.id, name, force);
        if (isRepoTokenCurrent(requestToken)) {
          closeDialog("deleteBranch");
        }
        await loadBranches();
      } catch (err) {
        if (!isRepoTokenCurrent(requestToken)) {
          return;
        }
        const message = err instanceof Error ? err.message : "Delete branch failed";
        if (!force && isErrorCode(err, "BRANCH_NOT_FULLY_MERGED")) {
          openDialog("deleteBranch", { name, forceRequired: true });
        } else {
          useGitWorkspaceStore.getState().setError(message);
        }
      } finally {
        setSyncing(false, activeRepo.id);
      }
    },
    [activeRepo, loadBranches, openDialog, closeDialog],
  );

  const handleReset = useCallback(
    async (
      sha: string,
      mode: ResetMode,
      confirmed = false,
      confirmation?: ConfirmationSubmission,
    ) => {
      if (!activeRepo) {
        return;
      }
      const requestToken = captureRepoToken(activeRepo.id);
      setSyncing(true, activeRepo.id);
      useGitWorkspaceStore.getState().setError(null);
      try {
        await clientRef.current.resetToCommit(
          activeRepo.id,
          sha,
          mode,
          confirmed,
          confirmation,
        );
        if (isRepoTokenCurrent(requestToken)) {
          closeDialog("reset");
        }
        await loadLog();
      } catch (err) {
        if (!isRepoTokenCurrent(requestToken)) {
          return;
        }
        const message = err instanceof Error ? err.message : "Reset failed";
        const details = (err as { details?: { confirmation?: unknown } }).details;
        const nextConfirmation = isConfirmationEvidence(details?.confirmation)
          ? details.confirmation
          : undefined;
        if (
          mode === "hard" &&
          nextConfirmation?.action === "hard_reset" &&
          (isErrorCode(err, "CONFIRMATION_REQUIRED") ||
            isErrorCode(err, "CONFIRMATION_STALE"))
        ) {
          openDialog("reset", {
            sha,
            mode,
            confirmation: nextConfirmation,
          });
          if (isErrorCode(err, "CONFIRMATION_STALE")) {
            useGitWorkspaceStore.getState().setError(message);
          }
        } else if (isErrorCode(err, "CONFIRMATION_REQUIRED")) {
          openDialog("reset", { sha, mode });
        } else {
          useGitWorkspaceStore.getState().setError(message);
        }
      } finally {
        setSyncing(false, activeRepo.id);
      }
    },
    [activeRepo, loadLog, openDialog, closeDialog],
  );
  return { commit, handleRewriteHistory, handleDropSelected, handleDeleteBranch, handleReset };
}
