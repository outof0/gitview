# Release Checklist

Use this checklist before publishing a VSIX to Marketplace or Open VSX.

Changelog entries are **generated from Conventional Commits** at release time (Antfu / Vue style):

| Step | Tool |
| --- | --- |
| Bump version + commit + tag | [`bumpp`](https://github.com/antfu-collective/bumpp) via `pnpm release` |
| Update `CHANGELOG.md` | [`changelogen`](https://github.com/unjs/changelogen) |
| GitHub Release + VSIX | GitHub CLI on `v*` tag push after reusable CI passes |

Commit message format: see [CONTRIBUTING.md](CONTRIBUTING.md#commit-messages-conventional-commits).

## 0. Cut the version (recommended)

After quality gates pass and the tree is clean:

```bash
# Preview notes that would be written
pnpm run changelog:preview

# Interactive bump → changelog → commit "chore(release): vX.Y.Z" → tag vX.Y.Z → push
pnpm release
```

Pushing the tag triggers `.github/workflows/release.yml`, reruns CI, packages the
VSIX, verifies the tag matches `package.json`, and creates a GitHub Release with
generated notes and the VSIX attached.

Then continue with packaging and marketplace publish below.

## 1. Repository Hygiene

- [ ] No generated artifacts are committed: `out/`, `webview/dist/`, `coverage/`, `e2e-results/`, `e2e-report/`, `test-results/`, `.vscode-test/`, `.pnpm-store/`, `*.vsix`.
- [ ] No local screenshots, design archives, temporary archives, `.DS_Store`, or one-off verification scripts remain in the repo root.
- [ ] Specs and docs are current: `README.md`, `CHANGELOG.md`, `RELEASE.md`, and living docs under `docs/` (see `docs/README.md`).
- [ ] No finished migration plans or one-off audit handoffs in `docs/` (keep only living specs).
- [ ] No third-party vendor names, IDE metadata, or proprietary-asset references are present in source, tests, specs, built output, or the VSIX.

Suggested scan:

```bash
pnpm --filter gitview-webview exec vitest run src/__tests__/copyOwnership.test.ts
```

## 2. Required Quality Gates

```bash
corepack enable
corepack prepare pnpm@9.12.0 --activate
pnpm install --frozen-lockfile
pnpm run quality:release
```

This includes architecture invariants, types, lint, coverage, build, bundle and
package contracts, extension-host integration, E2E, and final VSIX creation.
The release is blocked if any required gate fails. The normative acceptance
policy is [docs/maintainers/quality-standard.md](docs/maintainers/quality-standard.md).

Marketing site lives in a separate repo (`gitview-landing`) and is not part of the VSIX release.

## 3. Required Workflow Gates

Run these before a public release, even when the change looks docs-only:

```bash
pnpm run test:int
pnpm run test:e2e
```

Minimum manual smoke after installing the packaged VSIX:

- [ ] Open Conflict Resolver in a trusted workspace.
- [ ] Resolve and apply one conflicted file.
- [ ] Open Git History from Explorer context menu.
- [ ] Open Git Blame and Git Diff screens.
- [ ] Confirm Settings changes propagate to webviews.
- [ ] Confirm merge/rebase/cherry-pick recovery actions render when applicable.

## 4. VSIX Audit

After packaging:

```bash
pnpm exec vsce ls --tree
tmpdir=$(mktemp -d)
unzip -q gitview-$(node -p "require('./package.json').version").vsix -d "$tmpdir"
pnpm --filter gitview-webview exec vitest run src/__tests__/copyOwnership.test.ts
rm -rf "$tmpdir"
```

Expected package shape:

- [ ] Includes only `README.md`, `CHANGELOG.md`, `SECURITY.md`, `LICENSE`, `package.json`, `icon.png`, `out/`, and `webview/dist/`.
- [ ] Does not include `docs/`, `src/`, `webview/src/`, `e2e/`, `coverage/`, `.github/`, local reports, screenshots, or internal plans.
- [ ] Bundle budget passes. Current webview Monaco chunk is large but budgeted; treat new growth as a release-review item.

## 5. Publish

### Visual Studio Marketplace

```bash
pnpm exec vsce login <publisher-id>
pnpm exec vsce publish
```

### Open VSX

```bash
pnpm exec ovsx publish gitview-$(node -p "require('./package.json').version").vsix -p <OVSX_TOKEN>
```

## 6. Finalization

- [ ] Version was cut with `pnpm release` (or equivalent): `package.json` version, `CHANGELOG.md`, git tag `vX.Y.Z`.
- [ ] GitHub Release body looks correct and the matching VSIX artifact is attached.
- [ ] Marketplace/Open VSX descriptions and screenshots match current product behavior.
- [ ] VSIX for this version is published to Marketplace and/or Open VSX.
