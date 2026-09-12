# Changelog

<!-- Generated from Conventional Commits by `pnpm release` (changelogen). -->
<!-- Do not edit by hand — see CONTRIBUTING.md. -->

## v0.1.1

[compare changes](https://github.com/outof0/gitview/compare/v0.1.0...v0.1.1)

### Features

- **git:** Harden repository workflows and integrations ([5356b81](https://github.com/outof0/gitview/commit/5356b81))
- **webview:** Complete GitView workspace experience ([17c23d6](https://github.com/outof0/gitview/commit/17c23d6))
- **git:** Harden repository workflows and integrations ([4559ef8](https://github.com/outof0/gitview/commit/4559ef8))
- **host:** Route Git workspace requests through typed handlers ([35115ea](https://github.com/outof0/gitview/commit/35115ea))
- **webview:** Host each GitView surface in its own panel ([9202a25](https://github.com/outof0/gitview/commit/9202a25))
- **webview:** Add commit composer, toolbar and options dialog ([e7f431b](https://github.com/outof0/gitview/commit/e7f431b))
- **webview:** Add rollback changes dialog ([f9e9206](https://github.com/outof0/gitview/commit/f9e9206))
- **webview:** Rebuild the workspace changes and diff tabs ([029a4c6](https://github.com/outof0/gitview/commit/029a4c6))
- **webview:** Rework the log graph, stores and protocol client ([14deae8](https://github.com/outof0/gitview/commit/14deae8))
- **webview:** Lazy-load Monaco languages and refresh theme tokens ([935f395](https://github.com/outof0/gitview/commit/935f395))
- **git:** Stabilize paged history and graph rendering ([7a9d149](https://github.com/outof0/gitview/commit/7a9d149))

### Bug Fixes

- **gitview:** Stop silent data loss in shelf, drop-selected and branch apply ([949f469](https://github.com/outof0/gitview/commit/949f469))
- **gitview:** Clean log graph and slim scrollbars ([e053995](https://github.com/outof0/gitview/commit/e053995))

### Refactors

- **core:** Retire patchDocument and tighten merge resolution ([83d5b77](https://github.com/outof0/gitview/commit/83d5b77))
- **commands:** Open panel dialogs from the native Git menus ([e8535c3](https://github.com/outof0/gitview/commit/e8535c3))
- **webview:** Move blame into a dedicated editor panel ([efa441b](https://github.com/outof0/gitview/commit/efa441b))

### Documentation

- Fix security reporting links, add e2e coverage, tighten CI and packaging ([9c77afb](https://github.com/outof0/gitview/commit/9c77afb))
- Rewrite the README and refresh the maintainer docs ([5cf753d](https://github.com/outof0/gitview/commit/5cf753d))
- **quality:** State the coverage floor rationale and follow-up ([47c38f2](https://github.com/outof0/gitview/commit/47c38f2))
- **readme:** Lead with the approved line, detail 0.1.1, ship lighter screenshots ([282b159](https://github.com/outof0/gitview/commit/282b159))

### Chores

- **release:** V0.1.0 ([2ffdbb3](https://github.com/outof0/gitview/commit/2ffdbb3))
- **release:** Restore v0.1.0 lineage ([bf1bc0f](https://github.com/outof0/gitview/commit/bf1bc0f))
- Align release quality and documentation ([3a164cc](https://github.com/outof0/gitview/commit/3a164cc))
- **ci:** Tighten workflows, packaging and brand tokens ([6ec2c74](https://github.com/outof0/gitview/commit/6ec2c74))
- **git:** Name the temp-dir cleanup catch exemptions ([2c414b7](https://github.com/outof0/gitview/commit/2c414b7))

### Tests

- **e2e:** Expand native GitView coverage ([1d2453b](https://github.com/outof0/gitview/commit/1d2453b))
- **e2e:** Expand native GitView coverage ([ee00b2c](https://github.com/outof0/gitview/commit/ee00b2c))
- **git:** Cover paged history and graph behavior ([f3d3e1b](https://github.com/outof0/gitview/commit/f3d3e1b))
- **e2e:** Cover history pagination flow ([ae300cd](https://github.com/outof0/gitview/commit/ae300cd))
- **git:** Cover graph edge cases ([ba10aec](https://github.com/outof0/gitview/commit/ba10aec))

### ❤️ Contributors

- OutOf0 <hello.outof0@gmail.com>

## v0.1.0 — 2026-08-08

Initial public release.

### Highlights

- Three-way conflict resolution from Git index stages with synchronized Local, Result, and Repository panes.
- GitView workspace for changes, commits, branches, history, diff, temporary work, and hosted reviews.
- Explorer, editor, and SCM Git actions for staging, rollback, remotes, branches, stash, merge, and rebase.
- Versioned extension API and validated host/webview protocol for third-party integrations.
- Workspace Trust enforcement, SecretStorage-backed review credentials, and no product telemetry.
