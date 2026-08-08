import { useEffect, useMemo, useState } from "react";
import { useGitHistoryStore } from "../stores/gitHistoryStore";
import { useVsCodeApi } from "../hooks/useVsCodeApi";
import { createProtocolClient } from "../protocol/client";
import { logSnapshotToStorePayload, workspaceDiffToFileDiffView } from "../apps/historyBlameAdapters";
import { GitCommitList } from "../components/git/GitCommitList";
import { GitChangedFilesTree } from "../components/git/GitChangedFilesTree";
import { GitCommitDetail } from "../components/git/GitCommitDetail";
import { GitHistoryCommitMenuItems } from "../components/git/GitHistoryCommitMenuItems";
import { GitHistoryFileMenuItems } from "../components/git/GitHistoryFileMenuItems";
import { GitHistoryDiffViewer } from "../components/git/GitHistoryDiffViewer";
import { LogBranchTree } from "../components/git/LogBranchTree";
import { findCommit } from "../components/git/gitPanelFormat";
import { ContextMenu } from "../components/ui/ContextMenu";
import { ResizableSplit } from "../components/ui/ResizableSplit";
import { cn } from "../lib/cn";
import type { GitChangedFile, GitCommitEntry, GitMenuAction } from "@gitview/types";

/**
 * Git tool window body — three-pane Log layout.
 *
 * Left: branch tree · Center: graph + commits · Right: files + details
 * Diff: Ctrl+D — not the default right pane
 */

function parentDir(filePath: string): string {
  const slash = filePath.lastIndexOf("/");
  return slash <= 0 ? filePath : filePath.slice(0, slash);
}

function annotateScopePath(
  files: readonly GitChangedFile[],
  selectedPath: string | null,
  highlightPath?: string,
): string | null {
  const focus = selectedPath ?? highlightPath ?? files[0]?.path;
  if (!focus) {
    return null;
  }
  return parentDir(focus);
}

function filesInScope(
  files: readonly GitChangedFile[],
  scopePath: string | null,
): number {
  if (!scopePath) {
    return files.length;
  }
  const prefix = `${scopePath}/`;
  return files.filter(
    (f) => f.path === scopePath || f.path.startsWith(prefix),
  ).length;
}

function formatCommitTimestamp(authorTimeSec: number): string {
  const d = new Date(authorTimeSec * 1000);
  return `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(-2)}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
type CommitMenuState = {
  visible: boolean;
  x: number;
  y: number;
  commit: GitCommitEntry;
};

type FileMenuState = {
  visible: boolean;
  x: number;
  y: number;
  filePath: string;
};

type GitHistoryToolWindowProps = {
  /** Embedded in history/blame shell — use parent size instead of viewport. */
  embedded?: boolean;
  /** Current / HEAD revision for annotate rows. */
  currentSha?: string | null;
  /** Annotate shell: two equal columns, never show inline diff preview. */
  twoPaneLayout?: boolean;
};

export function GitHistoryToolWindow({
  embedded = false,
  currentSha = null,
  twoPaneLayout = false,
}: GitHistoryToolWindowProps = {}) {
  const state = useGitHistoryStore();
  const repoId = useGitHistoryStore((s) => s.repoId);
  const { postMessage } = useVsCodeApi();
  const client = useMemo(() => createProtocolClient(postMessage), [postMessage]);
  const [commitMenu, setCommitMenu] = useState<CommitMenuState | null>(null);
  const [fileMenu, setFileMenu] = useState<FileMenuState | null>(null);

  // `filteredCommits()` allocates, and this array's identity gates the
  // commit-graph layout memo downstream, so key it on the inputs it reads.
  const { filteredCommits, searchQuery, authorFilter } = state;
  const filtered = useMemo(
    () => filteredCommits(),
    [filteredCommits, state.commits, searchQuery, authorFilter],
  );
  const selected = findCommit(state.commits, state.selectedSha);
  const changedFiles = state.changedFilesForSelection();
  const annotateMode = state.annotateMode;
  const twoPane = twoPaneLayout || annotateMode;
  /** Log-style main view (file/folder history): graph commits | files + details. */
  const logLayout = !twoPane;
  const showDiffPane = logLayout && state.showDiffPreview;
  const commitDetailLoading = state.commitDetailLoading;
  const title = annotateMode
    ? `Log on ${state.branchFilter || "HEAD"}`
    : state.isFolder
      ? `History: ${state.path}/`
      : state.path
        ? `History: ${state.path.split("/").pop() ?? state.path}`
        : "Log";

  useEffect(() => {
    if (!state.path || !state.loading || !repoId) {
      return;
    }
    void client
      .queryLog(repoId, {
        path: state.path,
        isFolder: state.isFolder,
        limit: annotateMode ? 500 : 200,
        branch: state.branchFilter || undefined,
        ...(annotateMode ? { scope: "repo" as const } : {}),
      })
      .then((response) => {
        const snapshot = response;
        useGitHistoryStore.getState().setLogResult(logSnapshotToStorePayload(snapshot));
      })
      .catch((err) => {
        useGitHistoryStore.getState().setLogResult({
          error: err instanceof Error ? err.message : String(err),
        });
      });
  }, [
    state.path,
    state.isFolder,
    state.loading,
    state.branchFilter,
    annotateMode,
    repoId,
    client,
  ]);

  useEffect(() => {
    if (
      !repoId ||
      !state.selectedSha ||
      !state.showDiffPreview ||
      !state.selectedChangedFilePath ||
      !state.patchLoading
    ) {
      return;
    }
    const sha = state.selectedSha;
    const path = state.selectedChangedFilePath;
    void client
      .logFileDiff(repoId, sha, path, state.selectedChangedFileStatus())
      .then((response) => {
        const document = response;
        useGitHistoryStore.getState().setFileDiffResult({
          sha,
          path,
          diff: workspaceDiffToFileDiffView(document),
        });
      })
      .catch((err) => {
        useGitHistoryStore.getState().setFileDiffResult({
          sha,
          path,
          error: err instanceof Error ? err.message : String(err),
        });
      });
  }, [
    state.selectedSha,
    state.selectedChangedFilePath,
    state.showDiffPreview,
    state.patchLoading,
    repoId,
    client,
  ]);

  const refresh = () => {
    useGitHistoryStore.setState({ loading: true, error: null });
  };

  const openRevisionDiffTab = (filePath: string, commitSha: string) => {
    // Read from store so keyboard shortcuts registered with [] deps still see
    // the current repoId after history.init (stale closure otherwise no-ops).
    const id = useGitHistoryStore.getState().repoId;
    if (!id) {
      return;
    }
    const annotate = useGitHistoryStore.getState().annotateMode;
    void client.gitMenuAction(id, {
      action: "showRevisionDiff",
      relativePath: filePath,
      commitSha,
      isFolder: false,
      ...(annotate ? { openInActiveColumn: true } : {}),
    });
  };

  const handleSelectCommit = (sha: string | null) => {
    state.selectCommit(sha);
    if (annotateMode && sha && repoId) {
      void client.commitDetail(repoId, sha).then((response) => {
        const payload = response;
        if (payload.error) {
          useGitHistoryStore.getState().setCommitDetailError(payload.error.message);
        } else if (payload.commit) {
          useGitHistoryStore.getState().applyCommitDetail(payload.commit);
        }
      });
    }
  };

  const handleSelectChangedFile = (filePath: string) => {
    const store = useGitHistoryStore.getState();
    const { selectedSha, annotateMode: annotate } = store;
    // Show History: ensure inline diff pane is on, then load parent↔commit diff.
    // Annotate: open full Diff Viewer tab (no inline preview).
    if (annotate) {
      store.selectChangedFile(filePath);
      if (selectedSha) {
        openRevisionDiffTab(filePath, selectedSha);
      }
      return;
    }
    if (!store.showDiffPreview) {
      useGitHistoryStore.setState({ showDiffPreview: true });
    }
    useGitHistoryStore.getState().selectChangedFile(filePath);
  };

  const openFullDiffForSelection = () => {
    const { selectedSha, selectedChangedFilePath } =
      useGitHistoryStore.getState();
    if (!selectedSha || !selectedChangedFilePath) {
      return;
    }
    openRevisionDiffTab(selectedChangedFilePath, selectedSha);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "d" && e.key !== "D") {
        return;
      }
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) {
        return;
      }
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }
      e.preventDefault();
      openFullDiffForSelection();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const historyFilePath = state.isFolder ? undefined : state.path;

  const dispatchGitAction = (
    action: GitMenuAction,
    opts?: {
      commitSha?: string;
      commitMessage?: string;
      relativePath?: string;
    },
  ) => {
    if (!repoId) {
      return;
    }
    void client.gitMenuAction(repoId, {
      action,
      relativePath: opts?.relativePath ?? historyFilePath,
      commitSha: opts?.commitSha,
      commitMessage: opts?.commitMessage,
      isFolder: false,
    });
  };

  return (
    <div
      className={`${
        embedded ? "h-full w-full" : "h-screen w-screen"
      } flex flex-col bg-[var(--vscode-editor-background)] text-[var(--vscode-editor-foreground)]`}
      data-testid="git-history-tool-window"
    >
      <div className="nx-tool-titlebar shrink-0 flex items-center gap-1.5 px-[var(--nx-pad-x)] h-[var(--nx-toolbar-h)] min-h-[var(--nx-toolbar-h)] border-b border-border text-[length:var(--nx-font-size-ui)] font-[family-name:var(--nx-font-ui)]">
        <span className="font-semibold truncate shrink-0 max-w-[180px]" title={title}>
          {title}
        </span>
        {!state.isFolder && state.path.includes("/") ? (
          <span
            className="text-[length:var(--nx-font-size-ui-sm)] text-vscode-description truncate min-w-0 max-w-[28%]"
            title={state.path}
          >
            {state.path}
          </span>
        ) : null}
        <span className="flex-1 min-w-2" />
        <input
          type="search"
          placeholder="Search"
          className="w-[120px] shrink-0 h-[22px] px-1.5 text-[length:var(--nx-font-size-ui-sm)] rounded-[var(--nx-menu-radius)] border border-border bg-[var(--vscode-input-background)]"
          value={state.searchQuery}
          onChange={(e) => state.setSearchQuery(e.target.value)}
          data-testid="git-history-search"
        />
        <button
          type="button"
          className={cn(
            "h-[22px] px-1.5 shrink-0 text-[length:var(--nx-font-size-ui-sm)] rounded-[var(--nx-menu-radius)] border border-border hover:bg-list-hover",
            state.branchTreeOpen && "bg-list-hover",
          )}
          onClick={() => state.setBranchTreeOpen(!state.branchTreeOpen)}
          data-testid="git-history-toggle-branches"
          title={
            state.branchTreeOpen
              ? "Hide branch tree"
              : "Show branch tree"
          }
          aria-pressed={state.branchTreeOpen}
        >
          Branches
        </button>
        <label className="flex items-center gap-1 shrink-0 text-vscode-description text-[length:var(--nx-font-size-ui-sm)]">
          Branch:
          <select
            className="h-[22px] max-w-[110px] px-1 text-[length:var(--nx-font-size-ui-sm)] rounded-[var(--nx-menu-radius)] border border-border bg-[var(--vscode-dropdown-background)] text-[var(--vscode-dropdown-foreground)]"
            value={state.branchFilter}
            onChange={(e) => state.setBranchFilter(e.target.value)}
            data-testid="git-history-branch-filter"
            title="Branch filter"
          >
            <option value="">All</option>
            {state.branches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 shrink-0 text-vscode-description text-[length:var(--nx-font-size-ui-sm)]">
          User:
          <select
            className="h-[22px] max-w-[110px] px-1 text-[length:var(--nx-font-size-ui-sm)] rounded-[var(--nx-menu-radius)] border border-border bg-[var(--vscode-dropdown-background)] text-[var(--vscode-dropdown-foreground)]"
            value={state.authorFilter}
            onChange={(e) => state.setAuthorFilter(e.target.value)}
            data-testid="git-history-author-filter"
            title="User"
          >
            <option value="">All</option>
            {[...new Set(state.commits.map((c) => c.author))]
              .sort()
              .map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
          </select>
        </label>
        <label className="flex items-center gap-1 shrink-0 text-vscode-description text-[length:var(--nx-font-size-ui-sm)]">
          Paths:
          <span
            className="h-[22px] max-w-[120px] px-1.5 inline-flex items-center truncate text-[length:var(--nx-font-size-ui-sm)] rounded-[var(--nx-menu-radius)] border border-border bg-[var(--vscode-input-background)] text-foreground"
            title={state.path || "All"}
            data-testid="git-history-paths-filter"
          >
            {state.path ? state.path.split("/").pop() : "All"}
          </span>
        </label>
        <button
          type="button"
          className="h-[22px] px-1.5 shrink-0 text-[length:var(--nx-font-size-ui-sm)] rounded-[var(--nx-menu-radius)] border border-border hover:bg-list-hover"
          onClick={refresh}
          data-testid="git-history-refresh"
          title="Refresh"
        >
          Refresh
        </button>
      </div>

      {state.error && (
        <div className="px-3 py-1.5 text-[12px] text-[var(--vscode-errorForeground,#f48771)] border-b border-border shrink-0">
          {state.error}
        </div>
      )}

      {(() => {
        const scopePath = twoPane
          ? annotateScopePath(
              changedFiles,
              state.selectedChangedFilePath,
              state.isFolder ? undefined : state.path,
            )
          : null;
        const scopeCount = twoPane
          ? filesInScope(changedFiles, scopePath)
          : changedFiles.length;

        const openCommitMenu = (e: React.MouseEvent, commit: GitCommitEntry) => {
          setFileMenu(null);
          setCommitMenu({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            commit,
          });
        };

        // Center: commit graph + list (JB Log main pane)
        const commitPane = (
          <div className="h-full w-full min-h-0 min-w-0 overflow-y-auto bg-[var(--vscode-editor-background)]">
            <GitCommitList
              commits={filtered}
              selectedSha={state.selectedSha}
              onSelect={handleSelectCommit}
              graphDensity
              currentSha={annotateMode ? currentSha : null}
              onContextMenu={openCommitMenu}
              loading={state.loading}
              emptyLabel={
                state.isFolder
                  ? "No commits touched this folder on the selected branch."
                  : state.path
                    ? "No commits touched this file on the selected branch."
                    : "No commits found."
              }
            />
          </div>
        );

        // Right top: changed files only (JB Log right pane)
        const changedFilesPane = (
          <div className="h-full w-full min-w-0 overflow-hidden flex flex-col min-h-0 bg-[var(--vscode-sideBar-background,var(--vscode-editor-background))]">
            {twoPane && scopePath ? (
              <div
                className="px-2 py-0.5 h-[var(--nx-toolbar-h)] flex items-center border-b border-border text-[length:var(--nx-font-size-ui-sm)] text-[var(--vscode-descriptionForeground)] shrink-0 truncate"
                data-testid="git-annotate-scope-header"
              >
                {scopePath}{" "}
                <span className="opacity-80">
                  ({scopeCount} file{scopeCount === 1 ? "" : "s"})
                </span>
              </div>
            ) : null}
            {commitDetailLoading ? (
              <div className="px-2 py-1 text-[length:var(--nx-font-size-ui-sm)] text-[var(--vscode-descriptionForeground)]">
                Loading changed files…
              </div>
            ) : selected ? (
              <div className="flex-1 min-h-0 overflow-y-auto w-full">
                <GitChangedFilesTree
                  files={changedFiles}
                  selectedPath={state.selectedChangedFilePath}
                  highlightPath={state.isFolder ? undefined : state.path}
                  onSelectFile={handleSelectChangedFile}
                  onContextMenuFile={(e, filePath) => {
                    setCommitMenu(null);
                    setFileMenu({
                      visible: true,
                      x: e.clientX,
                      y: e.clientY,
                      filePath,
                    });
                  }}
                />
              </div>
            ) : (
              <div className="px-2 py-1 text-[length:var(--nx-font-size-ui-sm)] text-[var(--vscode-descriptionForeground)]">
                Select a commit to inspect changed files.
              </div>
            )}
            {twoPane && selected ? (
              <div
                className="shrink-0 px-2 py-1.5 border-t border-border text-[length:var(--nx-font-size-ui-sm)] text-[var(--vscode-descriptionForeground)]"
                data-testid="git-annotate-commit-footer"
              >
                <div className="font-medium text-foreground truncate">
                  {selected.subject}
                </div>
                <div className="mt-0.5 font-mono text-[var(--vscode-textLink-foreground)] truncate">
                  {selected.shortSha} {selected.author}
                  {selected.authorEmail ? (
                    <span className="text-[var(--vscode-descriptionForeground)]">
                      {" "}
                      &lt;{selected.authorEmail}&gt;
                    </span>
                  ) : null}
                </div>
                <div className="mt-0.5 opacity-80">
                  on {formatCommitTimestamp(selected.authorTime)}
                </div>
              </div>
            ) : null}
          </div>
        );

        // Right bottom: commit details (JB Log details pane)
        const detailsPane = (
          <div
            className="h-full w-full min-h-0 overflow-hidden border-t border-border bg-[var(--vscode-editor-background)]"
            data-testid="git-log-details-pane"
          >
            <GitCommitDetail commit={selected} detailsOnly />
          </div>
        );

        // Annotate under blame: commits | files
        if (twoPane) {
          return (
            <div
              className="flex-1 min-h-0 w-full flex flex-col"
              data-testid="git-history-log-body"
              data-layout="two-pane"
            >
              <ResizableSplit
                direction="horizontal"
                initialPercent={42}
                minFirstPercent={22}
                minSecondPercent={28}
                storageKey="gitView.gitLog.annotateSplit"
                className="flex-1 min-h-0 w-full"
                first={
                  <div className="h-full w-full min-w-0 border-r border-border overflow-hidden">
                    {commitPane}
                  </div>
                }
                second={
                  <div className="h-full w-full min-w-0 overflow-hidden">
                    {changedFilesPane}
                  </div>
                }
              />
            </div>
          );
        }

        // Log layout (git_log_view.png): commits | files+details
        // Optional Show Diff Preview stacks under the right column.
        const rightColumn = showDiffPane ? (
          <ResizableSplit
            direction="vertical"
            initialPercent={40}
            minFirstPercent={20}
            minSecondPercent={25}
            storageKey="gitView.gitLog.rightFilesDiffSplit"
            className="flex-1 min-h-0 w-full"
            first={
              <ResizableSplit
                direction="vertical"
                initialPercent={55}
                minFirstPercent={25}
                minSecondPercent={25}
                storageKey="gitView.gitLog.rightFilesDetailsSplit"
                className="flex-1 min-h-0 w-full"
                first={
                  <div className="h-full w-full min-h-0 overflow-hidden">
                    {changedFilesPane}
                  </div>
                }
                second={detailsPane}
              />
            }
            second={
              <div className="h-full w-full min-h-0 overflow-hidden border-t border-border">
                <GitHistoryDiffViewer
                  diff={state.fileDiff}
                  filePath={state.selectedChangedFilePath}
                  loading={state.patchLoading}
                  error={state.patchError}
                  variant="embedded"
                />
              </div>
            }
          />
        ) : (
          <ResizableSplit
            direction="vertical"
            initialPercent={52}
            minFirstPercent={25}
            minSecondPercent={25}
            storageKey="gitView.gitLog.rightFilesDetailsSplit"
            className="flex-1 min-h-0 w-full"
            first={
              <div className="h-full w-full min-h-0 overflow-hidden">
                {changedFilesPane}
              </div>
            }
            second={detailsPane}
          />
        );

        // Log body: commits+graph | files+details
        // Optional left branch tree only when user opens Branches (default closed).
        const mainSplit = (
          <ResizableSplit
            direction="horizontal"
            initialPercent={68}
            minFirstPercent={40}
            minSecondPercent={22}
            storageKey="gitView.gitLog.mainSplit"
            className="flex-1 min-h-0 w-full"
            first={
              <div className="h-full w-full min-w-0 border-r border-border overflow-hidden">
                {commitPane}
              </div>
            }
            second={
              <div className="h-full w-full min-w-0 overflow-hidden">
                {rightColumn}
              </div>
            }
          />
        );

        const branchTree = (
          <LogBranchTree
            branches={state.branches}
            currentBranch={state.branchFilter || null}
            selectedBranch={state.branchFilter}
            onSelectBranch={(b) => state.setBranchFilter(b)}
          />
        );

        return (
          <div
            className="flex-1 min-h-0 w-full flex flex-col"
            data-testid="git-history-log-body"
            data-layout={state.branchTreeOpen ? "log-with-branches" : "log"}
          >
            {state.branchTreeOpen ? (
              <ResizableSplit
                direction="horizontal"
                initialPercent={14}
                minFirstPercent={10}
                minSecondPercent={50}
                storageKey="gitView.gitLog.branchSplit"
                className="flex-1 min-h-0 w-full"
                first={
                  <div className="h-full w-full min-w-0 border-r border-border overflow-hidden">
                    {branchTree}
                  </div>
                }
                second={mainSplit}
              />
            ) : (
              mainSplit
            )}
          </div>
        );
      })()}

      <ContextMenu
        menu={commitMenu}
        onClose={() => setCommitMenu(null)}
        testId="git-history-commit-context-menu"
      >
        {commitMenu && (
          <GitHistoryCommitMenuItems
            commitSha={commitMenu.commit.sha}
            commitMessage={commitMenu.commit.subject}
            relativePath={historyFilePath}
            onClose={() => setCommitMenu(null)}
            onGitAction={(action, extra) => {
              dispatchGitAction(action, {
                commitSha: commitMenu.commit.sha,
                commitMessage: extra?.commitMessage,
                relativePath: historyFilePath,
              });
            }}
          />
        )}
      </ContextMenu>

      <ContextMenu
        menu={fileMenu}
        onClose={() => setFileMenu(null)}
        testId="git-history-file-context-menu"
      >
        {fileMenu && (
          <GitHistoryFileMenuItems
            filePath={fileMenu.filePath}
            commitSha={state.selectedSha}
            onClose={() => setFileMenu(null)}
            onShowDiff={() => {
              const sha = state.selectedSha;
              if (!sha) {
                return;
              }
              openRevisionDiffTab(fileMenu.filePath, sha);
            }}
            onGitAction={(action) => {
              dispatchGitAction(action, {
                commitSha: state.selectedSha ?? undefined,
                relativePath: fileMenu.filePath,
              });
            }}
          />
        )}
      </ContextMenu>
    </div>
  );
}
