# GitView

**See Git clearly.**

**3-way Git merge and Git tools for VS Code** — and editors compatible with the same extension API.

Resolve merge conflicts from real Git index stages (base / ours / theirs), not just `<<<<<<<` markers. Includes file history, blame, compare, and Git actions from the editor context menu.

## Features

- **True 3-way merge** — built from Git stages `:1:` / `:2:` / `:3:`
- **Three-pane editor** — Local · Result · Repository with scroll sync and change-type colors
- **Magic resolve (✦)** — auto-resolve trivial identical conflicts
- **GitView workspace** — desktop-IDE-style Git tool window: widget, changes, commit, branches, log, diff, temporary work, hosted review
- **Git History tab** — commit log, branch filter, inline diff preview
- **Git context menu** — history, compare, blame, rollback, stage, commit, remote ops, branches, stash, merge, rebase
- **Hosted review** — GitHub and GitLab PR/MR list, create PR/MR, filters, line comments, merge/squash/rebase, timeline
- **Keyboard-first** — F7 / Shift+F7, Alt+↑↓, Alt+1/2/3, Ctrl+Enter
- **Theme-aware** — uses VS Code CSS variables; supports light, dark, and high-contrast themes

## Requirements

| Requirement           | Notes                                          |
| --------------------- | ---------------------------------------------- |
| **VS Code 1.85+**     | Or a compatible fork on the same extension API |
| **Git on PATH**       | Extension shells out to the `git` CLI          |
| **Trusted workspace** | Git operations need workspace trust            |

## Security & trust

GitView can **modify files and Git state** in the workspace you open. Only enable it where you trust the folder.

- **Workspace trust** required for Git writes ([docs](https://code.visualstudio.com/docs/editor/workspace-trust))
- **No telemetry** — no usage or repository data sent to external product services
- **Local Git only** — shells out to your `git` CLI and existing credentials

Full detail (what can change the repo, recovery, path safety): [Security & trust guide](docs/guide/security.md).

Reporting a vulnerability: see [SECURITY.md](SECURITY.md) — please do not open a public issue.

## Installation

```bash
# Marketplace (after publish)
code --install-extension gitview.gitview

# Local VSIX
pnpm install && pnpm run package
code --install-extension gitview-<version>.vsix
```

More options (Open VSX, forks): [Installation guide](docs/guide/installation.md).

## Quick start

1. Open a **trusted** Git workspace.
2. Command Palette → **GitView: Open Git workspace** (or the activity-bar icon).
3. During a merge: Explorer → right-click conflicted file → **Git** → **Resolve conflict**.
4. Accept sides / edit Result → **Apply**. Context menu **Git** also covers history, blame, and remotes.

See [Getting started](docs/guide/getting-started.md).

## Editor compatibility

| Editor | Install source | Notes |
| --- | --- | --- |
| **VS Code** | [Marketplace](https://marketplace.visualstudio.com/) | Primary target |
| **Compatible editors and forks** | Open VSX or VSIX | Requires support for the declared `engines.vscode` API |

No Microsoft-proprietary APIs. UI colors use `--vscode-*` host variables.

## Settings

All legacy-compatible keys remain under `gitView.*` — open Settings and search **GitView**.

| Setting | Default | Description |
| --- | --- | --- |
| `mergeEngine` | `threeWay` | Git stages vs worktree markers only |
| `autoStageOnResolved` | `true` | `git add` after Apply |
| `confirmDestructiveActions` | `true` | Confirm discard / history rewrite |
| `updateStrategy` | `merge` | Pull: `merge` · `rebase` · `ff_only` |
| `gitExecutablePath` | `null` | Custom Git binary; `null` = PATH |

Full list: [Settings reference](docs/reference/settings.md) · `package.json` → `contributes.configuration`.

## Extension API

GitView exposes a versioned API for other VS Code extensions. Integrations can
register hosted-review providers, add namespaced webview protocol handlers, and
observe repository refreshes without importing internal modules.

```ts
import * as vscode from "vscode";
import type { GitViewExtensionApi } from "gitview";

const extension = vscode.extensions.getExtension<GitViewExtensionApi>(
  "gitview.gitview",
);
const api = await extension?.activate();

if (api?.apiVersion === 1) {
  const disposable = api.onDidRefresh(({ repoSnapshot }) => {
    console.log(repoSnapshot.repositories.length);
  });
  context.subscriptions.push(disposable);
}
```

See the [Extension API reference](docs/reference/extension-api.md) for provider
and protocol-extension contracts and compatibility rules.

## Documentation

| Section | Audience |
| --- | --- |
| [Guide](docs/guide/introduction.md) | Install, first use, features |
| [Reference](docs/reference/settings.md) | Settings, commands, shortcuts, protocol |
| [Contribute](docs/contribute/development.md) | Local setup & architecture |
| [Maintainers](docs/maintainers/quality-standard.md) | Quality standard, product specs & coverage matrix |

Full index: [docs/README.md](docs/README.md).

## Development

```bash
pnpm install
pnpm run quality        # complete pull-request quality gate
pnpm run check:architecture # dependency direction + purity + cycles
pnpm run check:docs     # local documentation links
pnpm run typecheck      # host + webview TypeScript
pnpm run lint           # oxlint
pnpm run build          # webview + extension
pnpm run check:package  # public declarations + VSIX contents
pnpm run watch          # parallel dev watchers
pnpm run test:unit      # Vitest
pnpm run test:coverage  # coverage thresholds (CI gate)
pnpm run test:int       # @vscode/test-electron
pnpm run test:e2e       # Playwright webview smoke
pnpm run package        # build + bundle budget + VSIX
```

CI (`.github/workflows/ci.yml`): **quality** (architecture, typecheck, lint, unit+coverage, build, bundle, package contract) · **e2e** · **integration**. Release tags rerun this workflow before GitHub Release creation.

Quality policy: [docs/maintainers/quality-standard.md](docs/maintainers/quality-standard.md). Coverage matrix: [docs/maintainers/coverage-matrix.md](docs/maintainers/coverage-matrix.md). Release steps: [RELEASE.md](RELEASE.md).

Launch configs:

- **Run Extension (Merge Conflicts)** → `test-conflict-repo` (mid-merge; resolve conflicts)
- **Run Extension (Clean Git Menu)** → `test-clean-repo` (stash, commit, branch, remotes)

```bash
pnpm run test:setup        # conflict fixture only
pnpm run test:setup:clean  # clean + conflict fixtures
```

## Publishing

Changelog is generated from [Conventional Commits](https://www.conventionalcommits.org/) at release time (same idea as Vue / Antfu projects):

```bash
pnpm run changelog:preview   # dry-run since last tag
pnpm release                 # bump + CHANGELOG.md + tag v* + push
```

Tag push reruns CI, creates generated GitHub Release notes, and attaches the packaged VSIX. Publish to the extension registries with:

```bash
pnpm run package
pnpm exec vsce login <publisher-id>
pnpm exec vsce publish
# Open VSX:
pnpm exec ovsx publish gitview-<version>.vsix -p <OVSX_TOKEN>
```

Full checklist: [RELEASE.md](RELEASE.md). Commit style: [CONTRIBUTING.md](CONTRIBUTING.md).

## Contributing

Start with [CONTRIBUTING.md](CONTRIBUTING.md) for the architecture tour and test
commands. Participation is governed by our
[Code of Conduct](CODE_OF_CONDUCT.md).

Architectural boundaries are enforced in CI by `pnpm run check:architecture`
(layering, dependency cycles, `core/` purity, the Git subprocess choke point).
Run `pnpm run quality` before opening a pull request.

## License

MIT — see [LICENSE](LICENSE).
