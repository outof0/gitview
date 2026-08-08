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
  /** Surface the GitView Git panel and open one of its dialogs or list popups. */
  openPanelDialog?(request: {
    dialog: GitPanelSurface;
    relativePath?: string;
  }): Promise<void>;
}
