# W11 — Pull / Update Dialog (Webview Dialog)

## Screen Info
- **Surface:** Webview dialog (modal)
- **Width:** 420px
- **Entry:** Pull button, Ctrl+T, Command Palette → "Pull…"
- **Purpose:** Configure pull strategy and preview incoming changes

## Layout

```
┌──────────────────────────────────────┐
│ Update Project                  ✕    │
├──────────────────────────────────────┤
│                                      │
│ Update strategy:                     │
│                                      │
│ ● Merge                             │
│   git pull (creates merge commit)    │
│                                      │
│ ○ Rebase                            │
│   git pull --rebase                  │
│   (reapply your commits on top)      │
│                                      │
│ ○ Fast-forward only                 │
│   git pull --ff-only                 │
│   (fails if cannot fast-forward)     │
│                                      │
│ ──────────────────────────────────── │
│                                      │
│ Remote: [origin            ▾]        │
│ Branch: [main              ▾]        │
│                                      │
│ ☐ Stash local changes before update │
│   (Stash → Pull → Unstash)           │
│                                      │
│ ──────────────────────────────────── │
│                                      │
│ Incoming commits (5):                │
│ ┌──────────────────────────────────┐ │
│ │ z9y8x7w feat: new dashboard     │ │
│ │         Sarah · 1h ago          │ │
│ │ ────────────────────────────    │ │
│ │ y8x7w6v fix: critical bug       │ │
│ │         Mike · 2h ago           │ │
│ │ ────────────────────────────    │ │
│ │ ... 3 more commits              │ │
│ └──────────────────────────────────┘ │
│                                      │
├──────────────────────────────────────┤
│                [Cancel]  [Update →]  │
└──────────────────────────────────────┘
```

## Strategy Explanations

### Merge (default)
```
● Merge
  git pull (default)

  Creates a merge commit if branches have diverged.
  Preserves exact history but may create extra merge commits.

  Best for: shared branches, when you want explicit merge tracking.
```

### Rebase
```
○ Rebase
  git pull --rebase

  Reapplies your local commits on top of the remote commits.
  Creates a linear history without merge commits.

  Best for: feature branches, keeping clean history.
  ⚠ Rewrites local commit hashes.
```

### Fast-forward only
```
○ Fast-forward only
  git pull --ff-only

  Only updates if your branch can be fast-forwarded.
  Fails if you have local commits that diverge.

  Best for: tracking branches where you never commit locally.
```

## States

### Updating (loading)
```
Update button shows spinner:
  [◌ Updating...]
Cancel button: [Cancel Update]

Progress below:
  Fetching origin... ✓
  Merging main... ◌
```

### Success
```
Toast:
  ✓ Updated main
  Fast-forwarded 5 commits.
  a1b2c3d..z9y8x7w
```

### Conflict After Pull
```
Automatically transitions to Conflict List screen.

Toast:
  ⚠ 3 files with conflicts
  [Resolve]
```

### Fast-forward Fails (with --ff-only)
```
┌───────────────────────────────────┐
│ ⚠ Cannot fast-forward        ✕   │
├───────────────────────────────────┤
│                                   │
│ Your branch has diverged from     │
│ origin/main.                      │
│                                   │
│ Local commits: 3                  │
│ Remote commits: 5                 │
│                                   │
│ Options:                          │
│ [Merge instead]  [Rebase instead] │
│                                   │
├───────────────────────────────────┤
│                         [Cancel]  │
└───────────────────────────────────┘
```

### Dirty Working Tree (stash not checked)
```
┌───────────────────────────────────┐
│ ⚠ Uncommitted changes        ✕   │
├───────────────────────────────────┤
│                                   │
│ You have uncommitted changes.     │
│ Pull may fail or cause conflicts. │
│                                   │
│ Options:                          │
│ [Stash & Update]                  │
│ [Update Anyway]                   │
│ [Cancel]                          │
└───────────────────────────────────┘
```

### No Remote
```
  No remote configured.
  Nothing to pull from.
  [Add Remote...]
```

### Auth Error
```
  ✕ Authentication failed
  Could not fetch from origin.
  [Configure Credentials] [Retry]
```

### Network Error
```
  ✕ Network error
  Could not connect to origin.
  Check your connection and try again.
  [Retry] [Cancel]
```

### Already Up to Date
```
Toast:
  ✓ Already up to date
  main is in sync with origin/main.
```

### Multi-Repo
```
Additional info when multi-root workspace:

  Repository: project-a (1 of 2)
  [Update All Repositories]
```

## Component Tree

```
PullDialog
├── DialogTitle ("Update Project")
├── DialogBody
│   ├── StrategySelector
│   │   ├── StrategyOption (Merge) — default, selected
│   │   ├── StrategyOption (Rebase)
│   │   └── StrategyOption (Fast-forward only)
│   ├── Divider
│   ├── RemoteSelector (dropdown)
│   ├── BranchSelector (dropdown)
│   ├── Checkbox ("Stash local changes before update")
│   ├── Divider
│   └── IncomingCommitsPreview
│       ├── CommitCount ("5 incoming commits")
│       └── CommitList (scrollable, max 6 visible)
│           └── CommitRow[]
├── DialogFooter
│   ├── CancelButton
│   └── UpdateButton (primary)
│
├── DirtyWorkWarning (conditional)
├── FastForwardFailDialog (conditional)
├── AuthErrorDialog (conditional)
└── NetworkErrorDialog (conditional)
```

## Keyboard

| Key | Action |
|-----|--------|
| Enter | Update (when enabled) |
| Esc | Cancel |
| ↑/↓ | Switch strategy |
| M | Select Merge |
| R | Select Rebase |
| F | Select Fast-forward only |

## Theme Tokens

| Element | Token |
|---------|-------|
| Dialog bg | `--vscode-editor-background` |
| Strategy option (selected) | `--vscode-list-activeSelectionBackground` |
| Commit list bg | `--vscode-sideBar-background` |
| Hash color | Blue link color |

## Acceptance Criteria

- [ ] Three strategy options with clear explanations
- [ ] Incoming commit preview (fetches on open)
- [ ] Stash-before-update option
- [ ] Dirty work warning (with stash option)
- [ ] Fast-forward failure recovery
- [ ] Conflict → automatic transition to conflict list
- [ ] Progress state with cancel
- [ ] Success/error/auth/network states
- [ ] No-remote state
- [ ] Already-up-to-date state
- [ ] Multi-repo support
- [ ] All themes
- [ ] Keyboard navigation
