import { GIT_SUBMENU_ITEMS } from "./gitSubmenu";

export type GitSubmenuUxSurface =
  | "gitview-history-panel"
  | "gitview-panel"
  | "gitview-blame-panel"
  | "gitview-merge-resolver"
  | "git-index-mutation"
  | "git-repo-mutation"
  | "quick-pick"
  | "confirmation-dialog"
  | "input-box";

export type GitSubmenuAuditEntry = {
  command: string;
  title: string;
  surface: GitSubmenuUxSurface;
  /** Integration test name fragment in explorerGitMenu.integration.test.ts */
  integration: string;
  /** Native Playwright spec file (null = vite/webview only or repo mutation without UI) */
  nativeE2e: string | null;
};

/**
 * Explorer Git submenu audit matrix — every contributed command must map to a
 * primary UX surface and at least one automated coverage owner.
 */
export const GIT_SUBMENU_AUDIT = [
  {
    command: "gitView.showGitHistory",
    title: "Show History",
    surface: "gitview-history-panel",
    integration: "Show History",
    nativeE2e: "e2e/native-git-history-screen.spec.ts",
  },
  {
    command: "gitView.gitCompareWithRevision",
    title: "Compare with Revision…",
    surface: "gitview-panel",
    integration: "Compare with Revision",
    nativeE2e: "e2e/native-git-diff-screen.spec.ts",
  },
  {
    command: "gitView.gitCompareWithBranch",
    title: "Compare with Branch…",
    surface: "gitview-panel",
    integration: "Compare with Branch",
    nativeE2e: "e2e/native-git-diff-screen.spec.ts",
  },
  {
    command: "gitView.gitShowDiff",
    title: "Show Diff",
    surface: "gitview-panel",
    integration: "Show Diff",
    nativeE2e: "e2e/native-git-diff-screen.spec.ts",
  },
  {
    command: "gitView.gitAnnotateBlame",
    title: "Annotate with Git Blame",
    surface: "gitview-blame-panel",
    integration: "Annotate",
    nativeE2e: "e2e/native-git-blame-screen.spec.ts",
  },
  {
    command: "gitView.gitRollback",
    title: "Rollback",
    surface: "confirmation-dialog",
    integration: "Rollback",
    nativeE2e: "e2e/native-vscode-git-submenu.spec.ts",
  },
  {
    command: "gitView.gitAdd",
    title: "Add",
    surface: "git-index-mutation",
    integration: "gitAdd",
    nativeE2e: "e2e/native-vscode-git-submenu.spec.ts",
  },
  {
    command: "gitView.gitUnstage",
    title: "Unstage",
    surface: "git-index-mutation",
    integration: "gitUnstage",
    nativeE2e: "e2e/native-vscode-git-submenu.spec.ts",
  },
  {
    command: "gitView.gitCommit",
    title: "Commit…",
    surface: "input-box",
    integration: "gitCommit",
    nativeE2e: "e2e/native-vscode-git-submenu.spec.ts",
  },
  {
    command: "gitView.gitCommitAndPush",
    title: "Commit and Push…",
    surface: "input-box",
    integration: "gitCommitAndPush",
    nativeE2e: "e2e/native-vscode-git-submenu.spec.ts",
  },
  {
    command: "gitView.gitFetch",
    title: "Fetch",
    surface: "git-repo-mutation",
    integration: "gitFetch",
    nativeE2e: "e2e/native-vscode-git-submenu.spec.ts",
  },
  {
    command: "gitView.gitPull",
    title: "Pull…",
    surface: "git-repo-mutation",
    integration: "gitPull",
    nativeE2e: "e2e/native-vscode-git-submenu.spec.ts",
  },
  {
    command: "gitView.gitPush",
    title: "Push…",
    surface: "git-repo-mutation",
    integration: "gitPush",
    nativeE2e: "e2e/native-vscode-git-submenu.spec.ts",
  },
  {
    command: "gitView.gitSync",
    title: "Sync",
    surface: "git-repo-mutation",
    integration: "gitSync",
    nativeE2e: "e2e/native-vscode-git-submenu.spec.ts",
  },
  {
    command: "gitView.gitCheckoutBranch",
    title: "Branches…",
    surface: "quick-pick",
    integration: "gitCheckoutBranch",
    nativeE2e: "e2e/native-vscode-git-submenu.spec.ts",
  },
  {
    command: "gitView.gitCreateBranch",
    title: "New Branch…",
    surface: "input-box",
    integration: "gitCreateBranch",
    nativeE2e: "e2e/native-vscode-git-submenu.spec.ts",
  },
  {
    command: "gitView.gitStash",
    title: "Stash Changes…",
    surface: "git-repo-mutation",
    integration: "gitStash",
    nativeE2e: "e2e/native-vscode-git-submenu.spec.ts",
  },
  {
    command: "gitView.gitUnstash",
    title: "Unstash Changes…",
    surface: "git-repo-mutation",
    integration: "gitUnstash",
    nativeE2e: "e2e/native-vscode-git-submenu.spec.ts",
  },
  {
    command: "gitView.gitShelve",
    title: "Shelve Changes…",
    surface: "git-repo-mutation",
    integration: "gitShelve",
    nativeE2e: "e2e/native-vscode-git-submenu.spec.ts",
  },
  {
    command: "gitView.gitUnshelve",
    title: "Unshelve Changes…",
    surface: "git-repo-mutation",
    integration: "gitUnshelve",
    nativeE2e: "e2e/native-vscode-git-submenu.spec.ts",
  },
  {
    command: "gitView.gitMerge",
    title: "Merge…",
    surface: "quick-pick",
    integration: "gitMerge",
    nativeE2e: "e2e/native-vscode-git-submenu.spec.ts",
  },
  {
    command: "gitView.gitRebase",
    title: "Rebase…",
    surface: "quick-pick",
    integration: "gitRebase",
    nativeE2e: "e2e/native-vscode-git-submenu.spec.ts",
  },
  {
    command: "gitView.open",
    title: "Resolve conflict",
    surface: "gitview-merge-resolver",
    integration: "gitView.open",
    nativeE2e: "e2e/native-vscode-git-submenu.spec.ts",
  },
] as const satisfies readonly GitSubmenuAuditEntry[];

const auditByCommand = new Map<string, GitSubmenuAuditEntry>(
  GIT_SUBMENU_AUDIT.map((entry) => [entry.command, entry]),
);

/** Returns audit rows whose commands are missing from the manifest or vice versa. */
export function gitSubmenuAuditGaps(): string[] {
  const gaps: string[] = [];
  const manifestCommands = new Set<string>(
    GIT_SUBMENU_ITEMS.map((item) => item.command),
  );

  for (const command of manifestCommands) {
    if (!auditByCommand.has(command)) {
      gaps.push(`missing audit entry for ${command}`);
    }
  }
  for (const entry of GIT_SUBMENU_AUDIT) {
    if (!manifestCommands.has(entry.command)) {
      gaps.push(`audit entry ${entry.command} is not in GIT_SUBMENU_ITEMS`);
    }
  }
  return gaps;
}

export function getGitSubmenuAuditEntry(
  command: string,
): GitSubmenuAuditEntry | undefined {
  return auditByCommand.get(command);
}