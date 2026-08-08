import type { GitMenuAction } from "./gitMenu";
import type { GitSubmenuSpecialAction } from "./gitSubmenu";
import type { Repository } from "../shared/types/repository";
import type { GitFileStatus } from "../shared/types/status";

export type GitSubmenuAction = GitMenuAction | GitSubmenuSpecialAction;

export type GitSubmenuEnablementContext = {
  isFolder?: boolean;
  relativePath?: string;
  fileStatus?: GitFileStatus | null;
  /** All status rows — used for folder-scoped add/unstage/rollback. */
  files?: readonly GitFileStatus[];
  repository?: Pick<
    Repository,
    | "upstream"
    | "ahead"
    | "behind"
    | "dirty"
    | "trusted"
    | "operation"
    | "conflictCount"
  > | null;
  hasRemote?: boolean;
  stashCount?: number;
  shelfCount?: number;
  hasStagedChanges?: boolean;
  mergeChangesCount?: number;
};

export type GitSubmenuEnablementResult = {
  enabled: boolean;
  reason?: string;
};

/** VS Code `setContext` keys for native Git submenu command enablement. */
export const GIT_SUBMENU_CONTEXT_KEYS = {
  canFetch: "gitView.git.canFetch",
  canPull: "gitView.git.canPull",
  canPush: "gitView.git.canPush",
  canSync: "gitView.git.canSync",
  canCommit: "gitView.git.canCommit",
  canStash: "gitView.git.canStash",
  canUnstash: "gitView.git.canUnstash",
  canShelve: "gitView.git.canShelve",
  canUnshelve: "gitView.git.canUnshelve",
  canIntegrate: "gitView.git.canIntegrate",
} as const;

function hasWorkingTreeChange(status: string): boolean {
  return status.trim().length > 0 && status !== "?";
}

function hasIndexChange(status: string): boolean {
  return status.trim().length > 0;
}

function fileHasRollbackableChanges(file: GitFileStatus): boolean {
  return hasIndexChange(file.indexStatus) || hasWorkingTreeChange(file.workingTreeStatus);
}

function fileCanStage(file: GitFileStatus): boolean {
  if (file.conflicted) {
    return false;
  }
  if (file.kind === "unversioned" || file.kind === "ignored") {
    return file.kind === "unversioned";
  }
  return hasWorkingTreeChange(file.workingTreeStatus) || !file.staged;
}

function fileCanUnstage(file: GitFileStatus): boolean {
  return file.staged || hasIndexChange(file.indexStatus);
}

function fileCanShowDiff(file: GitFileStatus): boolean {
  return fileHasRollbackableChanges(file) || file.kind === "unversioned";
}

function scopedFiles(ctx: GitSubmenuEnablementContext): readonly GitFileStatus[] {
  const all = ctx.files ?? (ctx.fileStatus ? [ctx.fileStatus] : []);
  if (!ctx.isFolder || !ctx.relativePath) {
    return all;
  }
  const prefix = ctx.relativePath.endsWith("/")
    ? ctx.relativePath
    : `${ctx.relativePath}/`;
  return all.filter((f) => f.path === ctx.relativePath || f.path.startsWith(prefix));
}

function repoTrusted(ctx: GitSubmenuEnablementContext): boolean {
  return ctx.repository?.trusted !== false;
}

function hasUpstream(ctx: GitSubmenuEnablementContext): boolean {
  return Boolean(ctx.repository?.upstream);
}

function hasFetchableRemote(ctx: GitSubmenuEnablementContext): boolean {
  return ctx.hasRemote !== false;
}

function hasLocalChanges(ctx: GitSubmenuEnablementContext): boolean {
  if (ctx.repository?.dirty) {
    return true;
  }
  const scoped = scopedFiles(ctx);
  return scoped.some(
    (f) =>
      f.kind !== "ignored" &&
      (fileHasRollbackableChanges(f) || f.kind === "unversioned"),
  );
}

function hasStagedChanges(ctx: GitSubmenuEnablementContext): boolean {
  if (ctx.hasStagedChanges) {
    return true;
  }
  return scopedFiles(ctx).some((f) => f.staged);
}

function operationBlocksIntegrate(ctx: GitSubmenuEnablementContext): boolean {
  const op = ctx.repository?.operation?.type ?? "none";
  return op !== "none";
}

/** Merge/rebase/cherry-pick/revert — Git stash cannot rewrite the index. */
function operationBlocksTemporaryWork(
  ctx: GitSubmenuEnablementContext,
): boolean {
  return operationBlocksIntegrate(ctx);
}

function hasUnresolvedConflicts(ctx: GitSubmenuEnablementContext): boolean {
  return (ctx.mergeChangesCount ?? ctx.repository?.conflictCount ?? 0) > 0;
}

export function evaluateGitSubmenuAction(
  action: GitSubmenuAction,
  ctx: GitSubmenuEnablementContext,
): GitSubmenuEnablementResult {
  if (!repoTrusted(ctx)) {
    return { enabled: false, reason: "Untrusted workspace" };
  }

  switch (action) {
    case "showHistory":
    case "compareWithRevision":
    case "compareWithBranch":
    case "annotateBlame":
    case "checkoutBranch":
    case "createBranch":
      if (ctx.isFolder && action !== "showHistory" && action !== "annotateBlame") {
        return { enabled: false, reason: "Select a file" };
      }
      if (
        (action === "checkoutBranch" || action === "createBranch") &&
        operationBlocksIntegrate(ctx)
      ) {
        return { enabled: false, reason: "Git operation in progress" };
      }
      return { enabled: true };

    case "showDiff":
    case "rollback": {
      if (ctx.isFolder) {
        return { enabled: false, reason: "Select a file" };
      }
      const file = ctx.fileStatus ?? scopedFiles(ctx)[0];
      if (!file) {
        return { enabled: false, reason: "No changes for this file" };
      }
      if (action === "showDiff" && !fileCanShowDiff(file)) {
        return { enabled: false, reason: "No diff for this file" };
      }
      if (action === "rollback" && !fileHasRollbackableChanges(file)) {
        return { enabled: false, reason: "No changes to roll back" };
      }
      return { enabled: true };
    }

    case "add": {
      const scoped = scopedFiles(ctx);
      if (scoped.length === 0) {
        return { enabled: false, reason: "Nothing to stage" };
      }
      if (!scoped.some(fileCanStage)) {
        return { enabled: false, reason: "Already staged" };
      }
      return { enabled: true };
    }

    case "unstage": {
      const scoped = scopedFiles(ctx);
      if (!scoped.some(fileCanUnstage)) {
        return { enabled: false, reason: "Nothing staged" };
      }
      return { enabled: true };
    }

    case "commit":
    case "commitAndPush":
      if (hasUnresolvedConflicts(ctx)) {
        return {
          enabled: false,
          reason: "Resolve merge conflicts before committing",
        };
      }
      if (!hasStagedChanges(ctx)) {
        return { enabled: false, reason: "Nothing staged to commit" };
      }
      if (action === "commitAndPush" && (ctx.repository?.ahead ?? 0) === 0 && !hasUpstream(ctx)) {
        return { enabled: false, reason: "No upstream branch to push" };
      }
      return { enabled: true };

    case "fetch":
      if (!hasFetchableRemote(ctx)) {
        return { enabled: false, reason: "No remote configured" };
      }
      // Always allow fetch when a remote exists. Local ahead/behind can read as
      // "up to date" while remote-tracking refs are still stale until git fetch runs.
      return { enabled: true };

    case "pull":
      if (!hasUpstream(ctx)) {
        return { enabled: false, reason: "No upstream branch" };
      }
      // Allow pull whenever upstream tracking exists. Ahead/behind can read as
      // "up to date" while the user (or a test) has already fetched newer tips;
      // `git pull` is a safe no-op when truly current (same rationale as fetch).
      return { enabled: true };

    case "push":
      if (!hasUpstream(ctx)) {
        return { enabled: false, reason: "No upstream branch" };
      }
      if ((ctx.repository?.ahead ?? 0) === 0) {
        return { enabled: false, reason: "Nothing to push" };
      }
      return { enabled: true };

    case "sync":
      if (!hasUpstream(ctx)) {
        return { enabled: false, reason: "No upstream branch" };
      }
      if ((ctx.repository?.ahead ?? 0) === 0 && (ctx.repository?.behind ?? 0) === 0) {
        return { enabled: false, reason: "Already up to date" };
      }
      return { enabled: true };

    case "stash":
    case "shelve":
      if (operationBlocksTemporaryWork(ctx)) {
        return {
          enabled: false,
          reason:
            action === "stash"
              ? "Cannot stash during merge/rebase (unmerged index)"
              : "Cannot shelve during merge/rebase",
        };
      }
      if (hasUnresolvedConflicts(ctx)) {
        return {
          enabled: false,
          reason: "Resolve conflicts before stashing or shelving",
        };
      }
      if (!hasLocalChanges(ctx)) {
        return { enabled: false, reason: "No local changes" };
      }
      return { enabled: true };

    case "unstash":
      if (operationBlocksTemporaryWork(ctx) || hasUnresolvedConflicts(ctx)) {
        return {
          enabled: false,
          reason: "Cannot unstash during merge/rebase",
        };
      }
      // Stays enabled with an empty stash list, like JetBrains: the dialog owns
      // that empty state, and a dead menu entry just reads as a broken click.
      return { enabled: true };

    case "unshelve":
      if (operationBlocksTemporaryWork(ctx) || hasUnresolvedConflicts(ctx)) {
        return {
          enabled: false,
          reason: "Cannot unshelve during merge/rebase",
        };
      }
      if ((ctx.shelfCount ?? 0) === 0) {
        return { enabled: false, reason: "No shelved changes" };
      }
      return { enabled: true };

    case "merge":
    case "rebase":
      if (operationBlocksIntegrate(ctx)) {
        return { enabled: false, reason: "Git operation in progress" };
      }
      return { enabled: true };

    case "openConflictResolver":
      if ((ctx.mergeChangesCount ?? ctx.repository?.conflictCount ?? 0) === 0) {
        return { enabled: false, reason: "No merge conflicts" };
      }
      return { enabled: true };

    default:
      return { enabled: true };
  }
}

export function isGitSubmenuActionEnabled(
  action: GitSubmenuAction,
  ctx: GitSubmenuEnablementContext,
): boolean {
  return evaluateGitSubmenuAction(action, ctx).enabled;
}

export type GitSubmenuNativeContextFlags = {
  [K in keyof typeof GIT_SUBMENU_CONTEXT_KEYS]: boolean;
};

export function buildGitSubmenuNativeContext(
  ctx: GitSubmenuEnablementContext,
): GitSubmenuNativeContextFlags {
  return {
    canFetch: isGitSubmenuActionEnabled("fetch", ctx),
    canPull: isGitSubmenuActionEnabled("pull", ctx),
    canPush: isGitSubmenuActionEnabled("push", ctx),
    canSync: isGitSubmenuActionEnabled("sync", ctx),
    canCommit: isGitSubmenuActionEnabled("commit", ctx),
    canStash: isGitSubmenuActionEnabled("stash", ctx),
    canUnstash: isGitSubmenuActionEnabled("unstash", ctx),
    canShelve: isGitSubmenuActionEnabled("shelve", ctx),
    canUnshelve: isGitSubmenuActionEnabled("unshelve", ctx),
    canIntegrate: isGitSubmenuActionEnabled("merge", ctx),
  };
}

export function buildGitSubmenuEnablementContext(input: {
  repository?: GitSubmenuEnablementContext["repository"];
  files?: readonly GitFileStatus[];
  relativePath?: string;
  isFolder?: boolean;
  stashCount?: number;
  shelfCount?: number;
  hasRemote?: boolean;
  mergeChangesCount?: number;
}): GitSubmenuEnablementContext {
  const files = input.files;
  let fileStatus: GitFileStatus | null = null;
  if (input.relativePath && files && !input.isFolder) {
    fileStatus = files.find((f) => f.path === input.relativePath) ?? null;
  }

  const hasStagedChanges =
    files?.some((f) => f.staged || hasIndexChange(f.indexStatus)) ?? false;

  return {
    isFolder: input.isFolder,
    relativePath: input.relativePath,
    fileStatus,
    files,
    repository: input.repository ?? null,
    hasRemote: input.hasRemote,
    stashCount: input.stashCount,
    shelfCount: input.shelfCount,
    hasStagedChanges,
    mergeChangesCount: input.mergeChangesCount,
  };
}