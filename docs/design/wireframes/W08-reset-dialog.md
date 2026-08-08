# W08 — Reset Dialog (Soft / Mixed / Hard)

## Screen Info
- **Surface:** Webview dialog (modal)
- **Width:** 420px
- **Entry:** Right-click commit in Log → "Reset Current Branch to Here…", Command Palette
- **Purpose:** Reset HEAD with clear impact visualization per reset type

## Layout

```
┌──────────────────────────────────────┐
│ Reset: feature/auth to a1b2c3d  ✕   │
├──────────────────────────────────────┤
│                                      │
│ Reset current branch to commit:      │
│ ┌──────────────────────────────────┐ │
│ │ a1b2c3d feat: add auth flow     │ │
│ │ Erik · 2026-08-08 14:30         │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Reset Type:                          │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ ● Soft                          │ │
│ │   Move HEAD only.               │ │
│ │   Staged changes & working tree  │ │
│ │   are kept.                      │ │
│ │                        Safe ✓   │ │
│ └──────────────────────────────────┘ │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ ○ Mixed  (default)              │ │
│ │   Move HEAD + clear staging.     │ │
│ │   Working tree is kept.          │ │
│ │   Changes stay as edits.         │ │
│ │                      Moderate   │ │
│ └──────────────────────────────────┘ │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ ○ Hard                          │ │
│ │   Move HEAD + DISCARD all       │ │
│ │   changes in working tree.       │ │
│ │   ⚠ Cannot be undone without     │ │
│ │   reflog.                        │ │
│ │                    Destructive   │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Commits that will be discarded (3):  │
│ ┌──────────────────────────────────┐ │
│ │ a1b2c3d feat: add auth flow     │ │
│ │ e4f5g6h fix: login redirect     │ │
│ │ i7j8k9l chore: update deps      │ │
│ └──────────────────────────────────┘ │
│                                      │
│ [Hard reset only:]                   │
│ ☐ I understand changes will be lost  │
│                                      │
├──────────────────────────────────────┤
│               [Cancel]  [Reset →]    │
└──────────────────────────────────────┘
```

## Reset Type Behavior

### Soft Reset
- Move HEAD to selected commit
- Index (staging) unchanged
- Working tree unchanged
- **Commit list shows:** all commits between selected and current HEAD
- **Safeguard:** Level 1 — simple confirm dialog
- **Result toast:** "HEAD reset to a1b2c3d (soft). Staged changes kept."

### Mixed Reset (default)
- Move HEAD to selected commit
- Index cleared (unstaged)
- Working tree unchanged
- **Commit list shows:** all commits between selected and current HEAD
- **Impact:** "3 files will be unstaged"
- **Safeguard:** Level 2 — confirm with unstaged file preview
- **Result toast:** "HEAD reset to a1b2c3d (mixed). Changes unstaged."

### Hard Reset
- Move HEAD to selected commit
- Index cleared
- Working tree DISCARDED
- **Commit list shows:** all commits between selected and current HEAD
- **Impact:** "3 commits discarded, all working tree changes lost"
- **Safeguard:** Level 3 — checkbox + confirm
- **Result toast:** "HEAD reset to a1b2c3d (hard). Use reflog to recover if needed."

## States

### Protected Branch (Hard Reset blocked)
```
  ⚠ Cannot hard reset 'main'
  Branch is protected.
  Soft and Mixed reset are still available.
  [OK]
```

### Dirty Working Tree (Hard Reset)
```
Additional warning when hard reset with uncommitted changes:

  ⚠ You also have uncommitted changes!

  2 modified files will be lost:
  ┌──────────────────────────────────┐
  │ M  src/components/Button.tsx     │
  │ M  src/utils/config.ts           │
  └──────────────────────────────────┘

  These cannot be recovered with reflog.
```

### Empty (no commits to discard)
```
  HEAD is already at a1b2c3d.
  Nothing to reset.
  [OK]
```

### Loading
```
  [◌ Computing reset impact...]
```

### Success
```
Toast:
  ✓ HEAD reset to a1b2c3d (mixed)
  3 commits unstaged. Working tree unchanged.
  [Undo] (if reflog available)
```

### Error
```
  ✕ Reset failed
  Could not reset: [git error message]
  [Close]
```

## Component Tree

```
ResetDialog
├── DialogTitle ("Reset: {branch} to {sha}")
├── DialogBody
│   ├── CommitPreview (target commit info)
│   ├── ResetTypeSelector
│   │   ├── ResetTypeOption (Soft) — selected state highlighted green
│   │   ├── ResetTypeOption (Mixed) — default, neutral
│   │   └── ResetTypeOption (Hard) — danger styling, red icon
│   ├── ImpactPreview
│   │   ├── ImpactDescription (per type)
│   │   ├── DiscardedCommitsList (all types)
│   │   └── DirtyWorkingTreeWarning (Hard only, if applicable)
│   └── DestructiveConfirmation (Hard only)
│       ├── Checkbox ("I understand...")
│       └── TypeToConfirm (skip for now, checkbox sufficient)
├── DialogFooter
│   ├── CancelButton
│   └── ResetButton (label changes per type: "Soft Reset" / "Mixed Reset" / "Hard Reset")
```

## Keyboard

| Key | Action |
|-----|--------|
| Enter | Execute reset (when enabled) |
| Esc | Cancel |
| ↑/↓ | Switch reset type |
| S | Select Soft |
| M | Select Mixed |
| H | Select Hard |

## Theme Tokens

| Element | Token |
|---------|-------|
| Dialog bg | `--vscode-editor-background` |
| Soft option (selected) | Green-tinted bg |
| Mixed option (default) | Neutral bg |
| Hard option | Red-tinted border/icon |
| Discarded commits box | `--vscode-diffEditor-removedTextBackground` low opacity |
| Danger button | Dark red bg |

## Acceptance Criteria

- [ ] Three reset types clearly differentiated with impact descriptions
- [ ] Soft: Level-1 confirm
- [ ] Mixed: Level-2 confirm with unstaged file list
- [ ] Hard: Level-3 confirm with checkbox + dirty work warning
- [ ] Protected branch blocks hard reset
- [ ] Shows correct commit list for each type
- [ ] Dirty working tree shows extra warning for hard reset
- [ ] Success toast with undo hint (reflog)
- [ ] All themes
- [ ] Keyboard navigation
