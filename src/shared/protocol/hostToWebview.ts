import type { BlameSnapshot } from "../types/blame";
import type {
  ChangesFromSideResult,
  ConflictSnapshot,
  DiscardConfirmAction,
  MergeDocument,
  MergeInitPayload,
} from "../types/merge";
import type { BranchCompareSnapshot, BranchListSnapshot, SyncBranchResult, SyncBranchTarget } from "../types/branch";
import type {
  DiffLineSelection,
  StandaloneDiffPreview,
  WorkspaceDiffDocument,
} from "../types/diff";
import type {
  BlamePreviewPayload,
  CommitDetailResult,
  FileAtRevisionResult,
  HistoryInitPayload,
} from "../types/history";
import type { LogSnapshot } from "../types/log";
import type { PatchPreview } from "../types/patch";
import type { RepositorySnapshot } from "../types/repository";
import type { ShelfListSnapshot } from "../types/shelf";
import type { StashDetail, StashListSnapshot } from "../types/stash";
import type { ChangeList, StatusSnapshot } from "../types/status";
import type { TagListSnapshot } from "../types/tag";
import type { WorktreeListSnapshot } from "../types/worktree";
import type { CommitCheckResult } from "../types/commitCheck";
import type { GitWorkspaceSettings } from "../types/gitWorkspaceSettings";
import type { ReviewDetailsSnapshot, ReviewItem, ReviewListSnapshot } from "../types/review";
import type { HostErrorResponse, HostEvent, HostResponse } from "./base";

/** Panel dialogs the native Git submenu can open in place of a QuickPick. */
export const GIT_PANEL_DIALOGS = [
  "stash",
  "unstash",
  "createBranch",
  "merge",
  "rebase",
  "commit",
] as const;

/**
 * List popups the submenu can open. They are not dialogs: each owns its own
 * snapshot + loading state instead of a payload, so they live outside the
 * panel's dialog registry and are opened through a different store action.
 */
export const GIT_PANEL_POPUPS = ["branches"] as const;

export const GIT_PANEL_SURFACES = [
  ...GIT_PANEL_DIALOGS,
  ...GIT_PANEL_POPUPS,
] as const;

export type GitPanelDialog = (typeof GIT_PANEL_DIALOGS)[number];
export type GitPanelPopup = (typeof GIT_PANEL_POPUPS)[number];
export type GitPanelSurface = GitPanelDialog | GitPanelPopup;

export function isGitPanelDialog(value: unknown): value is GitPanelDialog {
  return (GIT_PANEL_DIALOGS as readonly unknown[]).includes(value);
}

export function isGitPanelSurface(value: unknown): value is GitPanelSurface {
  return (GIT_PANEL_SURFACES as readonly unknown[]).includes(value);
}

/** Host → webview events (v1). */
export type HostToWebview =
  | HostEvent<"repo.snapshot", RepositorySnapshot>
  | HostEvent<"status.snapshot", StatusSnapshot>
  | HostEvent<"git.settings", GitWorkspaceSettings>
  | HostEvent<"branch.snapshot", BranchListSnapshot>
  | HostEvent<"branch.compare.snapshot", BranchCompareSnapshot>
  | HostEvent<"log.snapshot", LogSnapshot>
  | HostEvent<"blame.snapshot", BlameSnapshot>
  | HostEvent<"stash.snapshot", StashListSnapshot>
  | HostEvent<"shelf.snapshot", ShelfListSnapshot>
  | HostEvent<"tag.snapshot", TagListSnapshot>
  | HostEvent<"worktree.snapshot", WorktreeListSnapshot>
  | HostEvent<"review.snapshot", ReviewListSnapshot>
  | HostEvent<"review.details", ReviewDetailsSnapshot>
  | HostEvent<"diff.result", WorkspaceDiffDocument>
  | HostEvent<"diff.preview", StandaloneDiffPreview>
  | HostEvent<"history.init", HistoryInitPayload>
  | HostEvent<"blame.preview", BlamePreviewPayload>
  | HostEvent<"conflict.snapshot", ConflictSnapshot>
  | HostEvent<"merge.document", MergeDocument>
  | HostEvent<"merge.init", MergeInitPayload>
  | HostEvent<"merge.settings", MergeInitPayload["settings"]>
  /** Host asks webview to show the Conflicts dialog (not a single-file resolver). */
  | HostEvent<"merge.showConflictList", Record<string, never>>
  | HostEvent<"blame.annotateRequest", { relativePath: string; side: "ours" | "theirs" }>
  /** Native Git submenu asks the panel to open a JetBrains-style dialog. */
  | HostEvent<
      "git.openDialog",
      { dialog: GitPanelSurface; relativePath?: string }
    >
  | HostEvent<
      "notification",
      { level: "info" | "warning" | "error"; message: string }
    >
  | HostResponse<
      "webview.ready",
      { surface: string; settings: GitWorkspaceSettings }
    >
  | HostResponse<"repo.refresh", { refreshed: boolean }>
  | HostResponse<"status.list", StatusSnapshot>
  | HostResponse<"changes.stage", { staged: string[] }>
  | HostResponse<"changes.unstage", { unstaged: string[] }>
  | HostResponse<"changes.rollback", { rolledBack: string[] }>
  | HostResponse<
      "commit.create",
      {
        sha: string;
        pushed?: boolean;
        pushRejected?: boolean;
        upstreamRequired?: boolean;
      }
    >
  | HostResponse<"sync.fetch", { ok: boolean }>
  | HostResponse<"sync.pull", { ok: boolean }>
  | HostResponse<
      "sync.push",
      {
        ok: boolean;
        rejected?: boolean;
        message?: string;
        upstreamRequired?: boolean;
        branch?: string;
        remote?: string;
      }
    >
  | HostResponse<
      "sync.updateAllRoots",
      {
        results: Array<{
          repoId: string;
          name: string;
          ok: boolean;
          error?: string;
        }>;
      }
    >
  | HostResponse<"branch.list", BranchListSnapshot>
  | HostResponse<"branch.checkout", { ref: string }>
  | HostResponse<
      "branch.syncOperation",
      {
        confirmationRequired?: boolean;
        ref?: string;
        targets?: SyncBranchTarget[];
        results?: SyncBranchResult[];
      }
    >
  | HostResponse<"branch.create", { name: string }>
  | HostResponse<"branch.rename", { name: string }>
  | HostResponse<"branch.delete", { name: string }>
  | HostResponse<
      "branch.push",
      { ok: boolean; rejected?: boolean; message?: string }
    >
  | HostResponse<"branch.favorite", BranchListSnapshot>
  | HostResponse<
      "branch.compareCurrent",
      { snapshot: BranchCompareSnapshot; document?: WorkspaceDiffDocument }
    >
  | HostResponse<
      "branch.compareWorkingTree",
      { snapshot: BranchCompareSnapshot; document?: WorkspaceDiffDocument }
    >
  | HostResponse<"branch.compareFile", WorkspaceDiffDocument>
  | HostResponse<
      "branch.compareApplyFile",
      { path: string; ref: string; mode: "current" | "workingTree" }
    >
  | HostResponse<"branch.merge", { ref: string }>
  | HostResponse<"branch.rebaseOnto", { onto: string }>
  | HostResponse<"operation.continue", { ok: boolean }>
  | HostResponse<"operation.skip", { ok: boolean }>
  | HostResponse<"operation.abort", { ok: boolean }>
  | HostResponse<"diff.open", WorkspaceDiffDocument>
  | HostResponse<"diff.annotate", { ok: true }>
  | HostResponse<"changelist.create", { changelists: ChangeList[] }>
  | HostResponse<"changelist.activate", { changelists: ChangeList[] }>
  | HostResponse<"changelist.moveFiles", { changelists: ChangeList[] }>
  | HostResponse<"log.query", LogSnapshot>
  | HostResponse<"log.fileDiff", WorkspaceDiffDocument>
  | HostResponse<"log.commitDetail", CommitDetailResult>
  | HostResponse<"log.fileAtRevision", FileAtRevisionResult>
  | HostResponse<"git.menuAction", { ok: true }>
  | HostResponse<"diff.stageHunk", { path: string; hunkIndex: number }>
  | HostResponse<"diff.unstageHunk", { path: string; hunkIndex: number }>
  | HostResponse<"diff.stageLines", { path: string; lines: DiffLineSelection[] }>
  | HostResponse<"diff.unstageLines", { path: string; lines: DiffLineSelection[] }>
  | HostResponse<"log.cherryPick", { sha: string }>
  | HostResponse<"log.cherryPickMultiple", { shas: string[] }>
  | HostResponse<
      "log.cherryPickSelected",
      { sha: string; path: string; checked: boolean; applied: boolean }
    >
  | HostResponse<"log.revert", { sha: string }>
  | HostResponse<"log.revertMultiple", { shas: string[] }>
  | HostResponse<"log.extractChanges", { sha: string }>
  | HostResponse<
      "log.revertSelected",
      { sha: string; path: string; checked: boolean; applied: boolean }
    >
  | HostResponse<
      "log.dropSelectedChanges",
      { sha: string; path: string }
    >
  | HostResponse<"log.reset", { sha: string; mode: string }>
  | HostResponse<"log.undoLastCommit", { ok: boolean }>
  | HostResponse<"log.createBranchFromCommit", { name: string }>
  | HostResponse<"log.dropCommit", { sha: string }>
  | HostResponse<"log.editMessage", { sha: string }>
  | HostResponse<"log.rewrite", { sha: string; action: string }>
  | HostResponse<"rebase.continue", { ok: boolean }>
  | HostResponse<"rebase.skip", { ok: boolean }>
  | HostResponse<"rebase.abort", { ok: boolean }>
  | HostResponse<"commit.checks", CommitCheckResult>
  | HostResponse<"blame.query", BlameSnapshot>
  | HostResponse<"file.write", { path: string; saved: boolean }>
  | HostResponse<
      "conflict.acceptLocal",
      { paths: string[]; side: "ours" }
    >
  | HostResponse<
      "conflict.acceptIncoming",
      { paths: string[]; side: "theirs" }
    >
  | HostResponse<"conflict.openMerge", { path: string }>
  | HostResponse<
      "conflict.applyNonConflicting",
      { applied: string[]; skipped: string[] }
    >
  | HostResponse<"conflict.refresh", { refreshed: boolean }>
  | HostResponse<"merge.openFile", { path: string }>
  | HostResponse<
      "merge.saved",
      { path: string; hint?: string }
    >
  | HostResponse<"merge.resolved", { path: string }>
  | HostResponse<"merge.confirmDiscard", DiscardConfirmAction>
  | HostResponse<"merge.close", { closed: boolean }>
  | HostResponse<"history.openPanel", { opened: boolean }>
  | HostResponse<"log.changesFromSide", ChangesFromSideResult>
  | HostResponse<"stash.list", StashListSnapshot>
  | HostResponse<"stash.push", StashListSnapshot>
  | HostResponse<"stash.detail", StashDetail>
  | HostResponse<"stash.fileDiff", WorkspaceDiffDocument>
  | HostResponse<
      "stash.apply",
      { index: number; snapshot: StashListSnapshot }
    >
  | HostResponse<"stash.pop", StashListSnapshot>
  | HostResponse<"stash.drop", StashListSnapshot>
  | HostResponse<"stash.branch", StashListSnapshot>
  | HostResponse<"stash.clear", StashListSnapshot>
  | HostResponse<"shelf.list", ShelfListSnapshot>
  | HostResponse<
      "shelf.files",
      { entry: ShelfListSnapshot["shelves"][number]; snapshot: ShelfListSnapshot }
    >
  | HostResponse<
      "shelf.hunk",
      { entry: ShelfListSnapshot["shelves"][number]; snapshot: ShelfListSnapshot }
    >
  | HostResponse<
      "shelf.unshelve",
      {
        entry: ShelfListSnapshot["shelves"][number] | null;
        snapshot: ShelfListSnapshot;
      }
    >
  | HostResponse<
      "shelf.delete",
      { removed: boolean; snapshot: ShelfListSnapshot }
    >
  | HostResponse<
      "shelf.importPatch",
      {
        entry: ShelfListSnapshot["shelves"][number];
        snapshot: ShelfListSnapshot;
      }
    >
  | HostResponse<"patch.create", PatchPreview>
  | HostResponse<"patch.apply", { applied: boolean; checked: boolean }>
  | HostResponse<"tag.list", TagListSnapshot>
  | HostResponse<
      "tag.createAnnotated",
      { name: string; snapshot: TagListSnapshot }
    >
  | HostResponse<"tag.checkout", { name: string }>
  | HostResponse<"tag.push", { name: string }>
  | HostResponse<
      "tag.delete",
      { name: string; snapshot: TagListSnapshot }
    >
  | HostResponse<"worktree.list", WorktreeListSnapshot>
  | HostResponse<
      "worktree.add",
      { path: string; snapshot: WorktreeListSnapshot }
    >
  | HostResponse<
      "worktree.remove",
      { path: string; snapshot: WorktreeListSnapshot }
    >
  | HostResponse<"worktree.open", { path: string }>
  | HostResponse<"review.list", ReviewListSnapshot>
  | HostResponse<"review.open", ReviewDetailsSnapshot>
  | HostResponse<"review.submit", { ok: boolean }>
  | HostResponse<"review.merge", { ok: boolean }>
  | HostResponse<
      "review.applySuggestion",
      { suggestionId: string; path: string }
    >
  | HostResponse<"review.close", { ok: boolean }>
  | HostResponse<"review.reopen", { ok: boolean }>
  | HostResponse<"review.deleteSourceBranch", { ok: boolean; branch: string }>
  | HostResponse<"review.checkoutBranch", { branch: string }>
  | HostResponse<"review.create", ReviewItem>
  | HostResponse<"review.createLineComment", { commentId: string }>
  | HostErrorResponse;

/**
 * Unsolicited host → webview events (no `requestId`), as opposed to responses.
 * Derived structurally so it cannot drift from `HostToWebview`.
 */
export type HostToWebviewEvent = HostToWebview extends infer Message
  ? Message extends { requestId: string }
    ? never
    : Message
  : never;

export type HostToWebviewEventType = HostToWebviewEvent["type"];

/**
 * Runtime counterpart of `HostToWebviewEventType`. The `satisfies` clause makes
 * this exhaustive: a new HostEvent will not compile until it is listed here, so
 * the webview can never silently drop an event the host has started sending.
 */
export const HOST_EVENT_TYPES = [
  "repo.snapshot",
  "status.snapshot",
  "git.settings",
  "branch.snapshot",
  "branch.compare.snapshot",
  "log.snapshot",
  "blame.snapshot",
  "stash.snapshot",
  "shelf.snapshot",
  "tag.snapshot",
  "worktree.snapshot",
  "review.snapshot",
  "review.details",
  "diff.result",
  "diff.preview",
  "history.init",
  "blame.preview",
  "conflict.snapshot",
  "merge.document",
  "merge.init",
  "merge.settings",
  "merge.showConflictList",
  "blame.annotateRequest",
  "git.openDialog",
  "notification",
] as const satisfies readonly HostToWebviewEventType[];

/**
 * `satisfies` alone only proves each listed member is a real event type; it does
 * not prove the list is complete. This assertion fails to compile when an event
 * type exists in the union but is missing from HOST_EVENT_TYPES.
 */
type MissingHostEventTypes = Exclude<
  HostToWebviewEventType,
  (typeof HOST_EVENT_TYPES)[number]
>;
const _allHostEventTypesListed: MissingHostEventTypes extends never
  ? true
  : MissingHostEventTypes = true;
void _allHostEventTypesListed;

const HOST_EVENT_TYPE_SET: ReadonlySet<string> = new Set(HOST_EVENT_TYPES);

export function isHostEventType(type: string): boolean {
  return HOST_EVENT_TYPE_SET.has(type);
}
