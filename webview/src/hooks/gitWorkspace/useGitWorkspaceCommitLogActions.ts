import { useCallback } from "react";
import type { CommitCheckIssue } from "@gitview/shared/types/commitCheck";
import type { DiffLineSelection } from "@gitview/shared/types/diff";
import type { ResetMode } from "@gitview/shared/types/log";
import { useGitWorkspaceStore } from "../../stores/gitWorkspaceStore";
import { isErrorCode } from "../../lib/errorCode";
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
      const paths = [...commitScope];
      setSyncing(true);
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
          runChecks,
          confirmedChecks: confirmedChecks || commitAfterChecksConfirmed,
          pushAfter,
        });
        if (result.upstreamRequired) {
          openDialog("pushUpstream", {
            branch: activeRepo.currentBranch ?? "HEAD",
            remote: "origin",
          });
        } else if (result.pushRejected) {
          setWorkspaceNotification({
            level: "warning",
            message: "Commit succeeded but push was rejected.",
          });
        }
        closeDialog("commitCheckWarnings");
        setCommitAfterChecksConfirmed(false);
        setCommitMessage("");
      } catch (err) {
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
        setSyncing(false);
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
    ) => {
      if (!activeRepo) {
        return;
      }
      setSyncing(true);
      useGitWorkspaceStore.getState().setError(null);
      try {
        if (action === "drop") {
          await clientRef.current.dropCommit(activeRepo.id, sha, confirmed);
        } else {
          await clientRef.current.rewriteCommit(
            activeRepo.id,
            sha,
            action,
            confirmed,
          );
        }
        closeDialog("rewrite");
        await loadLog();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Rewrite failed";
        if (message.toLowerCase().includes("requires confirmation")) {
          openDialog("rewrite", { sha, action });
        } else {
          useGitWorkspaceStore.getState().setError(message);
        }
      } finally {
        setSyncing(false);
      }
    },
    [activeRepo, loadLog, openDialog, closeDialog],
  );

  const handleDropSelected = useCallback(
    async (
      sha: string,
      path: string,
      selection: { hunkIndexes?: number[]; lines?: DiffLineSelection[] },
      confirmed = false,
    ) => {
      if (!activeRepo) {
        return;
      }
      setSyncing(true);
      useGitWorkspaceStore.getState().setError(null);
      try {
        await clientRef.current.dropSelectedChanges(activeRepo.id, sha, path, {
          ...selection,
          confirmed,
        });
        closeDialog("dropSelected");
        await loadLog();
        if (selectedFilePath === path) {
          void loadLogFileDiff(sha, path, "M");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Drop selected failed";
        if (message.toLowerCase().includes("requires confirmation")) {
          openDialog("dropSelected", { sha, path, ...selection });
        } else {
          useGitWorkspaceStore.getState().setError(message);
        }
      } finally {
        setSyncing(false);
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
      setSyncing(true);
      useGitWorkspaceStore.getState().setError(null);
      try {
        await clientRef.current.deleteBranch(activeRepo.id, name, force);
        closeDialog("deleteBranch");
        await loadBranches();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Delete branch failed";
        if (!force && isErrorCode(err, "BRANCH_NOT_FULLY_MERGED")) {
          openDialog("deleteBranch", { name, forceRequired: true });
        } else {
          useGitWorkspaceStore.getState().setError(message);
        }
      } finally {
        setSyncing(false);
      }
    },
    [activeRepo, loadBranches, openDialog, closeDialog],
  );

  const handleReset = useCallback(
    async (sha: string, mode: ResetMode, confirmed = false) => {
      if (!activeRepo) {
        return;
      }
      setSyncing(true);
      useGitWorkspaceStore.getState().setError(null);
      try {
        await clientRef.current.resetToCommit(
          activeRepo.id,
          sha,
          mode,
          confirmed,
        );
        closeDialog("reset");
        await loadLog();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Reset failed";
        if (message.toLowerCase().includes("requires confirmation")) {
          openDialog("reset", { sha, mode });
        } else {
          useGitWorkspaceStore.getState().setError(message);
        }
      } finally {
        setSyncing(false);
      }
    },
    [activeRepo, loadLog, openDialog, closeDialog],
  );
  return { commit, handleRewriteHistory, handleDropSelected, handleDeleteBranch, handleReset };
}
