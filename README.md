# GitView

**All of Git, one window.**

Your Git is spread across five places — history in one extension, blame in another, the graph
in a third, stash in the terminal. Commit, read history, blame a line, switch branches, stash,
rebase, cherry-pick and review pull requests from one panel: the Git tool window you get in a
JetBrains IDE, without leaving VS Code. When a merge does break, resolve it from the real Git
index stages.

**MIT · no account · no telemetry · commit graph works on private repos too.**

**[Install for VS Code](https://marketplace.visualstudio.com/items?itemName=gitview.gitview)**
· [Open VSX](https://open-vsx.org/extension/gitview/gitview)
· [gitview.dev](https://gitview.dev)

![GitView Git workspace — changes, commit, branches, log and diff in one panel](https://raw.githubusercontent.com/outof0/gitview/main/docs/launch/readme/workspace.png)

---

## What you get

| Area | What it does |
| --- | --- |
| **Git workspace** | `git status` → stage → commit, with the diff beside the file list. The panel you open on a normal day. |
| **History** | Visual commit graph with ref labels (`HEAD`, `origin/main`), per-file filter, file tree, inline diff. The equivalent of `git log --graph --decorate`, rendered. |
| **Blame** | Inline annotations — author, SHA, date, message. Click through to history. |
| **Branches** | Local and remote, current marker, checkout, create, delete. |
| **Stash · rebase · cherry-pick** | A real UI for the commands you would otherwise type. |
| **Hosted review** | GitHub and GitLab PR / MR list, filters, line comments, merge / squash / rebase, timeline. |
| **3-way merge** | Reads `:1:` base · `:2:` ours · `:3:` theirs straight from the Git index. |
| **Native context menus** | Right-click in Explorer, editor or SCM for history, compare, blame, rollback, stage, commit, remote ops, merge, rebase. |
| **Keyboard-first** | `F7` / `Shift+F7` conflicts · `Alt+↑↓` hunks · `Alt+1/2/3` panes · `Ctrl+Enter` commit. |
| **Theme-aware** | Uses the host `--vscode-*` variables — light, dark and high-contrast all look native. |

![GitView history — branch tree, commit graph and file tree](https://raw.githubusercontent.com/outof0/gitview/main/docs/launch/readme/history.png)

## 3-way merge that reads Git, not a guess

Most merge tooling in editors now hands the hard hunks to a model. GitView does not.

It reads the three versions Git itself writes into the index — `:1:` base, `:2:` ours,
`:3:` theirs — and runs them through your own `git` CLI. The **✦ auto-resolve** button only
fires when both sides wrote a byte-identical block; it never invents content. Everything
else is a decision you make, in a three-pane editor with a live result preview.

![GitView 3-way merge editor — base, ours, theirs and the editable result](https://raw.githubusercontent.com/outof0/gitview/main/docs/launch/readme/merge.png)

That matters for the conflicts AI gets wrong most often: whitespace-only edits, rename
plus edit, and binary hunks. Review the result before you apply it — nothing is written
until you say so.

![GitView blame — author, commit and date inline](https://raw.githubusercontent.com/outof0/gitview/main/docs/launch/readme/blame.png)

## Why GitView exists

- **One window, not five.** History in one extension, blame in another, graph in a third,
  merge in a fourth, stash in the terminal. GitView puts the daily loop in one panel.
- **No account, no paid tier.** The commit graph, full history and blame work on public
  *and* private repositories. No login, no sync prompt, no upgrade nag.
- **No telemetry.** Nothing phones home. Git operations run against your local `git` CLI
  and stay on your machine; hosted review talks to the GitHub or GitLab API you configure,
  with a token kept in Secret Storage.
- **Deterministic.** Auto-resolve is conservative diff/merge logic — no network service, no
  model, no AI. Same input, same output, every time.

## Install

| Editor | How to install |
| --- | --- |
| **VS Code** | [Marketplace](https://marketplace.visualstudio.com/items?itemName=gitview.gitview) → Install, or `code --install-extension gitview.gitview` |
| **Cursor · Windsurf · VSCodium · Antigravity** | [Open VSX](https://open-vsx.org/extension/gitview/gitview) — or download the VSIX below |
| **Offline / air-gapped** | Grab `gitview-0.1.1.vsix` from [GitHub Releases](https://github.com/outof0/gitview/releases/latest), then **Extensions → ⋯ → Install from VSIX** |

## Requirements

| Requirement | Why |
| --- | --- |
| **VS Code 1.85+** | Or any editor or fork on the same extension API |
| **Git on PATH** | GitView shells out to your `git` CLI |
| **Trusted workspace** | Git writes require workspace trust ([docs](https://code.visualstudio.com/docs/editor/workspace-trust)) |

## Quick start

1. Open a **trusted** Git workspace.
2. Command Palette → **GitView: Open Git workspace** — or click the GitView icon in the
   activity bar.
3. That's it. Changes, commit, branches, history, blame and diff are in that panel.

During a merge: right-click a conflicted file in the Explorer → **Git** → **Resolve conflict**.

Full walkthrough: [getting started](https://github.com/outof0/gitview/blob/main/docs/guide/getting-started.md).

## What's new in 0.1.1

Completes the workspace experience and hardens the repository workflows.

- **Commit flow** — a real commit composer and toolbar, with sign-off, GPG signing and hook
  options, plus a commit sidebar in the activity bar.
- **Rollback** — a Rollback Changes dialog with a per-file tree and a typed confirmation before
  anything is discarded.
- **Blame** — annotations now open in the editor area, with file history coordinated from the
  workspace panel.
- **Room to breathe** — commit, branches and rollback open as their own editor-area surfaces
  instead of being crushed into a 258px panel.
- **Fixes** — silent data loss in shelf, drop-selected and branch apply; a cleaner commit graph
  with slimmer scrollbars.
- **Under the hood** — lazy-loaded Monaco language support, wider end-to-end coverage, tighter
  CI and cleaner packaging.

[Full changelog](https://github.com/outof0/gitview/blob/main/CHANGELOG.md).

## Known limits

We would rather you read these here than discover them later.

- The hosted review board is preview-quality — it works, it is not yet as dense as the rest.
- No submodule panel and no Git LFS panel yet.
- Merge behaviour follows the `git` on your PATH. If your Git is old, GitView is too.

## Trust

GitView writes files and Git state in the workspace you open. Use it where you trust the folder.

- **No telemetry.** No product phone-home, ever. There is no GitView server to phone.
- Local `git` operations stay local and use your existing credentials.
- Hosted review calls the configured GitHub or GitLab API only when you use that feature.
- Detail: [security guide](https://github.com/outof0/gitview/blob/main/docs/guide/security.md) ·
  reports: [SECURITY.md](https://github.com/outof0/gitview/blob/main/SECURITY.md).

## Documentation

- User guide: [docs/guide/introduction.md](https://github.com/outof0/gitview/blob/main/docs/guide/introduction.md)
- Settings, commands, shortcuts: [docs/reference/](https://github.com/outof0/gitview/tree/main/docs/reference)
- Extension API: [docs/reference/extension-api.md](https://github.com/outof0/gitview/blob/main/docs/reference/extension-api.md)
- Build from source: [docs/contribute/development.md](https://github.com/outof0/gitview/blob/main/docs/contribute/development.md)

## License

[MIT](https://github.com/outof0/gitview/blob/main/LICENSE). Fork it, patch it, ship your own build.
