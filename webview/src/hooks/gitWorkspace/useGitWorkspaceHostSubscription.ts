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
  isBlameSnapshot,
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
    applyBlameSnapshot,
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
      } else if (isBlameSnapshot(event.data)) {
        if (isCurrent("blame.snapshot", event.data)) {
          applyBlameSnapshot(event.data.payload);
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
        const surface = event.data.payload.dialog;
        if (surface === "branches") {
          closeAllDialogs();
          openBranchesRef.current();
        } else {
          openExclusiveDialog(surface, PANEL_DIALOG_PAYLOADS[surface]);
        }
        setNativeFocusSurface(surface);
      } else {
        client.handleHostMessage(event.data);
      }
    };

    window.addEventListener("message", onMessage);
    void client
      .ready("gitWorkspace")
      .then((response) => {
        applySettings(response.settings);
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
    applyBlameSnapshot,
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
    setPullStrategy,
    setSynchronousBranchControl,
    setWhitespacePolicy,
    setWorkspaceNotification,
  ]);
}
