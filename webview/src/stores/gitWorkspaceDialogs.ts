import type { GitPanelDialog } from "@gitview/shared/protocol";
import type { SyncBranchTarget } from "@gitview/shared/types/branch";
import type { CommitCheckIssue } from "@gitview/shared/types/commitCheck";
import type { DiffLineSelection } from "@gitview/shared/types/diff";
import type { ResetMode } from "@gitview/shared/types/log";

/**
 * Every modal the Git Workspace can open, keyed by id, with the data that modal
 * needs to render. This is the only declaration site: the store field, the
 * open/close actions, the render registry and the native `git:openDialog`
 * bridge are all derived from it, so a new dialog cannot be half-wired.
 */
export type GitWorkspaceDialogPayloads = {
  stash: Record<string, never>;
  unstash: { index: number | null };
  commit: Record<string, never>;
  /** `startPoint` empty means "from HEAD". */
  createBranch: { startPoint: string };
  /** `ref`/`onto` empty means the dialog opened with no branch picked yet. */
  merge: { ref: string };
  rebase: { onto: string };
  forceCheckout: { ref: string; opts?: { smart?: boolean; force?: boolean } };
  renameBranch: { oldName: string };
  deleteBranch: { name: string; forceRequired?: boolean };
  deleteReviewSourceBranch: { branchName: string };
  rollbackConfirm: { paths: string[] };
  reset: { sha: string; mode: ResetMode };
  createBranchFromCommit: { sha: string };
  editMessage: { sha: string; subject: string };
  rewrite: { sha: string; action: "squash" | "fixup" | "drop" };
  commitCheckWarnings: { issues: CommitCheckIssue[] };
  dropSelected: {
    sha: string;
    path: string;
    hunkIndexes?: number[];
    lines?: DiffLineSelection[];
  };
  pushUpstream: { branch: string; remote: string };
  syncBranch: {
    ref: string;
    targets: SyncBranchTarget[];
    opts?: { smart?: boolean; force?: boolean };
  };
  updateAllRootsReport: {
    results: Array<{ repoId: string; name: string; ok: boolean; error?: string }>;
  };
  worktreeRemove: { path: string; forceRequired?: boolean };
};

export type GitWorkspaceDialogId = keyof GitWorkspaceDialogPayloads;

/** A dialog is open exactly when its id has a payload. */
export type GitWorkspaceDialogState = {
  readonly [K in GitWorkspaceDialogId]?: GitWorkspaceDialogPayloads[K];
};

/**
 * Payloads used when the host asks for a dialog by name — the native Git
 * submenu has no context to pass, so these are the "opened empty" states.
 */
export const PANEL_DIALOG_PAYLOADS: {
  [K in GitPanelDialog]: GitWorkspaceDialogPayloads[K];
} = {
  stash: {},
  unstash: { index: null },
  commit: {},
  createBranch: { startPoint: "" },
  merge: { ref: "" },
  rebase: { onto: "" },
};

/**
 * The host may only request dialogs this panel knows how to render. Renaming a
 * dialog id without updating `GIT_PANEL_DIALOGS` breaks the build here rather
 * than silently making a native menu entry do nothing.
 */
type UnrenderablePanelDialogs = Exclude<GitPanelDialog, GitWorkspaceDialogId>;
const _everyPanelDialogIsRenderable: UnrenderablePanelDialogs extends never
  ? true
  : UnrenderablePanelDialogs = true;
void _everyPanelDialogIsRenderable;
