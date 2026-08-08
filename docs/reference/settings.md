# Settings reference

All settings use the legacy-compatible `gitView` configuration section. Open **Settings** and search **GitView**, or edit `settings.json`.

Defaults match `package.json` → `contributes.configuration`.

## Merge resolver

| Setting | Type | Default | Description |
| --- | --- | --- | --- |
| `gitView.mergeEngine` | `string` | `"threeWay"` | `threeWay` (Git stages) or `markers` (worktree markers only) |
| `gitView.conflictPlaceholder` | `string` | `"base"` | Initial unresolved block content |
| `gitView.acceptBothOrder` | `string` | `"oursFirst"` | Order when accepting both sides |
| `gitView.autoStageOnResolved` | `boolean` | `true` | `git add` after marking resolved |
| `gitView.showBasePanel` | `boolean` | `false` | Optional base pane |
| `gitView.confirmBeforeMarkResolved` | `boolean` | `false` | Extra confirm before Apply |
| `gitView.enableScrollSync` | `boolean` | `true` | Sync scroll across panes |
| `gitView.showWordLevelDiff` | `boolean` | `true` | Word-level highlights in blocks |
| `gitView.autoResolveBothSame` | `boolean` | `true` | Auto-resolve identical ours/theirs |
| `gitView.whitespacePolicy` | `string` | `"doNotIgnore"` | Whitespace handling when diffing |
| `gitView.highlightingMode` | `string` | `"lines"` | `lines` · `words` · `none` |
| `gitView.warnOnCrlf` | `boolean` | `true` | Mixed LF/CRLF banner |
| `gitView.goToNextFileAfterLastChange` | `boolean` | `true` | F7 wraps to next conflict file |
| `gitView.foldUnchangedRegions` | `boolean` | `false` | Collapse long unchanged runs |
| `gitView.foldThreshold` | `number` | `5` | Min lines before fold |

## Git executable, line endings & diagnostics

| Setting | Type | Default | Description |
| --- | --- | --- | --- |
| `gitView.gitExecutablePath` | `string \| null` | `null` | Custom Git path; `null` = PATH |
| `gitView.crlfWarnings` | `boolean` | `true` | Warn when endings disagree with gitattributes |
| `gitView.logLevel` | `off \| error \| warn \| info \| debug` | `info` | Minimum severity written to the GitView output channel |

## Safety & workflow

| Setting | Type | Default | Description |
| --- | --- | --- | --- |
| `gitView.protectedBranchPatterns` | `string[]` | `main`, `master`, `release/*`, `hotfix/*`, `production` | Block destructive history / force-push style ops |
| `gitView.mode` | `string` | `"staging"` | Default changes grouping: `staging` · `changelist` |
| `gitView.confirmDestructiveActions` | `boolean` | `true` | Confirm discard / history rewrite |
| `gitView.gpgSigningDefault` | `boolean` | `false` | Default GPG sign commits |
| `gitView.updateStrategy` | `string` | `"merge"` | Pull strategy: `merge` · `rebase` · `ff_only` |
| `gitView.synchronousBranchControl` | `boolean` | `true` | Multi-root branch checkout sync |

## Git workspace presentation

| Setting | Type | Default | Description |
| --- | --- | --- | --- |
| `gitView.gitDiffViewMode` | `string` | `"side_by_side"` | Working-tree diff layout: `side_by_side` · `unified` |
| `gitView.graphSort` | `string` | `"date"` | Commit graph ordering: `date` · `topological` |
| `gitView.highlightCurrentBranch` | `boolean` | `true` | Highlight current-branch commits |
| `gitView.compactLogRows` | `boolean` | `false` | Use compact commit-log rows |
| `gitView.issueTrackerBaseUrl` | `string \| null` | `null` | Link issue references in commit messages |

## Hosted review

| Setting | Type | Default | Description |
| --- | --- | --- | --- |
| `gitView.githubReviewToken` | `string` | `""` | **Deprecated** plaintext fallback; prefer Set GitHub Review Token… |
| `gitView.githubApiBaseUrl` | `string` | `https://api.github.com` | GitHub REST base (Enterprise: `/api/v3`) |
| `gitView.gitlabReviewToken` | `string` | `""` | **Deprecated** plaintext fallback; prefer Set GitLab Review Token… |
| `gitView.gitlabApiBaseUrl` | `string` | `https://gitlab.com/api/v4` | GitLab REST base |

## Commit checks

| Setting | Type | Default | Description |
| --- | --- | --- | --- |
| `gitView.commitCheckTodo` | `boolean` | `false` | Warn on TODO/FIXME in changed files |
| `gitView.commitCheckAnalyze` | `boolean` | `false` | Block commit on error diagnostics |
| `gitView.commitCheckReformat` | `boolean` | `false` | Reformat before commit |
| `gitView.commitCheckOptimizeImports` | `boolean` | `false` | Optimize imports before commit |

---

[Docs index](../README.md) · [Commands →](./commands.md)
