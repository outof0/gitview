import { useMemo, useState } from "react";
import type { LogCommitEntry } from "@gitview/shared/types/log";
import { collapseLinearCommits } from "../../lib/collapseLinearCommits";
import { sortLogCommitsTopologically } from "../../lib/sortLogCommits";
import { GitCommitList } from "./GitCommitList";
import { GitChangedFilesTree } from "./GitChangedFilesTree";
import { GitCommitDetail } from "./GitCommitDetail";
import { WorkspaceDiffPanel } from "./WorkspaceDiffPanel";
import { ResizableSplit } from "../ui/ResizableSplit";
import { WorkspaceLogFilters } from "./workspaceLogPanel/WorkspaceLogFilters";
import { WorkspaceLogToolbar } from "./workspaceLogPanel/WorkspaceLogToolbar";
import { findCommit, type WorkspaceLogPanelProps } from "./workspaceLogPanel/workspaceLogPanelTypes";

export function WorkspaceLogPanel({
  snapshot,
  loading = false,
  error = null,
  selectedSha,
  selectedShas = [],
  selectedFilePath,
  diffDocument,
  diffLoading = false,
  diffError = null,
  onSelectCommit,
  onSelectFile,
  onRefresh,
  filters,
  onFiltersChange,
  busy = false,
  protectedBranch = false,
  hasUpstream = false,
  onCherryPick,
  onCherryPickMultiple,
  onRevert,
  onRevertMultiple,
  issueTrackerBaseUrl,
  currentBranchHeadSha,
  onCopyHash,
  onCreateBranchFromCommit,
  onResetToCommit,
  onUndoLastCommit,
  onEditMessage,
  onDropCommit,
  onRewriteCommit,
  onExtractChanges,
  canDropSelected = false,
  protectedBranchForDrop = false,
  onCherryPickHunk,
  onRevertHunk,
  onDropHunk,
  onCherryPickLines,
  onRevertLines,
  onDropLines,
}: WorkspaceLogPanelProps) {
  const [expandedLinear, setExpandedLinear] = useState<LogCommitEntry[] | null>(
    null,
  );

  const rawCommits = snapshot?.commits ?? [];
  const commits = useMemo(() => {
    if (filters.graphSort === "topological") {
      return sortLogCommitsTopologically(rawCommits);
    }
    return rawCommits;
  }, [rawCommits, filters.graphSort]);
  const selected = findCommit(commits, selectedSha);
  const displayEntries = useMemo(() => {
    if (expandedLinear) {
      return expandedLinear.map((commit) => ({ kind: "commit" as const, commit }));
    }
    return collapseLinearCommits(commits, Boolean(filters.collapseLinear));
  }, [commits, expandedLinear, filters.collapseLinear]);

  const changedFiles = useMemo(
    () =>
      selected?.changedFiles.map((file) => ({
        path: file.path,
        status: file.status,
      })) ?? [],
    [selected],
  );

  // Align with standalone History Log: commits | files+details | diff
  // (diff stays open in Workspace for hunk actions — History opens Diff Viewer separately)
  const filesAndDetails = (
    <ResizableSplit
      direction="vertical"
      initialPercent={55}
      minFirstPercent={25}
      minSecondPercent={20}
      storageKey="gitView.workspaceLog.filesDetailsSplit"
      className="h-full w-full min-h-0"
      first={
        <div className="h-full w-full min-h-0 overflow-y-auto">
          <GitChangedFilesTree
            files={changedFiles}
            selectedPath={selectedFilePath}
            onSelectFile={(path) => {
              const file = changedFiles.find((f) => f.path === path);
              if (file) {
                onSelectFile(path, file.status);
              }
            }}
          />
        </div>
      }
      second={
        <div
          className="h-full w-full min-h-0 overflow-hidden border-t border-border"
          data-testid="workspace-log-details-pane"
        >
          <GitCommitDetail
            commit={
              selected
                ? {
                    sha: selected.sha,
                    shortSha: selected.shortSha,
                    author: selected.author,
                    authorEmail: selected.authorEmail,
                    authorTime: selected.authorTime,
                    subject: selected.subject,
                    body: selected.body,
                    changedFiles: changedFiles,
                  }
                : null
            }
            detailsOnly
          />
        </div>
      }
    />
  );

  return (
    <div
      className="flex-1 min-h-0 flex flex-col font-[family-name:var(--nx-font-ui)]"
      data-testid="workspace-log-panel"
      data-layout="log"
    >
      <div className="shrink-0 flex flex-col gap-1 px-[var(--nx-pad-x)] py-1 border-b border-border">
        <WorkspaceLogToolbar
          branch={snapshot?.branch}
          loading={loading}
          busy={busy}
          protectedBranch={protectedBranch}
          selected={selected}
          selectedShas={selectedShas}
          onRefresh={onRefresh}
          onUndoLastCommit={onUndoLastCommit}
          onCopyHash={onCopyHash}
          onCreateBranchFromCommit={onCreateBranchFromCommit}
          onResetToCommit={onResetToCommit}
          onCherryPickMultiple={onCherryPickMultiple}
          onCherryPick={onCherryPick}
          onRevertMultiple={onRevertMultiple}
          onRevert={onRevert}
          onEditMessage={onEditMessage}
          onDropCommit={onDropCommit}
          onExtractChanges={onExtractChanges}
          onRewriteCommit={onRewriteCommit}
        />

        <WorkspaceLogFilters
          filters={filters}
          onFiltersChange={onFiltersChange}
          hasUpstream={hasUpstream}
          loading={loading}
          busy={busy}
          onRefresh={onRefresh}
          onExpandedLinearReset={() => setExpandedLinear(null)}
        />
      </div>

      {error && (
        <div className="px-[var(--nx-pad-x)] py-1 text-[length:var(--nx-font-size-ui-sm)] text-[var(--vscode-errorForeground)]">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 flex">
        <ResizableSplit
          direction="horizontal"
          initialPercent={32}
          minFirstPercent={20}
          minSecondPercent={40}
          storageKey="gitView.workspaceLog.mainSplit"
          className="flex-1 min-h-0 w-full"
          first={
            <div className="h-full w-full min-w-0 border-r border-border overflow-y-auto">
              <GitCommitList
                entries={displayEntries}
                selectedSha={selectedSha}
                selectedShas={selectedShas}
                onSelect={(sha, multi) => {
                  setExpandedLinear(null);
                  onSelectCommit(sha, multi);
                }}
                onExpandCollapsed={(linearCommits) =>
                  setExpandedLinear(linearCommits)
                }
                issueTrackerBaseUrl={issueTrackerBaseUrl}
                compactRows={filters.compactRows}
                highlightCurrentBranch={filters.highlightCurrentBranch}
                currentBranchHeadSha={currentBranchHeadSha}
                graphDensity
                loading={loading}
                emptyLabel="No commits in this branch."
              />
            </div>
          }
          second={
            <ResizableSplit
              direction="horizontal"
              initialPercent={38}
              minFirstPercent={22}
              minSecondPercent={30}
              storageKey="gitView.workspaceLog.filesDiffSplit"
              className="flex-1 min-h-0 w-full"
              first={
                <div className="h-full w-full min-w-0 border-r border-border overflow-hidden">
                  {filesAndDetails}
                </div>
              }
              second={
                <div className="h-full w-full min-w-0 overflow-hidden">
                  <WorkspaceDiffPanel
                    document={diffDocument}
                    filePath={selectedFilePath}
                    loading={diffLoading}
                    error={diffError}
                    showLogActions={Boolean(selectedSha && selectedFilePath)}
                    canDropSelected={canDropSelected && !protectedBranchForDrop}
                    onCherryPickHunk={onCherryPickHunk}
                    onRevertHunk={onRevertHunk}
                    onDropHunk={onDropHunk}
                    onCherryPickLines={onCherryPickLines}
                    onRevertLines={onRevertLines}
                    onDropLines={onDropLines}
                    borderless
                  />
                </div>
              }
            />
          }
        />
      </div>
    </div>
  );
}