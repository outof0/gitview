import { useEffect } from "react";
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
      if (isRepoSnapshot(event.data)) {
        applyRepoSnapshot(event.data.payload);
      } else if (isStatusSnapshot(event.data)) {
        applyStatusSnapshot(event.data.payload);
      } else if (isBranchSnapshot(event.data)) {
        applyBranchSnapshot(event.data.payload);
      } else if (isLogSnapshot(event.data)) {
        applyLogSnapshot(event.data.payload);
      } else if (isBlameSnapshot(event.data)) {
        applyBlameSnapshot(event.data.payload);
      } else if (isStashSnapshot(event.data)) {
        applyStashSnapshot(event.data.payload);
      } else if (isShelfSnapshot(event.data)) {
        applyShelfSnapshot(event.data.payload);
      } else if (isTagSnapshot(event.data)) {
        applyTagSnapshot(event.data.payload);
      } else if (isWorktreeSnapshot(event.data)) {
        applyWorktreeSnapshot(event.data.payload);
      } else if (isBranchCompareSnapshot(event.data)) {
        applyBranchCompareSnapshot(event.data.payload);
      } else if (isDiffResult(event.data)) {
        setDiffDocument(event.data.payload);
      } else if (isNotification(event.data)) {
        setWorkspaceNotification(event.data.payload);
      } else if (isReviewSnapshot(event.data)) {
        applyReviewSnapshot(event.data.payload);
      } else if (isReviewDetails(event.data)) {
        applyReviewDetails(event.data.payload);
      } else if (isGitSettings(event.data)) {
        applySettings(event.data.payload);
      } else if (isOpenDialogRequest(event.data)) {
        const surface = event.data.payload.dialog;
        if (surface === "branches") {
          closeAllDialogs();
          openBranches();
        } else {
          openExclusiveDialog(surface, PANEL_DIALOG_PAYLOADS[surface]);
        }
        setNativeFocusSurface(surface);
      } else {
        client.handleHostMessage(event.data);
      }
    };

    window.addEventListener("message", onMessage);
    void client.ready("gitWorkspace").then((response) => {
      applySettings(response.settings);
      return refresh();
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
    applyTagSnapshot,
    applyWorktreeSnapshot,
    clientRef,
    closeAllDialogs,
    openBranches,
    openExclusiveDialog,
    refresh,
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
