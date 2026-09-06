# AGENTS.md

Operating notes for AI coding agents working in this repository.
Human-oriented docs live in [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/](docs/README.md) — read those for architecture rationale. This file covers what an agent needs to not break things.

## What this is

GitView is a VS Code extension: 3-way merge resolver plus a full Git tooling surface (Explorer/editor/SCM context menus, and a React webview panel called **GitView**).

Two runtimes, one repository:

- `src/` — extension host (Node). Entry `src/extension.ts`.
- `webview/src/` — React UI (Vite, Monaco, zustand, Tailwind). Talks to the host only via `postMessage`.

Package manager is **pnpm** (`pnpm@9.12.0`). Always `pnpm`, never `npm`/`yarn`.

The product is spelled **GitView** everywhere: package name, view titles, and user-facing copy. There are no "Nexus" products — if you find that word in a comment or a UI string, it is stale and should be renamed.

## Verification gates

Run these before claiming a change is done:

```bash
pnpm run typecheck          # host + webview
pnpm run lint               # oxlint
pnpm run check:architecture # layering, purity, cycles
pnpm run test:unit          # vitest, ~2.5k tests across host + webview
```

These four are a fast inner loop, **not** the gate. `test:unit` does not check coverage thresholds and does not build; `pnpm run quality` does both. Run it before a PR:

```bash
pnpm run quality
```

`quality` is 9 steps: `check:architecture → check:docs → check:deadcode → typecheck → lint → test:coverage → build → check:bundle → check:package`. Release candidate is `pnpm run quality:release` (adds `security:audit`, `test:int`, `test:e2e`, `vsce package`).

CI inlines these steps rather than calling `quality`, and it runs `security:audit` first — so a green local `quality` can still fail CI on an audit.

For anything user-visible, also build and drive the real UI:

```bash
pnpm run package                                  # builds webview + extension, produces the .vsix
pnpm run test:setup                               # seeds test-conflict-repo / test-clean-repo
pnpm exec playwright test e2e/native-<spec>.spec.ts
```

**A passing unit test does not prove a feature surfaces.** UI work is verified in real VS Code (Playwright + a screenshot), not by vitest alone.

### Review scope

Before asking for review (human or agent), run:

```bash
pnpm run review:scope
```

It maps the diff to the zones it touches and prints the gates and checklists
owed, the size verdict against the 200/600-line budget, and mechanically
detectable risks (silent `catch`, suppressions, determinism in `core/`, ratchet
edits, a standalone app with no host-message listener). `--strict` exits non-zero
on a red flag.

Agents: **an agent must not review its own diff as the only reviewer.** An AI
reviewer on its own output checks consistency with its own assumptions, which is
the one thing that does not need checking. See
[the code review standard](docs/maintainers/code-review.md#13-ai-authored-diffs).

## Layering (enforced by `scripts/check-architecture.mjs`)

| Layer | Rule |
|---|---|
| `src/core/**` | Pure. May import only `src/core` and type-only `src/types`. No `vscode`, `fs`, `child_process`, `Date.now()`, randomness. |
| `src/shared/**`, `src/types/**` | May depend only on core/shared/types. |
| `src/config`, `src/services`, `src/storage`, `src/util`, `src/observability` | May **not** import `src/application`, `src/commands`, `src/webview`, `src/webviewHost`. |
| `webview/src/**` | May **not** import `vscode` or Node builtins, and may share only `src/core`, `src/shared`, `src/types` with the host (aliases: `@gitview/shared` → `src/shared`, `@gitview/types` → `src/types/index.ts`, configured in `webview/vite.config.ts`). |
| Git subprocesses | Only `src/services/git/exec.ts` may import `child_process`. |
| Production code | May never import from `__tests__/`, `test/`, or `*.test.*`. |

Practical consequence: **`src/commands/*` cannot import the webview panel.** Commands that need to open a panel dialog take an optional `presentation?: GitMenuPresentation` parameter and call `presentation.openPanelDialog({ dialog })`.

## Recipe: make a native menu command open a panel dialog

This is the most common task in this repo. All six steps are required or the dialog silently never appears.

1. Add the dialog id to `GIT_PANEL_DIALOGS` in `src/shared/protocol/hostToWebview.ts`.
2. In the command (`src/commands/gitMenu*.ts`): resolve the repo root **first**, then early-return through `presentation?.openPanelDialog({ dialog: "..." })` before any `showInputBox`/`showQuickPick` fallback.
3. Pass `gitView.gitMenuPresentation` as the trailing argument at the registration site in `src/extension.ts` (the container is named `gitView`, not `nexusGit` — there is no `nexusGit` identifier anywhere in `src/`).
4. Pass `presentation` through the matching `case` in `src/commands/gitMenuActionDispatcher.ts` (the webview panel's own right-click routes through here).
5. Webview store: add `<name>DialogOpen` + setter across the three files in `webview/src/stores/` — `gitWorkspaceStoreTypes.ts` (state field + action signature), `gitWorkspaceStoreSlice.ts` (implementation), `gitWorkspaceStore.ts` (assembly). Components read them through `useGitWorkspaceStoreSlice()` in `webview/src/hooks/gitWorkspace/`.
6. Map the host event in `useGitWorkspaceHostSubscription.ts`, then render the component from `GitWorkspaceDialogs.tsx`.

`webview/src/apps/__tests__/GitWorkspaceApp.openDialog.test.tsx` asserts that every id in `GIT_PANEL_DIALOGS` maps to a rendered `data-testid`, so step 1 without steps 5–6 fails the suite. Keep it that way.

A dialog requested before the webview booted is queued as `pendingDialog` in `src/webview/gitWorkspacePanel.ts` and flushed on the `webview.ready` handshake.

If a dialog needs server data (stash list, branch list), fetch it from the dialog container itself. Tab-level effects only run on their own tab, so a dialog opened from a native menu on another tab renders empty otherwise.

## Known architectural debt

These are measured facts, not suspicions. Do not extend them; fix them or work around them.

**The outward layer is a graph, not a stack.** `application`, `commands`, `webview`, and `webviewHost` import each other in both directions. Measured edges: `application`→`commands` (`gitMenuDiffActions.ts:9`, `gitMenuActionDispatcher.ts:2`), `commands`→`application` (making that pair a **file-level** cycle, not only a directory-level one), `webview`→`commands` (4 files: `GitViewPanel.ts:9`, `gitWorkspacePanel.ts:16`, `gitViewPanelRouter.ts:4`, `gitMenuPresentationAdapter.ts:3`), `webviewHost`→`application` (16 files, all to `mutationPreconditions`), and `application`→`webviewHost` (`gitViewContext.ts:13`). Two edges are forbidden by the gate (`commands`→`webview`, `webviewHost`→`webview`); the rest are debt.

**`src/application` is not a use-case layer.** It is `gitViewContext.ts` (a type-only DI container interface) plus `mutationPreconditions.ts` (seven near-identical confirmation builders at `:108`, `:161`, `:210`, `:268`, `:323`, `:381`, `:435`, plus `destructiveActionLabel:487`). Real orchestration lives in `src/webviewHost/handlers/` — 37 files / ~7.2k LOC, roughly 13× the size of `application`. `gitViewContext.ts` imports types from every layer, which is the one intentional outward inversion.

**`src/util` is not a leaf.** `util/gitDiffPreview.ts` spawns Git by default (`execGit: GitExecFn = defaultExecGit`) and `util/vscodeGit.ts` imports `vscode`. New leaf helpers belong in `src/shared/lib/`.

**Webview tabs must keep their props referentially stable.** `useGitWorkspaceController()` returns a fresh `ctx` object on every render and passes it into every tab, so `React.memo` on a panel only works while the tab hands it stable callbacks and arrays. Two rules: wrap every handler passed down in `useCallback`, and never call a store getter in JSX (`files={visibleFiles()}`) — hoist it into `useMemo`.

The getter rule only bites where the consumer is actually memoized. Today that is seven components: `WorkspaceChangesPanel`, `WorkspaceLogPanel`, `GitCommitRow`, `GitChangedFilesTree`, `FileRow`, `Section`, `EditorPaneBlock`. A getter returning a primitive (`selectedFileConflicted()` → `boolean`) cannot defeat a `memo` under any circumstances. Sites that feed a plain non-memo component are **latent** debt, not active re-renders — they break the day someone wraps that component in `memo`, so do not add new ones, but do not refactor them blind either: check the consumer first.

`webview/src/apps/gitWorkspace/__tests__/*.callbackStability.test.tsx` fails when a prop identity regresses; `webview/src/components/git/__tests__/WorkspaceLogPanel.renderCount.test.tsx` fails when the rows start re-rendering again.

**Monaco core is ~3.9 MB and that is the floor.** The editor and the diff-editor feature cannot be tree-shaked much further; the 24 language grammars are only ~106 kB of it. `manualChunks` puts the core in `monacoSetup` and each grammar in its own `monaco-lang-<id>` chunk, which Monaco fetches on demand when a model needs that language. Do not add a grammar that drags in a language service — `scripts/check-bundle-budget.mjs` caps a single grammar chunk at 50 kB for exactly that reason.

## Testing conventions and traps

- **No `@testing-library/jest-dom`.** Use `expect(el).toHaveProperty("disabled", true)`, not `toBeDisabled()`.
- Webview component tests need `// @vitest-environment jsdom` as the first line.
- `webview/src/__tests__/copyOwnership.test.ts` fails the build if a vendor trademark string (the three competitor IDE names) appears anywhere under `webview/src/components/git/` outside `__tests__`. Write comments and UI copy in our own words.
- Playwright default mode drives **real Electron VS Code**, and `playwright.config.ts` sets `testMatch: /native-.*\.spec\.ts/`. A spec not named `native-*.spec.ts` is silently skipped. `E2E_MOCK=1` flips to the Vite mock preview.
- E2E helpers live in `e2e/helpers/native-vscode.ts`: `launchNativeVsCode`, `clickNativeGitMenu`, `waitForNativeGitMenuItemEnabled`, `waitForWebviewFrame(app, testId)`, `acceptQuickPick`, `prepareCleanGitRepo`.
- `locator.screenshot()` and `boundingBox()` do not work against a webview `FrameLocator`. Use full-page `page.screenshot()`.
- Destructive Git behavior needs handler/integration tests asserting real repo state — not just mocked `executeCommand` call counts.

## House style

- Product north star is field-by-field parity with the leading JetBrains Git dialogs, on **both** the native menus and the webview panel. A stub that runs a Git command silently is not parity.
- Oxlint: `curly: all`, 1TBS braces, no single-line blocks.
- Default to no comments. Add one only when the *why* is non-obvious.
- Conventional Commits.
- Prefer extending `src/core/` with pure functions covered by vitest.

## Design and UI changes

**There is no approved design for this product.** Visual regression baselines record what the UI
currently renders; they are not an approved design, and a passing snapshot is not sign-off.

Therefore:

- **Do not change layout, spacing, colour, typography, iconography, or user-facing copy on your own
  initiative.** If a logic or security fix appears to require one, stop and ask — usually there is a
  non-visual fix, or a precondition that avoids the situation entirely.
- **Every design change ships as a prototype first.** Build a mockup showing the options with their
  trade-offs, get one chosen, and only then implement it. Do not implement your own preference and
  present it as a fait accompli.
- **Never change a baseline to make a test pass.** A baseline that no longer matches the UI is a
  finding to report, not a value to update.
- Reason about the size you actually have. A webview in the bottom panel is ~258px tall, so `vh`
  units measure the panel, not the VS Code window; `80vh` there is ~206px<arg_key:6124c78e>replace_all</arg_key:6124c78e><arg_value:6124c78e>false

## Repository quirks

- The working copy **is** a git checkout — `git log`, `git blame`, `git tag` and `git merge-base` all work and are the right way to answer "when did this change".
- `test-conflict-repo/` and `test-clean-repo/` are generated fixtures (`pnpm run test:setup`). Never hand-edit them.
- `e2e-results/` and `e2e-report/` are build output. Delete any temporary `native-*.spec.ts` harness you create for screenshots.
