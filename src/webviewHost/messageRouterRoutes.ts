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
  "diff.annotate": null,
  "changelist.create": dispatchDiff,
  "changelist.activate": dispatchDiff,
  "changelist.moveFiles": dispatchDiff,
  "diff.stageHunk": dispatchDiff,
  "diff.unstageHunk": dispatchDiff,
  "diff.stageLines": dispatchDiff,
  "diff.unstageLines": dispatchDiff,

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
