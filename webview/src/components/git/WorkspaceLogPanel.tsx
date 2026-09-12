import { Button } from "../ui/Button";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Copy, GitCompare, Search } from "lucide-react";
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
import { TextField } from "../ui/TextField";
import { WorkspaceLogFilters } from "./workspaceLogPanel/WorkspaceLogFilters";
import { WorkspaceLogToolbar } from "./workspaceLogPanel/WorkspaceLogToolbar";
import {
  findCommit,
  type WorkspaceLogPanelProps,
} from "./workspaceLogPanel/workspaceLogPanelTypes";

/**
 * Memoized: the log can hold thousands of commits, and the store notifies this
 * panel on every unrelated field change (commit message, stash list, sync
 * progress). Skipping the re-render is only effective while callers keep the
 * props referentially stable — see the render-count test.
 */
export const WorkspaceLogPanel = memo(function WorkspaceLogPanel({
  snapshot,
  loading = false,
  loadingMore = false,
  error = null,
  selectedSha,
  selectedShas = [],
  selectedFilePath,
  diffDocument,
  diffLoading = false,
  diffError = null,
  historyScope = null,
  onSelectCommit,
  onSelectFile,
  onOpenFileDiff,
  onRefresh,
  onLoadMore,
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
  permanentGraph,
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
  onDropHunk,
  onCherryPickLines,
  onRevertLines,
  onDropLines,
}: WorkspaceLogPanelProps) {
  const [expandedLinear, setExpandedLinear] = useState<LogCommitEntry[] | null>(
    null,
  );
  const [filesQuery, setFilesQuery] = useState("");
  const [filesQueryOpen, setFilesQueryOpen] = useState(false);
  const [commitMenu, setCommitMenu] = useState<{
    x: number;
    y: number;
    sha: string;
    subject: string;
  } | null>(null);

  const folderHistory = historyScope?.isFolder === true;
  const fileHistory =
    historyScope?.isFolder === false && historyScope.showDiff !== false;

  const rawCommits = snapshot?.commits ?? [];
  const hasMoreCommits = Boolean(
    snapshot &&
      (snapshot.hasMore ?? rawCommits.length >= (filters.limit ?? 200)),
  );
  useEffect(() => {
    setExpandedLinear(null);
  }, [rawCommits.length]);
  const commits = useMemo(() => {
    if (filters.graphSort === "topological") {
      return sortLogCommitsTopologically(rawCommits);
    }
    return rawCommits;
  }, [rawCommits, filters.graphSort]);
  const selected = findCommit(commits, selectedSha);
  const displayEntries = useMemo(() => {
    if (expandedLinear) {
      return expandedLinear.map((commit) => ({
        kind: "commit" as const,
        commit,
      }));
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
      if (activate || folderHistory) {
        onOpenFileDiff?.(path, file.status);
      }
    },
    [changedFiles, folderHistory, onSelectFile, onOpenFileDiff],
  );

  const handleSelectFile = useCallback(
    (path: string) => openFile(path, false),
    [openFile],
  );
  const handleActivateFile = useCallback(
    (path: string) => openFile(path, true),
    [openFile],
  );

  const handleCommitScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      if (!onLoadMore || loadingMore || !hasMoreCommits) {
        return;
      }
      const element = event.currentTarget;
      if (element.clientHeight <= 0) {
        return;
      }
      // Prefetch while the viewport still has about two screens of commits
      // below it, so the next page is laid out before the user reaches it.
      const distanceFromBottom =
        element.scrollHeight - element.scrollTop - element.clientHeight;
      if (distanceFromBottom <= Math.max(480, element.clientHeight * 2)) {
        void onLoadMore();
      }
    },
    [hasMoreCommits, loadingMore, onLoadMore],
  );

  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const element = scrollRef.current;
    if (
      !element ||
      !onLoadMore ||
      loadingMore ||
      !hasMoreCommits ||
      element.clientHeight <= 0
    ) {
      return;
    }
    const distanceFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    if (distanceFromBottom <= Math.max(480, element.clientHeight * 2)) {
      void onLoadMore();
    }
  }, [hasMoreCommits, loadingMore, onLoadMore, rawCommits.length]);

  const changedFilesTree = (
    <GitChangedFilesTree
      files={changedFiles}
      selectedPath={selectedFilePath}
      onSelectFile={handleSelectFile}
      onActivateFile={handleActivateFile}
    />
  );

  const paneIconBtn =
    "h-row w-row shrink-0 flex items-center justify-center rounded-vscode text-vscode-description hover:bg-list-hover hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent";

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
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
        data-testid="workspace-log-commits-scroll"
        onScroll={handleCommitScroll}
      >
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
          permanentGraph={permanentGraph}
          loading={loading || !snapshot}
          emptyLabel="No commits in this branch."
        />
        {loadingMore && hasMoreCommits ? (
          <div
            className="px-3 py-1 text-center text-ui-sm text-vscode-description"
            aria-live="polite"
            data-testid="workspace-log-loading-more"
          >
            Loading older commits…
          </div>
        ) : null}
      </div>
    </div>
  );

  const filesColumn = (
    <div
      className="h-full min-h-0 min-w-0 flex flex-col"
      data-testid="workspace-log-files-pane"
    >
      <div className="shrink-0 h-8 min-h-8 flex items-center justify-between px-2 border-b border-border text-ui-base text-vscode-description">
        <span>
          {selected
            ? `${changedFiles.length} ${changedFiles.length === 1 ? "file" : "files"}`
            : "No commit selected"}
        </span>
        <div className="flex items-center gap-0.5">
          {!folderHistory ? (
            <Button variant="ghost" size="content"
              type="button"
              className={paneIconBtn}
              title="Compare / show diff"
              disabled={!selectedFilePath}
              onClick={() => selectedFilePath && openFile(selectedFilePath, true)}
              data-testid="workspace-log-open-diff"
            >
              <GitCompare size={14} aria-hidden />
            </Button>
          ) : null}
          <Button variant="ghost" size="content"
            type="button"
            className={`${paneIconBtn} ${filesQueryOpen ? "text-foreground bg-list-hover" : ""}`}
            title="Filter files"
            aria-pressed={filesQueryOpen}
            onClick={() => setFilesQueryOpen((open) => !open)}
            data-testid="workspace-log-search-files"
          >
            <Search size={14} aria-hidden />
          </Button>
        </div>
      </div>
      {filesQueryOpen ? (
        <div className="shrink-0 h-toolbar px-2 flex items-center border-b border-border bg-vscode-sidebar-bg">
          <TextField
            type="search"
            size="compact"
            containerClassName="w-full"
            inputClassName="text-ui-sm"
            aria-label="Filter changed files"
            placeholder="Filter files"
            value={filesQuery}
            onChange={(e) => setFilesQuery(e.target.value)}
            data-testid="workspace-log-files-filter"
            autoFocus
          />
        </div>
      ) : null}
      <div className="flex-1 min-h-0 overflow-y-auto py-1">
        {changedFilesTree}
      </div>
      <div
        className="shrink-0 max-h-log-details-max overflow-y-auto border-t border-border px-2.5 py-1.5 flex flex-col gap-1 bg-vscode-sidebar-bg"
        data-testid="workspace-log-details-pane"
      >
        {selected ? (
          <>
            <span className="text-ui-base font-semibold leading-5 truncate">
              {selected.subject}
            </span>
            <span className="flex items-center gap-1.5 text-ui leading-4 whitespace-nowrap overflow-hidden">
              <span>{selected.shortSha}</span>
              <span>{selected.author}</span>
              {selected.authorEmail ? (
                <a
                  href={`mailto:${selected.authorEmail}`}
                  className="truncate text-vscode-link hover:underline"
                  title={selected.authorEmail}
                  data-testid="workspace-log-author-email"
                >
                  {selected.authorEmail}
                </a>
              ) : null}
              <span>{formatRelativeTime(selected.authorTime)}</span>
            </span>
          </>
        ) : (
          <span className="text-ui-sm text-vscode-description">
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
      second={fileHistory ? (
        <div
          className="h-full min-h-0 min-w-0 overflow-hidden flex flex-col"
          data-testid="workspace-log-diff-pane"
          data-layout="file-history"
        >
          <WorkspaceDiffPanel
            document={diffDocument}
            filePath={selectedFilePath}
            loading={diffLoading}
            error={diffError}
            showLogActions={Boolean(selectedSha && selectedFilePath)}
            canDropSelected={canDropSelected && !protectedBranchForDrop}
            onDropHunk={onDropHunk}
            onCherryPickLines={onCherryPickLines}
            onRevertLines={onRevertLines}
            onDropLines={onDropLines}
          />
        </div>
      ) : filesColumn}
    />
  );

  return (
    <div
      className="relative flex-1 min-h-0 flex flex-col font-ui"
      data-testid="workspace-log-panel"
      data-layout="log"
    >
      {error && (
        <div className="absolute top-8 left-0 right-0 z-10 mx-2 rounded-vscode border border-danger-border bg-danger-bg px-3 py-2 text-ui leading-4 text-danger-fg shadow-md flex items-start gap-2">
          <AlertCircle size={14} className="shrink-0 mt-0.5" aria-hidden />
          <span className="flex-1 min-w-0 break-words whitespace-pre-wrap">
            {error.includes("timed out")
              ? "Request timed out. The repository may be large or Git is busy. Please try again."
              : error}
          </span>
          <Button variant="primary" size="content"
            type="button"
            className="shrink-0 rounded-vscode px-2 py-0.5 text-ui-sm font-medium bg-primary text-primary-foreground hover:bg-primary-hover"
            onClick={onRefresh}
            data-testid="workspace-log-retry"
          >
            Retry
          </Button>
        </div>
      )}
      {columns}
      <ContextMenu
        menu={
          commitMenu
            ? { visible: true, x: commitMenu.x, y: commitMenu.y }
            : null
        }
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
