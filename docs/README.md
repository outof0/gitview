# GitView Documentation

Documentation for **GitView** — 3-way Git merge and Git tools for VS Code and compatible editors.

Structure follows common open-source projects (Vue / Vite style): **Guide** for learning, **Reference** for lookup, **Contribute** for development, **Maintainers** for internal product specs.

---

## Guide

Start here if you are installing or using the extension.

| Page | Description |
| --- | --- |
| [Introduction](./guide/introduction.md) | What GitView is and when to use it |
| [Getting started](./guide/getting-started.md) | First steps after install |
| [Installation](./guide/installation.md) | Marketplace, Open VSX, and local VSIX |
| [Security & trust](./guide/security.md) | Workspace trust, Git mutations, tokens |
| [Features overview](./guide/features/overview.md) | All major surfaces at a glance |
| [Merge resolver](./guide/features/merge-resolver.md) | 3-way conflict resolution |
| [Git Workspace](./guide/features/git-workspace.md) | Activity-bar Git tool window |
| [History & blame](./guide/features/history-and-blame.md) | Commit log, annotate, compare |
| [Hosted review](./guide/features/hosted-review.md) | GitHub / GitLab PR·MR |

## Reference

| Page | Description |
| --- | --- |
| [Settings](./reference/settings.md) | Full `gitView.*` configuration |
| [Commands](./reference/commands.md) | Command palette & context-menu IDs |
| [Keyboard shortcuts](./reference/keyboard-shortcuts.md) | Merge resolver keys |
| [Protocol](./reference/protocol.md) | Webview ↔ host message protocol (contributors) |
| [Extension API](./reference/extension-api.md) | Stable integration contracts for other extensions |
| [Stability & versioning](./reference/stability.md) | Public vs internal surfaces, SemVer, deprecation policy |

## Contribute

| Page | Description |
| --- | --- |
| [Development](./contribute/development.md) | Architecture overview & local setup |
| [Contributing guide](../CONTRIBUTING.md) | PR process, tests, protocol checklist |
| [Release checklist](../RELEASE.md) | Publish gates |

## Maintainers

Internal product specs (not required reading for end users).

| Page | Description |
| --- | --- |
| [Quality standard](./maintainers/quality-standard.md) | Normative scorecard, architecture invariants, gates, and exception policy |
| [Experience spec](./maintainers/experience-spec.md) | Full product behavior contract |
| [Coverage matrix](./maintainers/coverage-matrix.md) | Workflow × surface × tests |
| [Exceptions](./maintainers/exceptions.md) | Product exceptions & copy ownership |

## Project root

| File | Description |
| --- | --- |
| [README](../README.md) | Project home |
| [CHANGELOG](../CHANGELOG.md) | Release notes |
| [LICENSE](../LICENSE) | MIT |
