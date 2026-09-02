import type { GitPanelSurface } from "../shared/protocol";
import type { FileDiffView } from "../types/blame";

export type GitDiffPreview = {
  relativePath: string;
  title: string;
  diff: FileDiffView;
};

/** UI boundary used by Git commands. The command layer never imports a panel. */
export interface GitMenuPresentation {
  openHistory(request: {
    relativePath: string;
    isFolder: boolean;
    workspaceRoot: string;
  }): Promise<void>;
  openDiff(request: {
    preview: GitDiffPreview;
    workspaceRoot?: string;
    reusePanel?: boolean;
    openInActiveColumn?: boolean;
  }): Promise<void>;
  openBlame(request: {
    relativePath: string;
    workspaceRoot?: string;
    repoRoot: string;
    /** 1-based line to scroll to (editor cursor when Annotate was opened). */
    focusLine?: number;
  }): Promise<void>;
  /** Select a specific commit in the active workspace Git log. */
  selectCommit?(request: { repoId: string; sha: string }): Promise<void>;
  /** Surface the GitView Git panel and open one of its dialogs or list popups. */
  openPanelDialog?(request: {
    dialog: GitPanelSurface;
    relativePath?: string;
    index?: number | null;
    /** Repository root resolved from the native resource/menu invocation. */
    repoRoot?: string;
    workspaceRoot?: string;
  }): Promise<void>;
  /** Open the rollback confirmation in the Git workspace content. */
  openRollbackConfirmation?(request: {
    relativePath: string;
    workspaceRoot?: string;
    repoRoot: string;
    selectedPaths?: string[];
  }): Promise<void>;
  /** Open the Create Branch dialog as a centered modal in the editor area. */
  openCreateBranchDialog?(request: {
    workspaceRoot: string;
    repoId?: string;
    /** Resolved repository root — preferred over re-resolving (nested repos). */
    repoRoot?: string;
    startPoint?: string;
  }): Promise<void>;
  /**
   * Open the Commit dialog as its own editor-area panel.
   *
   * The bottom Git panel is ~258px tall, so a dialog filling `80vh` there gets
   * ~206px and the Commit dialog's file/diff split collapses to 2px — files
   * cannot be picked before committing. It also carries `repoId`, which
   * `openPanelDialog` cannot: that one sends only a dialog id, so the dialog
   * commits to whatever repository the panel currently has active.
   */
  openCommitDialog?(request: {
    workspaceRoot: string;
    repoId?: string;
  }): Promise<void>;
  /**
   * Open the Branches popup as its own editor-area panel.
   *
   * Same reason as `openCommitDialog`: the bottom Git panel is ~258px tall and
   * leaves the branch list cramped, and this route carries `repoId`, which
   * `openPanelDialog` cannot.
   */
  openBranchesDialog?(request: {
    workspaceRoot: string;
    repoId?: string;
    /** Resolved repository root — preferred over re-resolving (nested repos). */
    repoRoot?: string;
  }): Promise<void>;
}
