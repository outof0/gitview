# Contributing to GitView

Thank you for helping improve GitView. This guide explains how the codebase is organized and how to run tests.

User-facing docs live under [`docs/`](docs/README.md) (**Guide** · **Reference** · **Contribute** · **Maintainers**). Short local setup: [docs/contribute/development.md](docs/contribute/development.md).

Using an AI coding agent? Point it at [AGENTS.md](AGENTS.md).

## Architecture

```
src/
  core/          Pure merge engine (no vscode, no I/O)
  services/      Git + filesystem adapters
  webview/       Host ↔ React RPC bridge
  commands/      VS Code command handlers
  types/         Shared TypeScript contracts
  config/        VS Code settings readers

webview/         React UI (Vite), talks to host via postMessage
```

### Pure `core/` contract

- **No** imports from `vscode`, `fs`, `child_process`, or React.
- Functions are **deterministic**: no `Date.now()`, randomness, or global mutation.
- Inputs/outputs are strings and in-memory structs (`MergeDocument`, `ChangeBlock`).
- Side effects (git, disk) stay in `services/` and `webviewHost/handlers/`.

Public entry: `src/core/index.ts`.

### Merge engines

| Setting | Engine | Module |
|---------|--------|--------|
| `gitView.mergeEngine: threeWay` (default) | Git stage 3-way diff | `core/threeWay.ts` |
| `gitView.mergeEngine: markers` | Worktree marker parse | `core/markersEngine.ts` |

## Message protocol

All webview surfaces use a **single** RPC envelope (see [docs/reference/protocol.md](docs/reference/protocol.md)).
There is no separate “v2” protocol.

| Layer | Location |
|-------|----------|
| Types | `src/shared/protocol/`, domain payloads in `src/shared/types/` |
| Host router | `src/webviewHost/messageRouter.ts` → `handlers/` |
| Webview client | `webview/src/protocol/client*.ts` (`createProtocolClient`) |

**Webview → host** requests carry `requestId`, `type`, and `payload`. The host replies with
`HostResponse` (`ok: true`) or `HostErrorResponse` (`ok: false`, same `requestId`). Push
updates use `HostEvent` (no `requestId`) — e.g. `conflict.snapshot`, `merge.document`,
`merge.settings`.

On `webview.ready`, the host responds with surface settings and pushes bootstrap events
(`merge.init` + `conflict.snapshot` for the merge panel; `history.init` + `log.snapshot` for
history, etc.).

Settings changes from VS Code post `merge.settings` (merge) or workspace equivalents without
reload.

## Settings

All `gitView.*` keys are defined in `package.json` → `contributes.configuration`.

- Types: `src/types/settings.ts`
- Reader: `src/config/readGitViewSettings.ts`
- Webview apply: `webview/src/store/gitViewStore.ts` → `applySettings()`

## Git service layout

`createGitService()` composes domain modules under `src/services/git/`:

| Module | Responsibility |
|--------|----------------|
| `exec.ts` | `git` subprocess wrapper |
| `repo.ts` | `findRepoRoot`, branch info, branch list |
| `merge.ts` | Stages, checkout ours/theirs, unmerged files |
| `blame.ts` | Porcelain blame + shared cache |
| `log.ts` | File/folder log, changes-from-side, show commit |
| `diff.ts` | History diff / patch at commit |

Production instances share one blame cache; tests pass `blameCache: new Map()` for isolation.

## Test layers

| Layer | Runner | Location |
|-------|--------|----------|
| Unit (core, services, handler) | Vitest | `src/**/__tests__` |
| Webview components | Vitest + jsdom | `webview/**/__tests__` |
| VS Code integration | Mocha + `@vscode/test-electron` | `src/test/` |
| E2E | Playwright | `e2e/` |

```bash
pnpm run test:unit          # Vitest
pnpm run test:int           # VS Code integration (build first)
pnpm run test:e2e           # Playwright (build + test repo setup)
pnpm run bench:lcs          # LCS quick benchmarks (~seconds, CI-safe)
pnpm run bench:lcs:stress   # LCS stress benchmarks (local only, 10k+ lines)
pnpm run check:architecture # Dependency direction, purity, cycles, exceptions
pnpm run check:docs         # Local documentation links
pnpm run quality            # Complete pull-request gate
pnpm run lint               # Oxlint
pnpm run check:bundle       # Webview bundle size budget
```

## Test strategy

| Suite | What it proves | Command |
|-------|----------------|---------|
| Unit (Vitest) | Parsers, algorithms, stores, small UI logic | `pnpm run test:unit` |
| Webview E2E (Playwright) | User interactions with a **mock** VS Code host | `pnpm run test:e2e` |
| Host integration | Real VS Code extension host + real Git repo reads | `pnpm run test:int` |
| Merge resolve host contract | `createMessageRouter` + real Git/file I/O on a temp conflict repo (disk + index assertions) | included in `pnpm run test:unit` (`mergeResolveHost.*.test.ts`) |

Destructive Git behavior (restore from revision, multi-root scoping, path trust boundaries) needs **parser/handler tests** and, where practical, **host integration tests** that assert final repo/file state — not only mocked `executeCommand` call counts.

Normative policy: [docs/maintainers/quality-standard.md](docs/maintainers/quality-standard.md).
The aggregate pull-request gate is `pnpm run quality`; a release candidate uses
`pnpm run quality:release`.

## Performance notes

- Line diff uses LCS (`core/lcs.ts`) with size guards (`MAX_DIFF_LINES`, `MAX_DIFF_CELLS`).
- Batch git operations in merge/conflict handlers use `mapPool()` with concurrency **4** to avoid I/O spikes.
- Run `pnpm run bench:lcs` before changing the diff algorithm (quick suite).
- Run `pnpm run bench:lcs:stress` locally when touching size limits or DP layout.
- Wall-clock perf guards live in `src/core/__tests__/lcs.perf.test.ts` and run with the unit suite; use `pnpm run bench:lcs` for comparative performance review.

## Code style

- Oxlint: `curly: all`, `@stylistic/brace-style: 1tbs` with `allowSingleLine: false`.
- Prefer extending `core/` with pure functions and covering them with Vitest.

## Commit messages (Conventional Commits)

We follow [Conventional Commits](https://www.conventionalcommits.org/) so changelogs can be generated at release time (same idea as Vue / Antfu projects).

```text
<type>(optional-scope): <description>

[optional body]
[optional footer]
```

| Type | Changelog section | Use for |
| --- | --- | --- |
| `feat` | Features | User-visible capability |
| `fix` | Bug Fixes | Bug fix |
| `perf` | Performance | Performance improvement |
| `refactor` | Refactors | Internal change, no behavior change |
| `docs` | Documentation | Docs only |
| `test` | Tests | Tests only |
| `build` | Build | Build / packaging |
| `ci` | CI | CI config |
| `chore` | Chores | Tooling, deps, misc |

Examples:

```text
feat(merge): fold unchanged regions by default
fix(blame): accept log results when branch filter is empty
docs: reorganize docs into Guide / Reference
chore(release): v0.1.1
```

Breaking changes: `feat!: …` or a `BREAKING CHANGE:` footer.

### Changelog & release tooling

| Command | What it does |
| --- | --- |
| `pnpm run changelog:preview` | Print generated notes from commits since last tag (no write) |
| `pnpm run changelog` | Update `CHANGELOG.md` from commits |
| `pnpm release` | Bump version ([bumpp](https://github.com/antfu-collective/bumpp)), regen changelog, commit + tag `v*`, push |

On tag push, GitHub Actions runs [changelogithub](https://github.com/antfu/changelogithub) to open/update the GitHub Release body.

See [RELEASE.md](RELEASE.md) for marketplace publish steps after the tag.

## Pull requests

1. Add or update tests for behavior changes.
2. Keep `core/` free of VS Code / I/O dependencies.
3. If you add a setting, update `package.json`, `src/types/settings.ts`, and webview `applySettings()`.
4. Prefer Conventional Commit titles on PR commits (or squash-merge with a conventional title).
5. Run the aggregate gate before opening a PR:

```bash
pnpm run quality
```

6. For host or webview workflow changes, run the relevant integration/e2e scope (`pnpm run test:int`, `pnpm run test:e2e`).

### Message protocol checklist

Living spec: [docs/reference/protocol.md](docs/reference/protocol.md).

When adding or changing webview ↔ host messages:

1. Add request/response/event types to `src/shared/protocol/webviewToHost*.ts` and
   `src/shared/protocol/hostToWebview.ts`; add error codes to `src/shared/errors/codes.ts`
   if needed.
2. Add a payload validator in `src/shared/protocol/requestValidation.ts`.
3. Route the request in `src/webviewHost/messageRouterRoutes.ts` and implement it in
   `src/webviewHost/handlers/` + the owning `messageRouterDispatch*.ts`.
4. Add client method in the appropriate `webview/src/protocol/client*Slice.ts`.
5. For push events: add the `type` to `HOST_EVENT_TYPES` in `hostToWebview.ts` **and** a
   type-guard + subscription branch in the surface hook (e.g. `useMergeHostSubscription.ts`).
6. Add tests for malformed payloads and path validation where files or Git state can change.

Steps 1–3 and 5 are enforced at compile time: a new request type will not typecheck until
it has both a validator and a route, and a new `HostEvent` will not typecheck until it is
listed in `HOST_EVENT_TYPES`. If `pnpm run typecheck` fails with a missing-property error in
`requestValidation.ts`, `messageRouterRoutes.ts`, or `hostToWebview.ts`, that is this check
firing rather than a bug.

### Git error handling

Git localizes its output, so `src/services/git/exec.ts` pins every subprocess to the C
locale and `src/shared/errors/classifyGitError.ts` is the only module allowed to interpret
Git's human-readable messages. Branch on a `GitViewErrorCode` via `classifyGitError` /
`isGitErrorCode` instead of matching stderr inline — `pnpm run check:architecture` fails the
build on inline matches. In the webview, branch on the structured `code` using
`webview/src/lib/errorCode.ts`, never on the message text.

Verify no legacy `domain:action` colon literals remain (except intentional negative tests):

```bash
grep -rnE '"(merge|conflicts|git|gitHistory|webview|app|vscode):[a-zA-Z]' src webview/src
```
