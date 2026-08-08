# Introduction

**GitView** is a VS Code extension (and compatible forks) that provides a complete Git workflow in the editor: true 3-way merge conflict resolution, a Git workspace tool window, history, blame, compare, and hosted pull-request / merge-request review.

## What problem it solves

Built-in conflict UIs often only parse `<<<<<<<` markers. GitView builds conflicts from **Git index stages** (`:1:` base, `:2:` ours, `:3:` theirs) so you see the real merge state Git is using.

Beyond merge, it brings a dense, keyboard-friendly Git surface similar to desktop IDEs—without replacing your local `git` CLI or remotes.

## Who it is for

- Developers who merge frequently and want a dedicated merge studio
- Teams that want history, blame, and staging from the Explorer context menu
- Users of VS Code, Cursor, VSCodium, Windsurf, and other VS Code-compatible editors

## Requirements

| Requirement | Notes |
| --- | --- |
| VS Code **1.85+** (or fork) | Same extension API surface |
| **Git** on `PATH` | Or set `gitView.gitExecutablePath` |
| **Trusted workspace** | Required for Git write operations |

## Next steps

- [Getting started](./getting-started.md)
- [Installation](./installation.md)
- [Features overview](./features/overview.md)

---

[Docs index](../README.md) · Next: [Getting started →](./getting-started.md)
