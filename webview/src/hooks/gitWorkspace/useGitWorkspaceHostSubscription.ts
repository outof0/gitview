import { useEffect, useRef } from "react";
import { normalizeGitWorkspaceSettings } from "@gitview/shared/types/gitWorkspaceSettings";
import { PANEL_DIALOG_PAYLOADS } from "../../stores/gitWorkspaceDialogs";
import { useGitWorkspaceStore } from "../../stores/gitWorkspaceStore";
import {
  isRepoSnapshot,
  isStatusSnapshot,
  isBranchCompareSnapshot,
  isBranchSnapshot,
  isLogSnapshot,
  isNotification,
  isReviewSnapshot,
  isReviewDetails,
  isStashSnapshot,
  isShelfSnapshot,
  isTagSnapshot,
  isWorktreeSnapshot,
  isDiffResult,
  isGitSettings,
  isOpenDialogRequest,
  isSyncOperationMessage,
  isOpenHistoryRequest,
  isSelectCommitRequest,
  isRollbackRequest,
  isFocusRootRequest,
} from "../../apps/gitWorkspace/hostMessageGuards";
import type { GitWorkspaceDeps } from "./gitWorkspaceDeps";

export function useGitWorkspaceHostSubscription(
  deps: GitWorkspaceDeps & {
    refresh: () => Promise<void>;
    openBranches: () => void;
  },
) {
  const { openBranches } = deps;
  const { clientRef, refresh } = deps.core;
  const {
    applyRepoSnapshot,
    applyStatusSnapshot,
    applySyncOperation,
    applyBranchSnapshot,
    applyLogSnapshot,
    applyStashSnapshot,
    applyShelfSnapshot,
    applyTagSnapshot,
    applyWorktreeSnapshot,
    applyBranchCompareSnapshot,
    setDiffDocument,
    setWorkspaceNotification,
    applyReviewSnapshot,
    applyReviewDetails,
    setPullStrategy,
    setSynchronousBranchControl,
    setWhitespacePolicy,
    setDiffViewMode,
    setLogFilters,
    setIssueTrackerBaseUrl,
    closeAllDialogs,
    openExclusiveDialog,
    setNativeFocusSurface,
    setWorkspaceTab,
    requestHistoryOpen,
    selectLogCommit,
    setPendingRollback,
    clearPendingRollback,
    focusLogRoot,
  } = deps.store;
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const openBranchesRef = useRef(openBranches);
  openBranchesRef.current = openBranches;

  useEffect(() => {
    const client = clientRef.current;
    const applySettings = (value: unknown) => {
      const settings = normalizeGitWorkspaceSettings(value);
      setPullStrategy(settings.updateStrategy);
      setSynchronousBranchControl(settings.synchronousBranchControl);
      setWhitespacePolicy(settings.whitespacePolicy);
      setDiffViewMode(settings.diffViewMode);
      setLogFilters({
        ...useGitWorkspaceStore.getState().logFilters,
        graphSort: settings.graphSort,
        highlightCurrentBranch: settings.highlightCurrentBranch,
        compactRows: settings.compactLogRows,
      });
      setIssueTrackerBaseUrl(settings.issueTrackerBaseUrl);
    };
    const onMessage = (event: MessageEvent) => {
      // Request correlation: snapshot/diff events from a superseded request
      // must not overwrite fresher data. The host stamps request-driven
      // emissions with their request id; spontaneous pushes (refresh,
      // watchers) carry none and always apply.
      const eventRequestId = (data: unknown): string | undefined => {
        const id = (data as { requestId?: unknown } | null)?.requestId;
        return typeof id === "string" && id.length > 0 ? id : undefined;
      };
      const isCurrent = (eventType: string, data: unknown): boolean =>
        client.isCurrentEvent(eventType, eventRequestId(data));
      if (isRepoSnapshot(event.data)) {
        if (isCurrent("repo.snapshot", event.data)) {
          applyRepoSnapshot(event.data.payload);
        }
      } else if (isStatusSnapshot(event.data)) {
        if (isCurrent("status.snapshot", event.data)) {
          applyStatusSnapshot(event.data.payload);
        }
      } else if (isSyncOperationMessage(event.data)) {
        applySyncOperation(event.data.payload);
      } else if (isBranchSnapshot(event.data)) {
        if (isCurrent("branch.snapshot", event.data)) {
          applyBranchSnapshot(event.data.payload);
        }
      } else if (isLogSnapshot(event.data)) {
        if (isCurrent("log.snapshot", event.data)) {
          applyLogSnapshot(event.data.payload);
        }
      } else if (isStashSnapshot(event.data)) {
        if (isCurrent("stash.snapshot", event.data)) {
          applyStashSnapshot(event.data.payload);
        }
      } else if (isShelfSnapshot(event.data)) {
        if (isCurrent("shelf.snapshot", event.data)) {
          applyShelfSnapshot(event.data.payload);
        }
      } else if (isTagSnapshot(event.data)) {
        if (isCurrent("tag.snapshot", event.data)) {
          applyTagSnapshot(event.data.payload);
        }
      } else if (isWorktreeSnapshot(event.data)) {
        if (isCurrent("worktree.snapshot", event.data)) {
          applyWorktreeSnapshot(event.data.payload);
        }
      } else if (isBranchCompareSnapshot(event.data)) {
        if (isCurrent("branch.compare.snapshot", event.data)) {
          applyBranchCompareSnapshot(event.data.payload);
        }
      } else if (isDiffResult(event.data)) {
        if (isCurrent("diff.result", event.data)) {
          setDiffDocument(event.data.payload);
        }
      } else if (isNotification(event.data)) {
        setWorkspaceNotification(event.data.payload);
      } else if (isReviewSnapshot(event.data)) {
        if (isCurrent("review.snapshot", event.data)) {
          applyReviewSnapshot(event.data.payload);
        }
      } else if (isReviewDetails(event.data)) {
        if (isCurrent("review.details", event.data)) {
          applyReviewDetails(event.data.payload);
        }
      } else if (isGitSettings(event.data)) {
        applySettings(event.data.payload);
      } else if (isOpenDialogRequest(event.data)) {
        const { dialog: surface, index, repoId } = event.data.payload;
        if (surface === "branches") {
          closeAllDialogs();
          openBranchesRef.current();
        } else {
          openExclusiveDialog(
            surface,
            surface === "unstash"
              ? { index: index ?? null }
              : PANEL_DIALOG_PAYLOADS[surface],
          );
        }
        setNativeFocusSurface(surface);
        if (repoId) {
          const activeRepoId =
            useGitWorkspaceStore.getState().repoSnapshot?.activeRepoId;
          if (activeRepoId !== repoId) {
            void client.refreshRepos(repoId).catch((error: unknown) => {
              setWorkspaceNotification({
                level: "error",
                message:
                  error instanceof Error
                    ? error.message
                    : "Could not open the Git dialog.",
              });
            });
          }
        }
      } else if (isOpenHistoryRequest(event.data)) {
        const scope = event.data.payload;
        // Open the tab immediately. A full repo refresh is only needed when
        // the clicked resource belongs to another workspace repository; doing
        // it for every file makes Show History wait for a status scan before
        // the already-known path can be queried.
        requestHistoryOpen(scope);
        const activeRepoId =
          useGitWorkspaceStore.getState().repoSnapshot?.activeRepoId;
        if (activeRepoId === scope.repoId) {
          return;
        }
        void client.refreshRepos(scope.repoId).catch((error: unknown) => {
          setWorkspaceNotification({
            level: "error",
            message:
              error instanceof Error
                ? error.message
                : "Could not open file history.",
          });
        });
      } else if (isSelectCommitRequest(event.data)) {
        const { repoId, sha } = event.data.payload;
        setWorkspaceTab("log");
        const activeRepoId =
          useGitWorkspaceStore.getState().repoSnapshot?.activeRepoId;
        if (activeRepoId === repoId) {
          selectLogCommit(sha);
          return;
        }
        if (typeof client.refreshRepos !== "function") {
          setWorkspaceNotification({
            level: "error",
            message: "Could not switch to the selected repository.",
          });
          return;
        }
        // A commit selected from a native history/blame surface may belong to
        // another root in a multi-root workspace. Load that root before
        // applying the SHA so its log cannot be paired with the old repo.
        void client.refreshRepos(repoId)
          .then(() => {
            selectLogCommit(sha);
          })
          .catch((error: unknown) => {
            setWorkspaceNotification({
              level: "error",
              message:
                error instanceof Error
                  ? error.message
                  : "Could not open the selected commit.",
            });
          });
      } else if (isRollbackRequest(event.data)) {
        const scope = event.data.payload;
        closeAllDialogs();
        setNativeFocusSurface(null);
        setWorkspaceTab("changes");
        setPendingRollback(scope);
        const activeRepoId =
          useGitWorkspaceStore.getState().repoSnapshot?.activeRepoId;
        if (activeRepoId === scope.repoId) {
          return;
        }
        void client.refreshRepos(scope.repoId).catch((error: unknown) => {
          clearPendingRollback();
          setWorkspaceNotification({
            level: "error",
            message:
              error instanceof Error
                ? error.message
                : "Could not open the rollback confirmation.",
          });
        });
      } else if (isFocusRootRequest(event.data)) {
        focusLogRoot();
      } else {
        client.handleHostMessage(event.data);
      }
    };

    window.addEventListener("message", onMessage);
    void client
      .ready("gitWorkspace")
      .then((response) => {
        applySettings(response.settings);
        const bootstrapRepoIdValue = (
          window.__GITVIEW_BOOTSTRAP__ as { repoId?: unknown } | undefined
        )?.repoId;
        const bootstrapRepoId =
          typeof bootstrapRepoIdValue === "string" &&
          bootstrapRepoIdValue.length > 0
            ? bootstrapRepoIdValue
            : undefined;
        if (bootstrapRepoId) {
          return client.refreshRepos(bootstrapRepoId).then(() => undefined);
        }
        return refreshRef.current();
      })
      .catch((error: unknown) => {
        // The host starts pushing snapshots and flushes the queued dialog only
        // after this handshake (src/webview/gitWorkspacePanel.ts). A rejected
        // handshake used to be an unhandled rejection here, which left the
        // panel on an empty tree with no explanation and nothing in the UI.
        setWorkspaceNotification({
          level: "error",
          message: `GitView could not start: ${
            error instanceof Error ? error.message : String(error)
          }`,
        });
      });

    return () => window.removeEventListener("message", onMessage);
  }, [
    applyBranchSnapshot,
    applyBranchCompareSnapshot,
    applyLogSnapshot,
    applyRepoSnapshot,
    applyReviewDetails,
    applyReviewSnapshot,
    applyShelfSnapshot,
    applyStashSnapshot,
    applyStatusSnapshot,
    applySyncOperation,
    applyTagSnapshot,
    applyWorktreeSnapshot,
    clientRef,
    closeAllDialogs,
    openExclusiveDialog,
    setDiffDocument,
    setDiffViewMode,
    setIssueTrackerBaseUrl,
    setLogFilters,
    setNativeFocusSurface,
    setWorkspaceTab,
    setPendingRollback,
    clearPendingRollback,
    requestHistoryOpen,
    selectLogCommit,
    focusLogRoot,
    setPullStrategy,
    setSynchronousBranchControl,
    setWhitespacePolicy,
    setWorkspaceNotification,
  ]);
}
