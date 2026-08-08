import type { GitMenuAction } from "./gitMenu";

export const RESOURCE_FILE_WHEN = "resourceScheme == file";

/** File-only rows: hide on Explorer folders but keep visible in editor context. */
export const FILE_ONLY_WHEN =
  `${RESOURCE_FILE_WHEN} && !(explorerViewletVisible && explorerResourceIsFolder)`;

export const MERGE_CHANGES_WHEN = "git.mergeChangesCount != 0";

/** Editor title bar — show resolve when the open file is an unmerged path. */
export const EDITOR_CONFLICT_RESOLVE_WHEN =
  "resource in git.mergeChanges && !isInDiffEditor && !isMergeEditor && resourceScheme == file";

/** Place the Git submenu near the bottom of Explorer / editor context menus. */
export const GIT_SUBMENU_CONTEXT_GROUP = "z_git@1";

/** Resolve conflict — first row inside the Git submenu when merge changes exist. */
export const RESOLVE_CONFLICT_GROUP = "0_merge@1";

/** Default chord for opening the merge resolver from the active editor. */
export const RESOLVE_CONFLICT_KEYBINDING_WHEN =
  "git.mergeChangesCount != 0 && editorTextFocus && resourceScheme == file && git.activeResourceHasMergeConflicts";

export type GitSubmenuScope = "resource" | "file" | "repository" | "merge";

export type GitSubmenuHistoryAction = "showHistory";

export type GitSubmenuSpecialAction =
  | GitSubmenuHistoryAction
  | "openConflictResolver";

export type GitSubmenuItem = {
  command: string;
  action: GitMenuAction | GitSubmenuSpecialAction;
  title: string;
  group: string;
  scope: GitSubmenuScope;
  testId: string;
  feature: string;
  when?: string;
  /** Annotate row — merge resolver may route through onAnnotateBlame. */
  annotate?: boolean;
  /** Native Explorer submenu only (e.g. Open Conflict Resolver). */
  nativeOnly?: boolean;
};

/**
 * Git submenu manifest — shared by native VS Code contributes.menus and
 * webview context menus (Workspace Changes, merge resolver, conflicts dialog).
 */
export const GIT_SUBMENU_ITEMS = [
  {
    command: "gitView.open",
    action: "openConflictResolver",
    title: "Resolve conflict",
    group: RESOLVE_CONFLICT_GROUP,
    scope: "merge",
    when: MERGE_CHANGES_WHEN,
    testId: "git-menu-open-conflict-resolver",
    feature: "Files Merged with Conflicts dialog / merge resolver",
    nativeOnly: true,
  },
  {
    command: "gitView.showGitHistory",
    action: "showHistory",
    title: "Show History",
    group: "1_history@1",
    scope: "resource",
    testId: "git-menu-show-history",
    feature: "Git Log / file history",
  },
  {
    command: "gitView.gitCompareWithRevision",
    action: "compareWithRevision",
    title: "Compare with Revision…",
    group: "1_history@2",
    scope: "file",
    when: FILE_ONLY_WHEN,
    testId: "git-menu-compare-revision",
    feature: "Diff Viewer for file revisions",
  },
  {
    command: "gitView.gitCompareWithBranch",
    action: "compareWithBranch",
    title: "Compare with Branch…",
    group: "1_history@3",
    scope: "file",
    when: FILE_ONLY_WHEN,
    testId: "git-menu-compare-branch",
    feature: "Diff Viewer for branch comparison",
  },
  {
    command: "gitView.gitShowDiff",
    action: "showDiff",
    title: "Show Diff",
    group: "1_history@4",
    scope: "file",
    when: FILE_ONLY_WHEN,
    testId: "git-menu-show-diff",
    feature: "Diff Viewer",
  },
  {
    command: "gitView.gitAnnotateBlame",
    action: "annotateBlame",
    title: "Annotate with Git Blame",
    group: "2_local@1",
    scope: "file",
    when: FILE_ONLY_WHEN,
    testId: "git-menu-annotate",
    feature: "Annotate with Git Blame",
    annotate: true,
  },
  {
    command: "gitView.gitRollback",
    action: "rollback",
    title: "Rollback",
    group: "2_local@2",
    scope: "file",
    when: FILE_ONLY_WHEN,
    testId: "git-menu-rollback",
    feature: "Rollback local changes",
  },
  {
    command: "gitView.gitAdd",
    action: "add",
    title: "Add",
    group: "2_local@3",
    scope: "resource",
    testId: "git-menu-add",
    feature: "Add files to Git",
  },
  {
    command: "gitView.gitUnstage",
    action: "unstage",
    title: "Unstage",
    group: "2_local@4",
    scope: "resource",
    testId: "git-menu-unstage",
    feature: "Unstage changes",
  },
  {
    command: "gitView.gitCommit",
    action: "commit",
    title: "Commit…",
    group: "3_commit@1",
    scope: "repository",
    testId: "git-menu-commit",
    feature: "Commit changes",
  },
  {
    command: "gitView.gitCommitAndPush",
    action: "commitAndPush",
    title: "Commit and Push…",
    group: "3_commit@2",
    scope: "repository",
    testId: "git-menu-commit-and-push",
    feature: "Commit and push changes",
  },
  {
    command: "gitView.gitFetch",
    action: "fetch",
    title: "Fetch",
    group: "4_remote@1",
    scope: "repository",
    testId: "git-menu-fetch",
    feature: "Fetch",
  },
  {
    command: "gitView.gitPull",
    action: "pull",
    title: "Pull…",
    group: "4_remote@2",
    scope: "repository",
    testId: "git-menu-pull",
    feature: "Pull",
  },
  {
    command: "gitView.gitPush",
    action: "push",
    title: "Push…",
    group: "4_remote@3",
    scope: "repository",
    testId: "git-menu-push",
    feature: "Push",
  },
  {
    command: "gitView.gitSync",
    action: "sync",
    title: "Sync",
    group: "4_remote@4",
    scope: "repository",
    testId: "git-menu-sync",
    feature: "Update project",
  },
  {
    command: "gitView.gitCheckoutBranch",
    action: "checkoutBranch",
    title: "Branches…",
    group: "5_vcs@1",
    scope: "repository",
    testId: "git-menu-branches",
    feature: "Branches popup",
  },
  {
    command: "gitView.gitCreateBranch",
    action: "createBranch",
    title: "New Branch…",
    group: "5_vcs@2",
    scope: "repository",
    testId: "git-menu-new-branch",
    feature: "Create branch",
  },
  {
    command: "gitView.gitStash",
    action: "stash",
    title: "Stash Changes…",
    group: "5_vcs@3",
    scope: "repository",
    testId: "git-menu-stash",
    feature: "Stash changes",
  },
  {
    command: "gitView.gitUnstash",
    action: "unstash",
    title: "Unstash Changes…",
    group: "5_vcs@4",
    scope: "repository",
    testId: "git-menu-unstash",
    feature: "Unstash changes",
  },
  {
    command: "gitView.gitShelve",
    action: "shelve",
    title: "Shelve Changes…",
    group: "5_vcs@5",
    scope: "repository",
    testId: "git-menu-shelve",
    feature: "Shelve changes",
  },
  {
    command: "gitView.gitUnshelve",
    action: "unshelve",
    title: "Unshelve Changes…",
    group: "5_vcs@6",
    scope: "repository",
    testId: "git-menu-unshelve",
    feature: "Unshelve changes",
  },
  {
    command: "gitView.gitMerge",
    action: "merge",
    title: "Merge…",
    group: "6_integrate@1",
    scope: "repository",
    testId: "git-menu-merge",
    feature: "Merge branch",
  },
  {
    command: "gitView.gitRebase",
    action: "rebase",
    title: "Rebase…",
    group: "6_integrate@2",
    scope: "repository",
    testId: "git-menu-rebase",
    feature: "Rebase branch",
  },
] as const satisfies readonly GitSubmenuItem[];

export type GitSubmenuRenderOptions = {
  showAnnotate?: boolean;
  includeNativeOnly?: boolean;
};

export function gitSubmenuGroupKey(group: string): string {
  const at = group.indexOf("@");
  return at === -1 ? group : group.slice(0, at);
}

/** Section header for webview Git context menus (IDE tool-window density). */
export function gitSubmenuSectionLabel(groupKey: string): string | null {
  switch (groupKey) {
    case "0_merge":
      return "Conflicts";
    case "1_history":
      return "History";
    case "2_local":
      return "Local";
    case "3_commit":
      return "Commit";
    case "4_remote":
      return "Remote";
    case "5_vcs":
      return "Branch & temporary work";
    case "6_integrate":
      return "Integrate";
    default:
      return null;
  }
}

export function isFileOnlyScope(scope: GitSubmenuScope): boolean {
  return scope === "file";
}

export function findGitSubmenuItem(
  action: GitMenuAction,
): GitSubmenuItem | undefined {
  return GIT_SUBMENU_ITEMS.find((row) => row.action === action) as
    | GitSubmenuItem
    | undefined;
}

/** Submenu rows rendered in webview context menus. */
export function getGitSubmenuItems(
  opts: GitSubmenuRenderOptions = {},
): GitSubmenuItem[] {
  const showAnnotate = opts.showAnnotate ?? true;
  const includeNativeOnly = opts.includeNativeOnly ?? false;

  return GIT_SUBMENU_ITEMS.filter((item) => {
    if ("nativeOnly" in item && item.nativeOnly && !includeNativeOnly) {
      return false;
    }
    if ("annotate" in item && item.annotate && !showAnnotate) {
      return false;
    }
    return true;
  });
}
