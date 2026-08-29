import { memo, useCallback, useMemo, useState } from "react";
import { AlertCircle, Copy, Eye, GitCompare, Search } from "lucide-react";
import { ContextMenu } from "../ui/ContextMenu";
import { MenuItem } from "../ui/MenuItem";
import type { LogCommitEntry } from "@gitview/shared/types/log";
import { collapseLinearCommits } from "../../lib/collapseLinearCommits";
import { sortLogCommitsTopologically } from "../../lib/sortLogCommits";
import { formatRelativeTime } from "./gitPanelFormat";
import { GitCommitList } from "./GitCommitList";
import { GitChangedFilesTree } from "./GitChangedFilesTree";
import { WorkspaceDiffPanel } from "./WorkspaceDiffPanel";
import { ResizableSplit } from "../ui/ResizableSplit";
import { WorkspaceLogFilters } from "./workspaceLogPanel/WorkspaceLogFilters";
import { WorkspaceLogToolbar } from "./workspaceLogPanel/WorkspaceLogToolbar";
import { findCommit, type WorkspaceLogPanelProps } from "./workspaceLogPanel/workspaceLogPanelTypes";

/**
 * Memoized: the log can hold thousands of commits, and the store notifies this
 * panel on every unrelated field change (commit message, stash list, sync
 * progress). Skipping the re-render is only effective while callers keep the
 * props referentially stable — see the render-count test.
 */
export const WorkspaceLogPanel = memo(function WorkspaceLogPanel({
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
  onOpenFileDiff,
  onRefresh,
  filters,
  onFiltersChange,
  busy = false,
  protectedBranch = false,
  hasUpstream = false,
  branches = [],
  authors = [],
  pathOptions = [],
  onBranchMenuOpen,
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
  const [diffPaneOpen, setDiffPaneOpen] = useState(false);
  const [filesQuery, setFilesQuery] = useState("");
  const [filesQueryOpen, setFilesQueryOpen] = useState(false);
  const [commitMenu, setCommitMenu] = useState<{
    x: number;
    y: number;
    sha: string;
    subject: string;
  } | null>(null);

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

  const changedFiles = useMemo(() => {
    const files =
      selected?.changedFiles.map((file) => ({
        path: file.path,
        status: file.status,
      })) ?? [];
    const query = filesQuery.trim().toLowerCase();
    if (!query) {
      return files;
    }
    return files.filter((file) => file.path.toLowerCase().includes(query));
  }, [selected, filesQuery]);

  // Every handler below is memoized for one reason: GitCommitRow and TreeRow are
  // `memo` components, and an inline arrow would give each of them a new prop
  // identity on every render, re-rendering the whole log for a change that
  // touches one row. Keep these stable or the memo becomes dead code.
  const resetExpandedLinear = useCallback(() => setExpandedLinear(null), []);

  const handleSelectCommit = useCallback(
    (sha: string, multi?: boolean) => {
      setExpandedLinear(null);
      onSelectCommit(sha, multi);
    },
    [onSelectCommit],
  );

  const handleCommitContextMenu = useCallback(
    (event: React.MouseEvent, commit: LogCommitEntry) => {
      event.preventDefault();
      setCommitMenu({
        x: event.clientX,
        y: event.clientY,
        sha: commit.sha,
        subject: commit.subject,
      });
    },
    [],
  );

  const openFile = useCallback(
    (path: string, activate: boolean) => {
      const file = changedFiles.find((f) => f.path === path);
      if (!file) {
        return;
      }
      onSelectFile(path, file.status);
      if (activate) {
        onOpenFileDiff?.(path, file.status);
      }
    },
    [changedFiles, onSelectFile, onOpenFileDiff],
  );

  const handleSelectFile = useCallback(
    (path: string) => openFile(path, false),
    [openFile],
  );
  const handleActivateFile = useCallback(
    (path: string) => openFile(path, true),
    [openFile],
  );

  const changedFilesTree = (
    <GitChangedFilesTree
      files={changedFiles}
      selectedPath={selectedFilePath}
      onSelectFile={handleSelectFile}
      onActivateFile={handleActivateFile}
    />
  );

  const paneIconBtn =
    "h-[22px] w-[22px] shrink-0 flex items-center justify-center rounded-sm text-vscode-description hover:bg-list-hover hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent";

  const commitColumn = (
    <div className="h-full min-h-0 min-w-0 overflow-hidden flex flex-col">
      <div
        className="shrink-0 min-h-8 flex items-center gap-2 px-2 border-b border-border overflow-visible"
        data-testid="log-filter-bar"
      >
        <WorkspaceLogFilters
          filters={filters}
          onFiltersChange={onFiltersChange}
          hasUpstream={hasUpstream}
          onExpandedLinearReset={resetExpandedLinear}
          branches={branches}
          authors={authors}
          paths={pathOptions}
          onBranchMenuOpen={onBranchMenuOpen}
        />
        <WorkspaceLogToolbar
          loading={loading}
          busy={busy}
          filters={filters}
          onFiltersChange={onFiltersChange}
          onExpandedLinearReset={resetExpandedLinear}
          onRefresh={onRefresh}
        />
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <GitCommitList
          entries={displayEntries}
          selectedSha={selectedSha}
          selectedShas={selectedShas}
          onSelect={handleSelectCommit}
          onContextMenu={handleCommitContextMenu}
          onExpandCollapsed={setExpandedLinear}
          issueTrackerBaseUrl={issueTrackerBaseUrl}
          compactRows={filters.compactRows}
          highlightCurrentBranch={filters.highlightCurrentBranch}
          currentBranchHeadSha={currentBranchHeadSha}
          graphDensity
          loading={loading}
          emptyLabel="No commits in this branch."
        />
      </div>
    </div>
  );

  const filesColumn = (
    <div className="h-full min-h-0 min-w-0 flex flex-col" data-testid="workspace-log-files-pane">
      <div className="shrink-0 h-8 min-h-8 flex items-center justify-between px-2 border-b border-border text-[length:var(--vscode-font-size,13px)] text-vscode-description">
        <span>
          {selected
            ? `${changedFiles.length} ${changedFiles.length === 1 ? "file" : "files"}`
            : "No commit selected"}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className={paneIconBtn}
            title="Compare / show diff"
            disabled={!selectedFilePath}
            onClick={() => selectedFilePath && openFile(selectedFilePath, true)}
            data-testid="workspace-log-open-diff"
          >
            <GitCompare size={13} aria-hidden />
          </button>
          <button
            type="button"
            className={paneIconBtn}
            title="Toggle inline diff"
            aria-pressed={diffPaneOpen}
            disabled={!selectedFilePath}
            onClick={() => setDiffPaneOpen((open) => !open)}
            data-testid="workspace-log-toggle-diff"
          >
            <Eye size={13} aria-hidden />
          </button>
          <button
            type="button"
            className={`${paneIconBtn} ${filesQueryOpen ? "text-foreground bg-list-hover" : ""}`}
            title="Filter files"
            aria-pressed={filesQueryOpen}
            onClick={() => setFilesQueryOpen((open) => !open)}
            data-testid="workspace-log-search-files"
          >
            <Search size={13} aria-hidden />
          </button>
        </div>
      </div>
      {filesQueryOpen ? (
        <div className="shrink-0 h-[28px] px-2 flex items-center border-b border-border bg-[var(--vscode-sideBar-background,var(--background))]">
          <input
            type="text"
            className="h-6 w-full px-1.5 text-[11px] leading-none rounded-sm border border-[var(--vscode-input-border,var(--border))] bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground,var(--vscode-editor-foreground))] placeholder:text-[var(--vscode-input-placeholderForeground,var(--vscode-descriptionForeground))] outline-none"
            placeholder="Filter files"
            value={filesQuery}
            onChange={(e) => setFilesQuery(e.target.value)}
            data-testid="workspace-log-files-filter"
            autoFocus
          />
        </div>
      ) : null}
      <div className="flex-1 min-h-0 overflow-y-auto py-1">{changedFilesTree}</div>
      <div
        className="shrink-0 max-h-[96px] overflow-y-auto border-t border-border px-2.5 py-1.5 flex flex-col gap-1 bg-[var(--vscode-sideBar-background,var(--background))]"
        data-testid="workspace-log-details-pane"
      >
        {selected ? (
          <>
            <span className="text-[length:var(--vscode-font-size,13px)] font-semibold leading-5 truncate">
              {selected.subject}
            </span>
            <span className="flex items-center gap-1.5 text-[12px] leading-4 whitespace-nowrap overflow-hidden">
              <span>{selected.shortSha}</span>
              <span>{selected.author}</span>
              {selected.authorEmail ? (
                <a
                  href={`mailto:${selected.authorEmail}`}
                  className="truncate text-[var(--vscode-textLink-foreground)] hover:underline"
                  title={selected.authorEmail}
                  data-testid="workspace-log-author-email"
                >
                  {selected.authorEmail}
                </a>
              ) : null}
              <span>{formatRelativeTime(selected.authorTime)}</span>
            </span>
            {(selected.refs ?? []).length > 0 && (
              <span className="flex items-center gap-1.5 flex-wrap">
                {(selected.refs ?? []).map((ref) => (
                  <span
                    key={ref}
                    className="inline-flex items-center h-[16px] px-1.5 rounded-full border border-border text-[10px] leading-none text-vscode-description"
                  >
                    {ref}
                  </span>
                ))}
              </span>
            )}
          </>
        ) : (
          <span className="text-[length:var(--nx-font-size-ui-sm)] text-vscode-description">
            Select a commit to view details.
          </span>
        )}
      </div>
    </div>
  );

  const columns = (
    <ResizableSplit
      direction="horizontal"
      initialPercent={62}
      minFirstPercent={32}
      minSecondPercent={22}
      storageKey="gitView.workspaceLog.columnsSplit"
      className="flex-1 min-h-0 w-full"
      first={commitColumn}
      second={filesColumn}
    />
  );

  const diffPane =
    diffPaneOpen && selectedFilePath ? (
      <div
        className="h-full min-h-0 overflow-hidden border-t border-border"
        data-testid="workspace-log-diff-pane"
      >
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
        />
      </div>
    ) : null;

  return (
    <div
      className="relative flex-1 min-h-0 flex flex-col font-[family-name:var(--nx-font-ui)]"
      data-testid="workspace-log-panel"
      data-layout="log"
    >
      {error && (
        <div className="absolute top-8 left-0 right-0 z-10 mx-2 rounded-sm border border-[var(--vscode-inputValidation-errorBorder,var(--vscode-errorForeground))] bg-[var(--vscode-inputValidation-errorBackground,var(--vscode-editor-background))] px-3 py-2 text-[12px] leading-4 text-[var(--vscode-errorForeground)] shadow-md flex items-start gap-2">
          <AlertCircle size={14} className="shrink-0 mt-0.5" aria-hidden />
          <span className="flex-1 min-w-0 break-words whitespace-pre-wrap">
            {error.includes("timed out")
              ? "Request timed out. The repository may be large or Git is busy. Please try again."
              : error}
          </span>
          <button
            type="button"
            className="shrink-0 rounded-sm px-2 py-0.5 text-[11px] font-medium bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]"
            onClick={onRefresh}
            data-testid="workspace-log-retry"
          >
            Retry
          </button>
        </div>
      )}
      {diffPane ? (
        <ResizableSplit
          direction="vertical"
          initialPercent={52}
          minFirstPercent={28}
          minSecondPercent={28}
          storageKey="gitView.workspaceLog.diffSplit"
          className="flex-1 min-h-0 w-full"
          first={columns}
          second={diffPane}
        />
      ) : (
        columns
      )}
      <ContextMenu
        menu={commitMenu ? { visible: true, x: commitMenu.x, y: commitMenu.y } : null}
        onClose={() => setCommitMenu(null)}
        testId="workspace-log-commit-menu"
        ariaLabel="Commit actions"
        minWidth={200}
      >
        {commitMenu && onCopyHash ? (
          <MenuItem
            label="Copy hash"
            testId="log-copy-hash"
            icon={<Copy size={14} aria-hidden />}
            onClick={() => {
              onCopyHash(commitMenu.sha);
              setCommitMenu(null);
            }}
          />
        ) : null}
        {commitMenu && onCherryPick && selectedShas.length <= 1 ? (
          <MenuItem
            label="Cherry-pick"
            testId="log-cherry-pick"
            onClick={() => {
              onCherryPick(commitMenu.sha);
              setCommitMenu(null);
            }}
          />
        ) : null}
        {commitMenu && onRevert && selectedShas.length <= 1 ? (
          <MenuItem
            label="Revert"
            testId="log-revert"
            disabled={protectedBranch}
            onClick={() => {
              onRevert(commitMenu.sha);
              setCommitMenu(null);
            }}
          />
        ) : null}
        {commitMenu && onRewriteCommit ? (
          <>
            <MenuItem
              label="Squash into parent"
              testId="log-squash-commit"
              disabled={protectedBranch}
              onClick={() => {
                onRewriteCommit(commitMenu.sha, "squash");
                setCommitMenu(null);
              }}
            />
            <MenuItem
              label="Fixup into parent"
              testId="log-fixup-commit"
              disabled={protectedBranch}
              onClick={() => {
                onRewriteCommit(commitMenu.sha, "fixup");
                setCommitMenu(null);
              }}
            />
          </>
        ) : null}
        {commitMenu && onCreateBranchFromCommit ? (
          <MenuItem
            label="New branch from commit"
            testId="log-create-branch"
            onClick={() => {
              onCreateBranchFromCommit(commitMenu.sha);
              setCommitMenu(null);
            }}
          />
        ) : null}
        {commitMenu && onResetToCommit ? (
          <MenuItem
            label="Reset here"
            testId="log-reset"
            disabled={protectedBranch}
            onClick={() => {
              onResetToCommit(commitMenu.sha, "mixed");
              setCommitMenu(null);
            }}
          />
        ) : null}
        {commitMenu && onEditMessage ? (
          <MenuItem
            label="Edit message"
            testId="log-edit-message"
            disabled={protectedBranch}
            onClick={() => {
              onEditMessage(commitMenu.sha, commitMenu.subject);
              setCommitMenu(null);
            }}
          />
        ) : null}
        {commitMenu && onDropCommit ? (
          <MenuItem
            label="Drop commit"
            testId="log-drop-commit"
            disabled={protectedBranch}
            onClick={() => {
              onDropCommit(commitMenu.sha);
              setCommitMenu(null);
            }}
          />
        ) : null}
        {commitMenu && onExtractChanges ? (
          <MenuItem
            label="Extract changes"
            testId="log-extract-changes"
            disabled={protectedBranch}
            onClick={() => {
              onExtractChanges(commitMenu.sha);
              setCommitMenu(null);
            }}
          />
        ) : null}
        {commitMenu && onUndoLastCommit ? (
          <MenuItem
            label="Undo last commit"
            testId="log-undo-last-commit"
            disabled={busy || protectedBranch}
            onClick={() => {
              onUndoLastCommit();
              setCommitMenu(null);
            }}
          />
        ) : null}
        {commitMenu && selectedShas.length > 1 && onCherryPickMultiple ? (
          <MenuItem
            label={`Cherry-pick ${selectedShas.length} commits`}
            testId="log-cherry-pick-multiple"
            onClick={() => {
              onCherryPickMultiple(selectedShas);
              setCommitMenu(null);
            }}
          />
        ) : null}
        {commitMenu && selectedShas.length > 1 && onRevertMultiple ? (
          <MenuItem
            label={`Revert ${selectedShas.length} commits`}
            testId="log-revert-multiple"
            disabled={protectedBranch}
            onClick={() => {
              onRevertMultiple(selectedShas);
              setCommitMenu(null);
            }}
          />
        ) : null}
      </ContextMenu>
    </div>
  );
});
