# W10 — Conflict List Overview (Editor Webview)

## Screen Info
- **Surface:** Editor tab webview
- **Width:** Full editor width
- **Entry:** Auto-opens when conflicts detected; also via "Resolve conflict" command
- **Purpose:** Overview of all conflicted files with status, bulk actions, and quick resolution

## Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ Merge Conflicts — gitview                                  ✕   │
├──────────────────────────────────────────────────────────────────┤
│ 🔍 Filter files...    Branch: main ← feature/auth   3 conflicts │
├──────────────────────────────────────────────────────────────────┤
│ [Accept All Yours] [Accept All Theirs] [Merge All]  [Abort Merge]│
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ! src/components/Button.tsx           MODIFIED    [Resolve →]  │
│    Both modified · 3 conflict blocks                             │
│                                                                  │
│  ! src/utils/config.ts                 MODIFIED    [Resolve →]  │
│    Both modified · 1 conflict block                              │
│                                                                  │
│  ! src/styles/theme.css                DELETED     [Resolve →]  │
│    Deleted by them · modified by us                              │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ Resolved: 0/3                                          Continue: │
│ Merge disabled (3 conflicts remaining)                 [grayed] │
└──────────────────────────────────────────────────────────────────┘
```

## File Row Details

Each file row shows:
```
┌──────────────────────────────────────────────────────────────────┐
│ !  src/components/Button.tsx            MODIFIED     [Resolve →] │
│    Both modified · 3 conflict blocks                             │
│                                                                  │
│    Quick actions: [Accept Yours] [Accept Theirs]                 │
└──────────────────────────────────────────────────────────────────┘
```

- **Status icon:** ! (conflicted), ✓ (resolved)
- **File path:** relative to repo root
- **Conflict type:** MODIFIED/MODIFIED, DELETED/MODIFIED, ADDED/ADDED, RENAMED
- **Conflict count:** "3 conflict blocks"
- **Quick actions:** Accept Yours, Accept Theirs (inline, not requiring merge editor)

## Conflict Type Badges

| Type | Description | Icon |
|------|-------------|------|
| Both Modified | Both sides changed the file | ✎✎ |
| Deleted by Them | They deleted, we modified | ✕✎ |
| Deleted by Us | We deleted, they modified | ✎✕ |
| Both Added | Both sides added same file | ✚✚ |
| Both Deleted | Both sides deleted (rare) | ✕✕ |
| Renamed | File renamed differently | ↻ |
| Binary | Binary file conflict | ⬡ |

## Bulk Actions

### Accept All Yours
- Confirmation dialog:
  ```
  Accept YOUR version for all 3 files?
  This will overwrite all conflicting files with your local version.
  [Cancel] [Accept All Yours]
  ```

### Accept All Theirs
- Same pattern, with "incoming version"

### Merge All
- Opens first file in merge studio
- Auto-advances to next file after each resolution

### Abort Merge
- Level 2 confirmation:
  ```
  Abort merge in progress?
  All conflict resolution progress will be lost.
  [Cancel] [Abort Merge]
  ```

## States

### Loading
```
  [◌ Scanning for conflicts...]
```

### Empty (no conflicts)
```
  ✓ No merge conflicts
  Working tree is clean.
```

### All Resolved
```
  ✓ All conflicts resolved (3/3)
  ┌──────────────────────────────────┐
  │ ✓ src/components/Button.tsx      │
  │ ✓ src/utils/config.ts            │
  │ ✓ src/styles/theme.css           │
  └──────────────────────────────────┘

  [Continue Merge] [Commit]
```

### Some Resolved
```
  Resolved: 1/3
  Continue Merge disabled (2 conflicts remaining)

  ✓ src/components/Button.tsx     [Reopen]
  ! src/utils/config.ts           [Resolve →]
  ! src/styles/theme.css          [Resolve →]
```

### Error (cannot read file)
```
  ! src/binary-asset.png
  Binary file cannot be merged in editor.
  [Accept Yours] [Accept Theirs]
```

### Filtered (no results)
```
  No files match "test"
  [Clear filter]
```

## Component Tree

```
ConflictListScreen
├── ConflictListHeader
│   ├── Title ("Merge Conflicts" / "Rebase Conflicts")
│   ├── CloseButton
│   └── OperationContext (merge/rebase/cherry-pick indicator)
├── ConflictToolbar
│   ├── SearchInput
│   ├── BranchInfo ("main ← feature/auth")
│   └── ConflictCount ("3 conflicts")
├── BulkActionBar
│   ├── AcceptAllYoursButton
│   ├── AcceptAllTheirsButton
│   ├── MergeAllButton
│   └── AbortOperationButton
├── ConflictFileList
│   └── ConflictFileRow[]
│       ├── StatusIcon (! or ✓)
│       ├── FilePath
│       ├── ConflictTypeBadge
│       ├── ConflictBlockCount
│       ├── QuickActionButtons (inline)
│       └── ResolveButton (opens merge studio)
├── ConflictListFooter
│   ├── ProgressIndicator ("Resolved: 1/3")
│   └── ContinueButton (disabled until all resolved)
```

## Keyboard

| Key | Action |
|-----|--------|
| ↑/↓ | Navigate files |
| Enter | Open merge studio for selected |
| Ctrl+Y | Accept Yours (selected file) |
| Ctrl+T | Accept Theirs (selected file) |
| Ctrl+Shift+M | Merge All (sequential) |
| Esc | Close / Go back |

## Context Menu (right-click file)

```
┌─────────────────────────────┐
│ Merge...                    │
│ ─────────────────────────── │
│ Accept Yours                │
│ Accept Theirs               │
│ ─────────────────────────── │
│ Show Diff                   │
│ Open File                   │
│ Reveal in Explorer          │
│ ─────────────────────────── │
│ Mark as Resolved            │
└─────────────────────────────┘
```

## Theme Tokens

| Element | Token |
|---------|-------|
| Background | `--vscode-editor-background` |
| Conflict icon | `--vscode-gitDecoration-conflictingResourceForeground` |
| Resolved icon | `--vscode-gitDecoration-addedResourceForeground` |
| Row hover | `--vscode-list-hoverBackground` |
| Type badge bg | `--vscode-badge-background` |

## Acceptance Criteria

- [ ] Shows all conflicted files with type and block count
- [ ] Bulk actions with confirmation
- [ ] Inline quick actions per file (Accept Yours/Theirs)
- [ ] "Resolve →" opens merge studio for that file
- [ ] Progress counter updates as files are resolved
- [ ] Continue button enables when all resolved
- [ ] Filter by file name
- [ ] Binary file fallback
- [ ] All conflict types represented
- [ ] Context menu per file
- [ ] Keyboard navigation
- [ ] Empty/loading/error states
- [ ] All themes
