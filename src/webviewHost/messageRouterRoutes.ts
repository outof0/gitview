import type { WebviewToHost } from "../shared/protocol";
import type { MessageRouterContext } from "./messageRouterContext";
import { dispatchRepo } from "./messageRouterDispatchRepo";
import { dispatchChanges } from "./messageRouterDispatchChanges";
import { dispatchBranches } from "./messageRouterDispatchBranches";
import { dispatchDiff } from "./messageRouterDispatchDiff";
import { dispatchLog } from "./messageRouterDispatchLog";
import { dispatchMisc } from "./messageRouterDispatchMisc";
import { dispatchTemporaryWork } from "./messageRouterDispatchTemporaryWork";
import { dispatchTagsWorktrees } from "./messageRouterDispatchTagsWorktrees";
import { dispatchReview } from "./messageRouterDispatchReview";
import { dispatchMerge } from "./messageRouterDispatchMerge";

export type Dispatcher = (
  request: WebviewToHost,
  ctx: MessageRouterContext,
) => Promise<boolean>;

type CoreRequestType = Extract<WebviewToHost, { type: string }>["type"];

/**
 * Owner of every core request type.
 *
 * The `satisfies` clause below makes this table exhaustive: adding a request
 * type to the protocol union will not compile until it is routed here. That
 * closes the gap where a validated request type could reach the router with no
 * handler and fail at runtime as NOT_IMPLEMENTED.
 *
 * `diff.annotate` is intentionally absent from the dispatchers and is served by
 * the panel-level interceptor in `webview/gitViewPresentation.ts`; it is
 * declared here so the exhaustiveness check stays honest.
 */
const ROUTES = {
  "webview.ready": dispatchRepo,
  "workspace.openFolder": dispatchRepo,
  "workspace.clone": dispatchRepo,
  "workspace.manageTrust": dispatchRepo,
  "workspace.collapsePanel": dispatchRepo,
  "workspace.toggleSidebar": dispatchRepo,
  "repository.addRemote": dispatchRepo,
  "repo.refresh": dispatchRepo,
  "status.list": dispatchRepo,

  "changes.stage": dispatchChanges,
  "changes.unstage": dispatchChanges,
  "changes.rollback": dispatchChanges,
  "commit.create": dispatchChanges,
  "commit.checks": dispatchChanges,
  "sync.fetch": dispatchChanges,
  "sync.pull": dispatchChanges,
  "sync.push": dispatchChanges,
  "sync.updateAllRoots": dispatchChanges,
  "sync.cancel": dispatchChanges,

  "branch.list": dispatchBranches,
  "branch.checkout": dispatchBranches,
  "branch.syncOperation": dispatchBranches,
  "branch.create": dispatchBranches,
  "branch.rename": dispatchBranches,
  "branch.delete": dispatchBranches,
  "branch.push": dispatchBranches,
  "branch.favorite": dispatchBranches,
  "branch.compareCurrent": dispatchBranches,
  "branch.compareWorkingTree": dispatchBranches,
  "branch.compareFile": dispatchBranches,
  "branch.compareApplyFile": dispatchBranches,
  "branch.merge": dispatchBranches,
  "branch.rebaseOnto": dispatchBranches,

  "operation.continue": dispatchDiff,
  "operation.skip": dispatchDiff,
  "operation.abort": dispatchDiff,
  "diff.open": dispatchDiff,
  "diff.openInEditor": dispatchDiff,
  "diff.numstat": dispatchDiff,
  "diff.annotate": null,
  "changelist.create": dispatchDiff,
  "changelist.activate": dispatchDiff,
  "changelist.moveFiles": dispatchDiff,
  "diff.stageHunk": dispatchDiff,
  "diff.unstageHunk": dispatchDiff,
  "diff.stageLines": dispatchDiff,
  "diff.unstageLines": dispatchDiff,

  "log.dag": dispatchLog,
  "log.query": dispatchLog,
  "log.fileDiff": dispatchLog,
  "log.commitDetail": dispatchLog,
  "log.fileAtRevision": dispatchLog,
  "log.cherryPick": dispatchLog,
  "log.cherryPickMultiple": dispatchLog,
  "log.cherryPickSelected": dispatchLog,
  "log.revert": dispatchLog,
  "log.revertMultiple": dispatchLog,
  "log.revertSelected": dispatchLog,
  "log.dropSelectedChanges": dispatchLog,
  "log.reset": dispatchLog,
  "log.undoLastCommit": dispatchLog,
  "log.createBranchFromCommit": dispatchLog,
  "log.dropCommit": dispatchLog,
  "log.editMessage": dispatchLog,
  "log.rewrite": dispatchLog,
  "log.extractChanges": dispatchLog,

  "conflict.refresh": dispatchMerge,
  "merge.openFile": dispatchMerge,
  "merge.save": dispatchMerge,
  "merge.markResolved": dispatchMerge,
  "merge.confirmDiscard": dispatchMerge,
  "merge.close": dispatchMerge,
  "log.changesFromSide": dispatchMerge,

  "rebase.continue": dispatchMisc,
  "rebase.skip": dispatchMisc,
  "rebase.abort": dispatchMisc,
  "blame.query": dispatchMisc,
  "file.write": dispatchMisc,
  "conflict.acceptLocal": dispatchMisc,
  "conflict.acceptIncoming": dispatchMisc,
  "conflict.openMerge": dispatchMisc,
  "conflict.applyNonConflicting": dispatchMisc,
  "history.openPanel": dispatchMisc,
  "git.menuAction": dispatchMisc,
  "rollback.openPanel": dispatchMisc,
  "git.openContentDialog": dispatchMisc,

  "stash.list": dispatchTemporaryWork,
  "stash.push": dispatchTemporaryWork,
  "stash.detail": dispatchTemporaryWork,
  "stash.fileDiff": dispatchTemporaryWork,
  "stash.apply": dispatchTemporaryWork,
  "stash.pop": dispatchTemporaryWork,
  "stash.drop": dispatchTemporaryWork,
  "stash.branch": dispatchTemporaryWork,
  "stash.clear": dispatchTemporaryWork,
  "shelf.list": dispatchTemporaryWork,
  "shelf.files": dispatchTemporaryWork,
  "shelf.hunk": dispatchTemporaryWork,
  "shelf.unshelve": dispatchTemporaryWork,
  "shelf.delete": dispatchTemporaryWork,
  "shelf.importPatch": dispatchTemporaryWork,
  "patch.create": dispatchTemporaryWork,
  "patch.apply": dispatchTemporaryWork,

  "tag.list": dispatchTagsWorktrees,
  "tag.createAnnotated": dispatchTagsWorktrees,
  "tag.checkout": dispatchTagsWorktrees,
  "tag.push": dispatchTagsWorktrees,
  "tag.delete": dispatchTagsWorktrees,
  "worktree.list": dispatchTagsWorktrees,
  "worktree.add": dispatchTagsWorktrees,
  "worktree.remove": dispatchTagsWorktrees,
  "worktree.open": dispatchTagsWorktrees,

  "review.list": dispatchReview,
  "review.open": dispatchReview,
  "review.submit": dispatchReview,
  "review.merge": dispatchReview,
  "review.applySuggestion": dispatchReview,
  "review.close": dispatchReview,
  "review.reopen": dispatchReview,
  "review.deleteSourceBranch": dispatchReview,
  "review.checkoutBranch": dispatchReview,
  "review.create": dispatchReview,
  "review.createLineComment": dispatchReview,
} satisfies Record<CoreRequestType, Dispatcher | null>;

export function resolveDispatcher(
  type: CoreRequestType,
): Dispatcher | null {
  return ROUTES[type];
}

export type RouteSemantics = {
  /** Mutates the repository and must fail fast while a sync is active. */
  mutation: boolean;
  /** Long-running sync guarded by the sync coordinator; stays out of the queue. */
  selfSerializing: boolean;
};

/**
 * Mutation classification lives with the route table so the two cannot drift.
 * The `satisfies` clause keeps this exhaustive: a new protocol route will not
 * compile until its mutation semantics are declared here. `git.menuAction` is
 * conservatively a mutation — one route fans out to pull/push/checkout and
 * other mutating actions.
 */
const ROUTE_SEMANTICS = {
  "webview.ready": { mutation: false, selfSerializing: true },
  "workspace.openFolder": { mutation: false, selfSerializing: true },
  "workspace.clone": { mutation: false, selfSerializing: true },
  "workspace.manageTrust": { mutation: false, selfSerializing: true },
  "workspace.collapsePanel": { mutation: false, selfSerializing: true },
  "workspace.toggleSidebar": { mutation: false, selfSerializing: true },
  "repository.addRemote": { mutation: false, selfSerializing: true },
  "repo.refresh": { mutation: false, selfSerializing: true },
  "status.list": { mutation: false, selfSerializing: true },
  "changes.stage": { mutation: true, selfSerializing: false },
  "changes.unstage": { mutation: true, selfSerializing: false },
  "changes.rollback": { mutation: true, selfSerializing: false },
  "commit.create": { mutation: true, selfSerializing: false },
  "commit.checks": { mutation: false, selfSerializing: true },
  "sync.fetch": { mutation: false, selfSerializing: true },
  "sync.pull": { mutation: false, selfSerializing: true },
  "sync.push": { mutation: false, selfSerializing: true },
  "sync.updateAllRoots": { mutation: false, selfSerializing: true },
  "sync.cancel": { mutation: false, selfSerializing: true },
  "branch.list": { mutation: false, selfSerializing: true },
  "branch.checkout": { mutation: true, selfSerializing: false },
  "branch.syncOperation": { mutation: true, selfSerializing: false },
  "branch.create": { mutation: true, selfSerializing: false },
  "branch.rename": { mutation: true, selfSerializing: false },
  "branch.delete": { mutation: true, selfSerializing: false },
  "branch.push": { mutation: true, selfSerializing: false },
  "branch.favorite": { mutation: false, selfSerializing: true },
  "branch.compareCurrent": { mutation: false, selfSerializing: true },
  "branch.compareWorkingTree": { mutation: false, selfSerializing: true },
  "branch.compareFile": { mutation: false, selfSerializing: true },
  "branch.compareApplyFile": { mutation: true, selfSerializing: false },
  "branch.merge": { mutation: true, selfSerializing: false },
  "branch.rebaseOnto": { mutation: true, selfSerializing: false },
  "operation.continue": { mutation: true, selfSerializing: false },
  "operation.skip": { mutation: true, selfSerializing: false },
  "operation.abort": { mutation: true, selfSerializing: false },
  "diff.open": { mutation: false, selfSerializing: true },
  "diff.openInEditor": { mutation: false, selfSerializing: true },
  "diff.numstat": { mutation: false, selfSerializing: true },
  "diff.annotate": { mutation: false, selfSerializing: true },
  "changelist.create": { mutation: false, selfSerializing: true },
  "changelist.activate": { mutation: false, selfSerializing: true },
  "changelist.moveFiles": { mutation: false, selfSerializing: true },
  "diff.stageHunk": { mutation: true, selfSerializing: false },
  "diff.unstageHunk": { mutation: true, selfSerializing: false },
  "diff.stageLines": { mutation: true, selfSerializing: false },
  "diff.unstageLines": { mutation: true, selfSerializing: false },
  "log.dag": { mutation: false, selfSerializing: true },
  "log.query": { mutation: false, selfSerializing: true },
  "log.fileDiff": { mutation: false, selfSerializing: true },
  "log.commitDetail": { mutation: false, selfSerializing: true },
  "log.fileAtRevision": { mutation: false, selfSerializing: true },
  "log.cherryPick": { mutation: true, selfSerializing: false },
  "log.cherryPickMultiple": { mutation: true, selfSerializing: false },
  "log.cherryPickSelected": { mutation: true, selfSerializing: false },
  "log.revert": { mutation: true, selfSerializing: false },
  "log.revertMultiple": { mutation: true, selfSerializing: false },
  "log.revertSelected": { mutation: true, selfSerializing: false },
  "log.dropSelectedChanges": { mutation: true, selfSerializing: false },
  "log.reset": { mutation: true, selfSerializing: false },
  "log.undoLastCommit": { mutation: true, selfSerializing: false },
  "log.createBranchFromCommit": { mutation: true, selfSerializing: false },
  "log.dropCommit": { mutation: true, selfSerializing: false },
  "log.editMessage": { mutation: true, selfSerializing: false },
  "log.rewrite": { mutation: true, selfSerializing: false },
  "log.extractChanges": { mutation: true, selfSerializing: false },
  "conflict.refresh": { mutation: false, selfSerializing: true },
  "merge.openFile": { mutation: false, selfSerializing: true },
  "merge.save": { mutation: true, selfSerializing: false },
  "merge.markResolved": { mutation: true, selfSerializing: false },
  "merge.confirmDiscard": { mutation: true, selfSerializing: false },
  "merge.close": { mutation: false, selfSerializing: true },
  "log.changesFromSide": { mutation: false, selfSerializing: true },
  "rebase.continue": { mutation: true, selfSerializing: false },
  "rebase.skip": { mutation: true, selfSerializing: false },
  "rebase.abort": { mutation: true, selfSerializing: false },
  "blame.query": { mutation: false, selfSerializing: true },
  "file.write": { mutation: true, selfSerializing: false },
  "conflict.acceptLocal": { mutation: true, selfSerializing: false },
  "conflict.acceptIncoming": { mutation: true, selfSerializing: false },
  "conflict.openMerge": { mutation: false, selfSerializing: true },
  "conflict.applyNonConflicting": { mutation: true, selfSerializing: false },
  "history.openPanel": { mutation: false, selfSerializing: true },
  "git.menuAction": { mutation: true, selfSerializing: false },
  "rollback.openPanel": { mutation: false, selfSerializing: true },
  "git.openContentDialog": { mutation: false, selfSerializing: true },
  "stash.list": { mutation: false, selfSerializing: true },
  "stash.push": { mutation: true, selfSerializing: false },
  "stash.detail": { mutation: false, selfSerializing: true },
  "stash.fileDiff": { mutation: false, selfSerializing: true },
  "stash.apply": { mutation: true, selfSerializing: false },
  "stash.pop": { mutation: true, selfSerializing: false },
  "stash.drop": { mutation: true, selfSerializing: false },
  "stash.branch": { mutation: true, selfSerializing: false },
  "stash.clear": { mutation: true, selfSerializing: false },
  "shelf.list": { mutation: false, selfSerializing: true },
  "shelf.files": { mutation: true, selfSerializing: false },
  "shelf.hunk": { mutation: true, selfSerializing: false },
  "shelf.unshelve": { mutation: true, selfSerializing: false },
  "shelf.delete": { mutation: true, selfSerializing: false },
  "shelf.importPatch": { mutation: true, selfSerializing: false },
  "patch.create": { mutation: false, selfSerializing: true },
  "patch.apply": { mutation: true, selfSerializing: false },
  "tag.list": { mutation: false, selfSerializing: true },
  "tag.createAnnotated": { mutation: true, selfSerializing: false },
  "tag.checkout": { mutation: true, selfSerializing: false },
  "tag.push": { mutation: true, selfSerializing: false },
  "tag.delete": { mutation: true, selfSerializing: false },
  "worktree.list": { mutation: false, selfSerializing: true },
  "worktree.add": { mutation: true, selfSerializing: false },
  "worktree.remove": { mutation: true, selfSerializing: false },
  "worktree.open": { mutation: false, selfSerializing: true },
  "review.list": { mutation: false, selfSerializing: true },
  "review.open": { mutation: false, selfSerializing: true },
  "review.submit": { mutation: true, selfSerializing: false },
  "review.merge": { mutation: true, selfSerializing: false },
  "review.applySuggestion": { mutation: true, selfSerializing: false },
  "review.close": { mutation: false, selfSerializing: true },
  "review.reopen": { mutation: false, selfSerializing: true },
  "review.deleteSourceBranch": { mutation: true, selfSerializing: false },
  "review.checkoutBranch": { mutation: true, selfSerializing: false },
  "review.create": { mutation: false, selfSerializing: true },
  "review.createLineComment": { mutation: false, selfSerializing: true },
} satisfies Record<CoreRequestType, RouteSemantics>;

export function isMutationRequestType(type: string): boolean {
  const semantics = (ROUTE_SEMANTICS as Record<string, RouteSemantics>)[type];
  // Default unknown repository routes to mutation semantics so a future route
  // cannot silently bypass the active-sync rejection.
  return semantics ? semantics.mutation : true;
}

export function isSelfSerializingRequestType(type: string): boolean {
  const semantics = (ROUTE_SEMANTICS as Record<string, RouteSemantics>)[type];
  return semantics ? semantics.selfSerializing : false;
}
