# W09 — Interactive Rebase Editor (Editor Webview)

## Screen Info
- **Surface:** Editor tab webview
- **Width:** Full editor width (responsive)
- **Entry:** Right-click commit in Log → "Start Interactive Rebase from Here…", Command Palette
- **Purpose:** Visual rebase todo list editor with history preview

## Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ Interactive Rebase: feature/auth onto main                  ✕    │
├──────────────────────────────────────────────────────────────────┤
│ [Start Rebase]  [Abort]  [Reset Todo]        5 commits selected │
├────────────────────────────────┬─────────────────────────────────┤
│ TODO LIST              Order  │ PREVIEW (resulting history)     │
│                                │                                 │
│ pick  a1b2c3d feat: auth  ≡↑↓│ main ─── a1b2c3d feat: auth     │
│ ▾                              │          (pick)                  │
│                                │         └ e4f5g6h fix: redirect │
│ squash e4f5g6h fix: redir ≡↑↓│            (squashed into above) │
│ ▾                              │                                 │
│                                │         └ i7j8k9l chore: deps   │
│ reword i7j8k9l chore: dep ≡↑↓│            (reworded)            │
│ ▾                              │                                 │
│                                │         └ j8k9l0m WIP cleanup   │
│ fixup  j8k9l0m WIP clean   ≡↑↓│            (fixup → above)      │
│ ▾                              │                                 │
│                                │         └ k9l0m1n debug log     │
│ drop   k9l0m1n debug log   ≡↑↓│            (dropped)            │
│ ▾                              │                                 │
│                                │ Result: 3 commits               │
│                                │ (from 5 input commits)          │
├────────────────────────────────┴─────────────────────────────────┤
│ Selected commit details:                                          │
│ a1b2c3d feat: add auth flow                                      │
│ Author: Erik · 2026-08-08 14:30                                  │
│ Changed: src/auth/login.ts, src/auth/types.ts                    │
└──────────────────────────────────────────────────────────────────┘
```

## Action Types (per commit dropdown ▾)

```
┌──────────────┐
│ ● pick       │ ← Use commit as-is (default)
│ ○ reword     │ ← Use commit, edit message
│ ○ edit       │ ← Use commit, stop for amending
│ ○ squash     │ ← Combine with previous, keep messages
│ ○ fixup      │ ← Combine with previous, discard message
│ ○ drop       │ ← Remove commit entirely
└──────────────┘
```

## Drag & Drop Reordering

- Each row has drag handle (≡)
- Drag to reorder commits
- Preview updates in real-time
- Visual feedback: drop zone indicator
- Constraints: parent-child relationships maintained

## Preview Panel

Right side shows resulting history as a vertical commit chain:
```
main
  │
  ├── a1b2c3d feat: add auth flow (pick)
  │   └── e4f5g6h (squashed into above)
  │
  ├── i7j8k9l chore: update deps (reword)
  │   └── j8k9l0m (fixup → above)
  │
  └── k9l0m1n debug log (dropped) — strikethrough
```

## Start Rebase Flow

1. User clicks "Start Rebase"
2. Confirmation dialog if destructive (drops, squashes lose history):
   ```
   ┌───────────────────────────────────┐
   │ Start Interactive Rebase?    ✕    │
   ├───────────────────────────────────┤
   │                                   │
   │ This will rewrite history.         │
   │                                   │
   │ 5 commits → 3 commits             │
   │ 2 commits will be dropped/lost    │
   │ 1 message will be changed         │
   │                                   │
   │ ⚠ If these commits have been      │
   │   pushed, you will need to        │
   │   force push afterward.           │
   │                                   │
   ├───────────────────────────────────┤
   │          [Cancel] [Start Rebase]  │
   └───────────────────────────────────┘
   ```
3. Rebase begins
4. If conflict → Merge Studio opens
5. After each resolution → Continue / Skip / Abort
6. Success: toast "Rebase complete. 5 commits → 3 commits."

## States

### Loading (computing todo list)
```
  [◌ Loading rebase todo list...]
```

### Empty (no commits to rebase)
```
  No commits between feature/auth and main.
  Branches are already in sync.
```

### Rebase in Progress
```
Toolbar changes:
  [Continue Rebase] [Skip Commit] [Abort Rebase]

Status bar shows:
  Rebasing: 2/5 commits applied
```

### Conflict During Rebase
```
Automatically switches to Merge Studio.
Merge Studio header: "Rebasing: commit 3/5 — e4f5g6h fix: login redirect"
After resolve: "Continue Rebase" / "Skip" / "Abort"
```

### Success
```
Toast:
  ✓ Rebase complete
  feature/auth rebased onto main
  5 commits → 3 commits
```

### Error
```
  ✕ Rebase failed
  [git error]
  [Abort Rebase] [View Details]
```

### Protected Branch (cannot rebase protected branch)
```
  ⚠ Cannot rebase 'main'
  Branch is protected.
  [OK]
```

## Component Tree

```
InteractiveRebaseEditor
├── RebaseToolbar
│   ├── StartRebaseButton (primary)
│   ├── AbortButton (secondary)
│   ├── ResetTodoButton (secondary, icon)
│   └── CommitCount (text, "5 commits selected")
├── RebaseLayout (horizontal split)
│   ├── TodoListPanel (left, ~60%)
│   │   └── TodoCommitRow[]
│   │       ├── DragHandle (≡ icon)
│   │       ├── ActionDropdown (pick/reword/edit/squash/fixup/drop)
│   │       ├── CommitHash (short)
│   │       ├── CommitMessage
│   │       └── ReorderButtons (↑↓ or drag)
│   └── PreviewPanel (right, ~40%)
│       ├── PreviewHeader
│       └── PreviewCommitChain
│           └── PreviewCommitNode[]
├── Divider
└── CommitDetailsPanel (bottom)
    ├── SelectedCommitHash
    ├── SelectedCommitMessage (full)
    ├── Author + Date
    └── ChangedFilesList
```

## Keyboard

| Key | Action |
|-----|--------|
| ↑/↓ | Navigate commits |
| Ctrl+↑/↓ | Reorder commit |
| Space | Open action dropdown |
| P | Set to pick |
| R | Set to reword |
| E | Set to edit |
| S | Set to squash |
| F | Set to fixup |
| D | Set to drop |
| Ctrl+Enter | Start rebase |
| Esc | Abort / Close |

## Theme Tokens

| Element | Token |
|---------|-------|
| Editor bg | `--vscode-editor-background` |
| Todo row hover | `--vscode-list-hoverBackground` |
| Selected row | `--vscode-list-activeSelectionBackground` |
| Dropped commit | Strikethrough + opacity 0.4 |
| Squash/fixup indent | Visual indent from parent |
| Preview panel bg | `--vscode-sideBar-background` |
| Drag handle | `--vscode-editor-foreground` opacity 0.3 |

## Acceptance Criteria

- [ ] Shows todo list with correct actions
- [ ] Drag & drop reordering
- [ ] Keyboard reordering (Ctrl+↑↓)
- [ ] Action dropdown per commit
- [ ] Preview updates in real-time
- [ ] Start rebase confirmation with impact summary
- [ ] Conflict handling: switches to merge studio
- [ ] Continue/Skip/Abort during rebase
- [ ] Success/error states
- [ ] Protected branch guard
- [ ] Pushed commit warning on start
- [ ] All themes
- [ ] Responsive: todo list stacks on narrow
