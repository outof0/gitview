# AGENTS.md

Operating notes for AI coding agents working in this repository.
Human-oriented docs live in [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/](docs/README.md) — read those for architecture rationale. This file covers what an agent needs to not break things.

## What this is

Nexus Diff is a VS Code extension: 3-way merge resolver plus a full Git tooling surface (Explorer/editor/SCM context menus, and a React webview panel called **Nexus Git**).

Two runtimes, one repository:

- `src/` — extension host (Node). Entry `src/extension.ts`.
- `webview/src/` — React UI (Vite, Monaco, zustand, Tailwind). Talks to the host only via `postMessage`.

Package manager is **pnpm** (`pnpm@9.12.0`). Always `pnpm`, never `npm`/`yarn`.

## Verification gates

Run these before claiming a change is done:

```bash
pnpm run typecheck          # host + webview
pnpm run lint               # oxlint
pnpm run check:architecture # layering, purity, cycles
pnpm run test:unit          # vitest, ~1100 tests
```

Aggregate PR gate is `pnpm run quality`. Release candidate is `pnpm run quality:release`.

For anything user-visible, also build and drive the real UI:

```bash
pnpm run package                                  # builds webview + extension, produces the .vsix
pnpm run test:setup                               # seeds test-conflict-repo / test-clean-repo
pnpm exec playwright test e2e/native-<spec>.spec.ts
```

**A passing unit test does not prove a feature surfaces.** UI work is verified in real VS Code (Playwright + a screenshot), not by vitest alone.

## Layering (enforced by `scripts/check-architecture.mjs`)

| Layer | Rule |
|---|---|
| `src/core/**` | Pure. May import only `src/core` and type-only `src/types`. No `vscode`, `fs`, `child_process`, `Date.now()`, randomness. |
| `src/shared/**`, `src/types/**` | May depend only on core/shared/types. |
| `src/config`, `src/services`, `src/storage`, `src/util`, `src/observability` | May **not** import `src/application`, `src/commands`, `src/webview`, `src/webviewHost`. |
| `webview/src/**` | May **not** import `vscode` or Node builtins, and may share only `src/core`, `src/shared`, `src/types` with the host (via the `@nexus/shared/*` alias → `src/shared/*`). |
| Git subprocesses | Only `src/services/git/exec.ts` may import `child_process`. |
| Production code | May never import from `__tests__/`, `test/`, or `*.test.*`. |

Practical consequence: **`src/commands/*` cannot import the webview panel.** Commands that need to open a panel dialog take an optional `presentation?: GitMenuPresentation` parameter and call `presentation.openPanelDialog({ dialog })`.

## Recipe: make a native menu command open a panel dialog

This is the most common task in this repo. All six steps are required or the dialog silently never appears.

1. Add the dialog id to `GIT_PANEL_DIALOGS` in `src/shared/protocol/hostToWebview.ts`.
2. In the command (`src/commands/gitMenu*.ts`): resolve the repo root **first**, then early-return through `presentation?.openPanelDialog({ dialog: "..." })` before any `showInputBox`/`showQuickPick` fallback.
3. Pass `nexusGit.gitMenuPresentation` as the trailing argument at the registration site in `src/extension.ts`.
4. Pass `presentation` through the matching `case` in `src/commands/gitMenuActionDispatcher.ts` (the webview panel's own right-click routes through here).
5. Webview store: add `<name>DialogOpen` + setter across `gitWorkspaceStoreTypes.ts`, `gitWorkspaceStoreSlice.ts`, `gitWorkspaceStore.ts`, and expose them in `useGitWorkspaceStoreState.ts` / `useGitWorkspaceStoreActions.ts`.
6. Map the host event in `useGitWorkspaceHostSubscription.ts`, then render the component from `GitWorkspaceDialogs.tsx`.

`webview/src/apps/__tests__/GitWorkspaceApp.openDialog.test.tsx` asserts that every id in `GIT_PANEL_DIALOGS` maps to a rendered `data-testid`, so step 1 without steps 5–6 fails the suite. Keep it that way.

A dialog requested before the webview booted is queued as `pendingDialog` in `src/webview/gitWorkspacePanel.ts` and flushed on the `webview.ready` handshake.

If a dialog needs server data (stash list, branch list), fetch it from the dialog container itself. Tab-level effects only run on their own tab, so a dialog opened from a native menu on another tab renders empty otherwise.

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

## Repository quirks

- The working copy is **not** a git checkout — do not assume `git log`/`git blame` are available for context.
- `test-conflict-repo/` and `test-clean-repo/` are generated fixtures (`pnpm run test:setup`). Never hand-edit them.
- `e2e-results/` and `e2e-report/` are build output. Delete any temporary `native-*.spec.ts` harness you create for screenshots.
