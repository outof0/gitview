# Security & trust

GitView runs **inside your editor** and can **modify files and Git state**. Only enable it in workspaces you trust.

## Workspace trust

Git write operations require a [trusted workspace](https://code.visualstudio.com/docs/editor/workspace-trust). In untrusted mode, mutations stay blocked until you trust the folder.

## What can change your repository

| Area | Examples |
| --- | --- |
| Merge resolver | Apply, Mark Resolved, Accept Yours/Theirs, auto-stage on resolve |
| File writes | Merged result, non-conflicting hunk apply |
| History / menu | Rollback, Get from Revision, Cherry-Pick, Revert, Checkout, Stage/Unstage |
| Remote / branch | Pull, Push, Sync, Merge, Rebase, Stash, Shelve |

## Data handling

- **No telemetry** — the extension does not send usage or repository data to GitView servers.
- **Local Git** — operations use your `git` CLI; remotes use your existing credentials.
- **Review tokens** — prefer Command Palette token commands (Secret Storage). Plaintext settings `githubReviewToken` / `gitlabReviewToken` are deprecated fallbacks and migrate into Secret Storage on use.

## Recovery

Use normal Git tooling when something goes wrong:

- `git status`, `git diff`, `git reflog`
- `git restore <file>`
- `git merge --abort` / `git rebase --abort` while an operation is in progress

In the **Git Workspace** widget, Continue / Skip / Abort appear when a merge, rebase, cherry-pick, or revert is in progress.

## Path safety

Host handlers validate repository-relative paths before file or Git mutations. Webview messages cannot write outside the resolved repo root.

---

[Docs index](../README.md) · [Getting started](./getting-started.md) · [Settings reference →](../reference/settings.md)
