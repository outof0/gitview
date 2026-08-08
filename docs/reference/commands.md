# Commands reference

Command IDs from `package.json` → `contributes.commands`. Titles appear in the Command Palette and menus.

## Core

| Command ID | Title |
| --- | --- |
| `gitView.openGit` | GitView: Open Git workspace |
| `gitView.open` | Resolve conflict (category: Git) |
| `gitView.resolveCurrentFile` | Resolve conflict (category: Git) |
| `gitView.refresh` | GitView: Refresh conflicts |
| `gitView.refreshGitStatus` | GitView: Refresh Git Status |
| `gitView.showGitHistory` | Show History |

## Review tokens

| Command ID | Title |
| --- | --- |
| `gitView.setGithubReviewToken` | GitView: Set GitHub Review Token… |
| `gitView.setGitlabReviewToken` | GitView: Set GitLab Review Token… |
| `gitView.clearGithubReviewToken` | GitView: Clear GitHub Review Token |
| `gitView.clearGitlabReviewToken` | GitView: Clear GitLab Review Token |

## Git submenu (Explorer / editor / SCM)

| Command ID | Title |
| --- | --- |
| `gitView.gitCompareWithRevision` | Compare with Revision… |
| `gitView.gitCompareWithBranch` | Compare with Branch… |
| `gitView.gitShowDiff` | Show Diff |
| `gitView.gitAnnotateBlame` | Annotate with Git Blame |
| `gitView.gitRollback` | Rollback |
| `gitView.gitAdd` | Add |
| `gitView.gitUnstage` | Unstage |
| `gitView.gitCommit` | Commit… |
| `gitView.gitCommitAndPush` | Commit and Push… |
| `gitView.gitFetch` | Fetch |
| `gitView.gitPull` | Pull… |
| `gitView.gitPush` | Push… |
| `gitView.gitSync` | Sync |
| `gitView.gitCheckoutBranch` | Branches… |
| `gitView.gitCreateBranch` | New Branch… |
| `gitView.gitStash` | Stash Changes… |
| `gitView.gitUnstash` | Unstash Changes… |
| `gitView.gitShelve` | Shelve Changes… |
| `gitView.gitUnshelve` | Unshelve Changes… |
| `gitView.gitMerge` | Merge… |
| `gitView.gitRebase` | Rebase… |

Some items use `enablement` context keys driven by `gitSubmenuContext` refresh:

| Context key | Typical when disabled |
| --- | --- |
| `gitView.git.canCommit` | Nothing staged, or unresolved merge conflicts |
| `gitView.git.canFetch` / `canPull` / `canPush` / `canSync` | No remote/upstream, or nothing to push/sync |
| `gitView.git.canStash` / `canShelve` | Clean worktree, **or** merge/rebase/cherry-pick in progress |
| `gitView.git.canUnstash` / `canUnshelve` | Empty stash/shelf list, **or** Git operation in progress |
| `gitView.git.canIntegrate` | Merge/rebase already in progress |

Stash/shelve are **not** safe during unmerged paths (`git stash` fails with `could not write index`). The native Explorer submenu disables them; if still invoked, the host surfaces a clear error instead of a raw Git stderr dump.

For manual testing:

- **Merge / Resolve conflict** → launch `test-conflict-repo` (mid-merge fixture).
- **Stash, commit, branch, remote** → launch `test-clean-repo` (`pnpm run test:setup:clean`).

## Menu placement

Git actions are contributed under the **Git** submenu on Explorer, editor, and SCM resource contexts. See `package.json` → `contributes.menus`.

---

[← Settings](./settings.md) · [Docs index](../README.md) · [Keyboard shortcuts →](./keyboard-shortcuts.md)
