# Development

Short orientation for contributors. Full process, PR gates, and protocol checklist:

**[CONTRIBUTING.md](../../CONTRIBUTING.md)** · **[RELEASE.md](../../RELEASE.md)**

## Docs map

| Audience | Location |
| --- | --- |
| End users | [Guide](../guide/introduction.md) · [Reference](../reference/settings.md) |
| Contributors | This page · [CONTRIBUTING](../../CONTRIBUTING.md) · [Protocol](../reference/protocol.md) |
| Maintainers | [Quality standard](../maintainers/quality-standard.md) · [Experience spec](../maintainers/experience-spec.md) · [Coverage](../maintainers/coverage-matrix.md) · [Exceptions](../maintainers/exceptions.md) |

## Architecture

```
src/
  core/           Pure merge engine (no vscode / I/O)
  services/       Git + filesystem adapters
  webview/        Host panel bootstrap
  webviewHost/    Message router + handlers
  commands/       VS Code command registration
  shared/         Protocol + shared types
  config/         Settings readers
webview/          React UI (Vite)
```

### Contracts

- **`src/core/`** — no `vscode`, `fs`, or React; deterministic pure functions.
- **`src/shared/`** — serializable protocol/types; no VS Code APIs.
- **`webview/`** — no Node / Git services; talks to host via protocol client only.
- **Git mutations** — go through `GitService` on the host.

## Quick start

```bash
pnpm install
pnpm run quality
```

Launch configurations (`.vscode/launch.json`):

| Config | Workspace | Use for |
| --- | --- | --- |
| **Run Extension (Merge Conflicts)** | `test-conflict-repo` | Resolve conflict, merge UI, mid-merge enablement |
| **Run Extension (Clean Git Menu)** | `test-clean-repo` | Stash, shelve, commit, branch, remote actions |
| **Run Extension** | `test-conflict-repo` | Alias of Merge Conflicts |

Pre-launch tasks regenerate the fixtures (`setup-test-repo.sh` / `setup-test-clean-repo.sh`) then build.

| Script | Purpose |
| --- | --- |
| `pnpm run watch` | Parallel host + webview watchers |
| `pnpm run test:setup` | Mid-merge fixture (`test-conflict-repo`) |
| `pnpm run test:setup:clean` | Clean Git fixture (`test-clean-repo` + conflict repo) |
| `pnpm run test:int` | Extension host integration |
| `pnpm run test:e2e` | Playwright native + webview E2E |
| `pnpm run test:e2e:visual` | Mock webview screenshot baselines (Git menu density) |
| `pnpm run test:e2e:visual:update` | Update visual baselines after intentional UI changes |
| `pnpm run check:architecture` | Enforce dependency direction, purity, cycles, and exception expiry |
| `pnpm run check:docs` | Validate local links across contributor and project documentation |
| `pnpm run quality` | Complete pull-request quality gate |
| `pnpm run quality:release` | Quality + integration + E2E + packaged VSIX |
| `pnpm run package` | Build + bundle and package checks + VSIX |
| `pnpm run changelog:preview` | Preview notes from commits since last tag |
| `pnpm release` | Bump version, write `CHANGELOG.md`, tag `v*`, push |

UI density tokens and Git menu guidance: [ui-density.md](../maintainers/ui-density.md).

**Do not** expect Stash / Commit / Push to work on the default conflict fixture — it is left mid-merge on purpose. Use **Clean Git Menu** for those flows.

Use [Conventional Commits](https://www.conventionalcommits.org/) so changelogs generate cleanly. Details: [CONTRIBUTING.md](../../CONTRIBUTING.md) · [RELEASE.md](../../RELEASE.md).

## Protocol

Webview ↔ host uses a **single** envelope (no product “v2” transport). Spec:

→ [Protocol reference](../reference/protocol.md)

## Quality gates

Before opening a PR:

```bash
pnpm run quality
```

For host or webview workflow changes, also run the relevant `test:int` / `test:e2e` scope. See the [quality standard](../maintainers/quality-standard.md) for the risk matrix and release-blocking policy.
