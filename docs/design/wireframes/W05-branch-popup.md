# W05 — Branch Popup (Webview Popup)

## Screen Info
- **Surface:** Webview popup (positioned near branch selector trigger)
- **Width:** 340px fixed
- **Entry:** Click branch name in toolbar, Ctrl+Shift+B, status bar branch click
- **Purpose:** Fast branch switching, search, create, per-branch actions

## Layout

```
┌─────────────────────────────────────┐
│ ◆ feature/auth          ↓0 ↑3 ▾   │ ← Current branch header
├─────────────────────────────────────┤
│ 🔍 Search branches...               │ ← Auto-focused on open
├─────────────────────────────────────┤
│ RECENT                              │ ← Section header, 10px
│   ⎇ main              2h ago       │ ← Recent branches
│   ⎇ fix/login-bug      5h ago       │
│ ─────────────────────────────────── │
│ LOCAL BRANCHES                      │
│ ✓ ⎇ feature/auth       ↓0 ↑3  ⋮  │ ← ✓ = current, sync status
│   ⎇ main               ↓2 ↑0  ⋮  │   ⋮ = overflow menu
│   ⎇ develop            =      ⋮  │   = = in sync
│   ⎇ release/1.0               ⋮  │
│ ─────────────────────────────────── │
│ REMOTE (origin)                     │
│   ⎇ origin/main                ⋮  │
│   ⎇ origin/feature/auth        ⋮  │
│   ⎇ origin/develop             ⋮  │
├─────────────────────────────────────┤
│ + New Branch from feature/auth…     │ ← Action row
│ ◎ Checkout Tag or Commit…           │
└─────────────────────────────────────┘
```

## Per-Branch Overflow Menu (⋮)

```
Local branches:
┌──────────────────────────┐
│ ← Checkout               │
│ ↔ Compare with Current   │
│ ↗ Push                   │
│ ⇋ Merge into Current     │
│ ↻ Rebase Current onto    │
│ ✎ Rename...              │
│ ✕ Delete                 │
│ ──────────────────────── │
│ Show in Log              │
│ Copy Branch Name         │
└──────────────────────────┘

Remote branches:
┌──────────────────────────┐
│ ← Checkout as New Local  │
│ ↔ Compare with Current   │
│ ↙ Fetch                  │
│ ✕ Delete (remote)        │
└──────────────────────────┘
```

## Hover Quick Actions (per row)

On hover, show inline action icons at row end:
```
  ⎇ main     ↓2 ↑0   [←] [↔] [↗]
```

- ← Checkout
- ↔ Compare with current
- ↗ Push

## Keyboard Navigation

| Key | Action |
|-----|--------|
| ↑/↓ | Navigate branches |
| Enter | Checkout selected branch |
| Type | Filter/search (auto-focus search box) |
| Esc | Close popup |
| Ctrl+Enter | New branch from selected |
| Ctrl+N | Focus "New Branch" action |
| Space | Open overflow menu on selected |

## Search Behavior

- Type to filter: matches branch name (case-insensitive)
- Results grouped: Local matches first, then Remote
- No results: show "No branches match 'query'" + "Create 'query'?" action
- Clear search: show full list

## States

### Empty (no branches except current)
```
┌─────────────────────────────────────┐
│ ◆ main                       ▾     │
├─────────────────────────────────────┤
│ 🔍 Search branches...               │
│                                     │
│  No other branches in repository    │
│                                     │
│ + New Branch from main…             │
└─────────────────────────────────────┘
```

### Loading
```
Branch list area shows 3 skeleton rows (pulsing placeholders)
```

### Error
```
  ⚠ Could not read branches
  [Retry]
```

### Checkout Warning (dirty working tree)
```
┌───────────────────────────────────┐
│ ⚠ Uncommitted changes             │
│                                   │
│ You have 3 modified files.        │
│                                   │
│ ○ Smart Checkout                  │
│   Stash → Checkout → Unstash      │
│                                   │
│ ○ Force Checkout                  │
│   ⚠ Discard all local changes     │
│                                   │
│              [Cancel] [Checkout]  │
└───────────────────────────────────┘
```

### Protected Branch (delete attempt)
```
  ✕ Cannot delete 'main': protected branch
  [OK]
```

### Delete with Unmerged Commits
```
┌───────────────────────────────────┐
│ ⚠ Branch 'feature/auth' has       │
│   unmerged commits                │
│                                   │
│ 3 commits not merged to any other │
│ branch:                           │
│ ┌───────────────────────────────┐ │
│ │ a1b2c3d feat: add auth        │ │
│ │ e4f5g6h fix: redirect         │ │
│ │ i7j8k9l chore: deps           │ │
│ └───────────────────────────────┘ │
│                                   │
│           [Cancel] [Force Delete] │
└───────────────────────────────────┘
```

## Component Tree

```
BranchPopup
├── BranchPopupHeader
│   ├── CurrentBranchIcon (green if clean, yellow if dirty)
│   ├── CurrentBranchName
│   ├── SyncIndicator (↓↑ counts)
│   └── CloseButton
├── BranchSearchInput (auto-focused)
├── BranchSection (Recent)
│   └── BranchRow[]
├── Divider
├── BranchSection (Local)
│   └── BranchRow[]
│       ├── CurrentIndicator (✓ or space)
│       ├── BranchIcon (colored)
│       ├── BranchName
│       ├── SyncStatus (↓↑ or =)
│       └── HoverActions / OverflowMenu
├── Divider
├── BranchSection (Remote, grouped by remote name)
│   └── BranchRow[]
├── Divider
├── ActionRow (New Branch)
└── ActionRow (Checkout Tag/Commit)
```

## Theme Tokens

| Element | Token |
|---------|-------|
| Popup bg | `--vscode-editor-background` |
| Header bg | `--vscode-sideBar-background` |
| Search bg | `--vscode-input-background` |
| Row hover | `--vscode-list-hoverBackground` |
| Selected row | `--vscode-list-activeSelectionBackground` |
| Current indicator | `--vscode-gitDecoration-addedResourceForeground` |
| Sync text | `--vscode-editor-foreground` (opacity 0.5) |
| Section header | `--vscode-editor-foreground` (opacity 0.4) |

## Acceptance Criteria

- [ ] Opens on branch click, Ctrl+Shift+B, and status bar click
- [ ] Search auto-focused, filters in real-time
- [ ] All states: empty, loading, error, populated, search-no-results
- [ ] Keyboard: full navigation without mouse
- [ ] Smart checkout flow when dirty
- [ ] Protected branch delete blocked
- [ ] Unmerged branch delete warns with commit list
- [ ] Overflow menu on each branch with correct actions
- [ ] Hover quick actions for checkout/compare/push
- [ ] Works with light, dark, and high contrast themes
- [ ] Screen reader: announces branch count, sync status
- [ ] Unit tests: all states, search filter, keyboard nav
- [ ] E2E: checkout flow, dirty work guard, delete flow
