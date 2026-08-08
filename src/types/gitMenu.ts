/** Actions the webview protocol may dispatch (scoped file/history operations). */
export const GIT_MENU_WEBVIEW_ACTIONS = [
  "showHistory",
  "compareWithRevision",
  "compareWithBranch",
  "showDiff",
  "annotateBlame",
  "rollback",
  "add",
  "unstage",
  "cherryPick",
  "revertCommit",
  "checkoutRevision",
  "copyCommitId",
  "copyCommitMessage",
  "getFromRevision",
  "openFile",
  "showHistoryForFile",
  "compareWithLocal",
  "showRevisionDiff",
] as const;

/** Repo-wide actions — context menu + command palette; no file path required. */
export const GIT_MENU_COMMAND_ONLY_ACTIONS = [
  "commit",
  "commitAndPush",
  "fetch",
  "pull",
  "push",
  "sync",
  "checkoutBranch",
  "createBranch",
  "stash",
  "unstash",
  "shelve",
  "unshelve",
  "merge",
  "rebase",
  "openConflictResolver",
] as const;

/** All Git menu actions (webview + command palette). */
export const GIT_MENU_ACTIONS = [
  ...GIT_MENU_WEBVIEW_ACTIONS,
  ...GIT_MENU_COMMAND_ONLY_ACTIONS,
] as const;

export type GitMenuWebviewAction = (typeof GIT_MENU_WEBVIEW_ACTIONS)[number];
export type GitMenuCommandOnlyAction =
  (typeof GIT_MENU_COMMAND_ONLY_ACTIONS)[number];
export type GitMenuAction = (typeof GIT_MENU_ACTIONS)[number];

const gitMenuActionSet = new Set<string>(GIT_MENU_ACTIONS);
const gitMenuWebviewActionSet = new Set<string>(GIT_MENU_WEBVIEW_ACTIONS);

export function isGitMenuAction(value: string): value is GitMenuAction {
  return gitMenuActionSet.has(value);
}

export function isGitMenuWebviewAction(
  value: string,
): value is GitMenuWebviewAction {
  return gitMenuWebviewActionSet.has(value);
}

export type GitMenuActionPayload = {
  action: GitMenuAction;
  /** Active workspace repo when dispatched from GitView Git Workspace. */
  repoId?: string;
  relativePath?: string;
  commitSha?: string;
  commitMessage?: string;
  isFolder?: boolean;
  /** Annotate: reuse one diff tab when browsing commit changed files. */
  reuseDiffPanel?: boolean;
  /** Annotate: open the diff as a normal tab in the active editor group. */
  openInActiveColumn?: boolean;
};

const repoWideActionSet = new Set<string>(GIT_MENU_COMMAND_ONLY_ACTIONS);

export function isRepoWideGitMenuAction(action: GitMenuAction): boolean {
  return repoWideActionSet.has(action);
}

export function buildGitMenuActionPayload(
  action: GitMenuAction,
  opts: { relativePath?: string; isFolder?: boolean } = {},
): GitMenuActionPayload {
  if (isRepoWideGitMenuAction(action)) {
    return { action };
  }

  const payload: GitMenuActionPayload = { action };
  if (opts.relativePath !== undefined) {
    payload.relativePath = opts.relativePath;
  }
  if (opts.isFolder !== undefined) {
    payload.isFolder = opts.isFolder;
  }
  return payload;
}
