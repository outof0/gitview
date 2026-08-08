# Information Architecture — GitView Diff

## Feature → Surface Mapping

```
COMMAND PALETTE (Ctrl+Shift+P)
├── GitView Git: Open Git Workspace
├── Resolve conflict
├── Show History
├── Compare with Revision…
├── Compare with Branch…
├── Show Diff
├── Annotate with Git Blame
├── Rollback / Add / Unstage / Commit… / Commit and Push…
├── Fetch / Pull… / Push… / Sync
├── Branches… / New Branch…
├── Stash Changes… / Unstash Changes…
├── Shelve Changes… / Unshelve Changes…
├── Merge… / Rebase…
└── Refresh Git Status

ACTIVITY BAR — GitView Git icon (git-branch)
└── Git Workspace (webview sidebar, ~300px)
    ├── Toolbar
    │   ├── Repository Selector ▾ (multi-root)
    │   ├── Branch Name ▾ → Branch Popup
    │   ├── Sync Status (↓2 ↑1)
    │   └── Quick Actions: Fetch | Pull | Push | ⋮
    ├── Tabs: Changes | Log | Blame | Temporary
    │
    ├── Changes Tab
    │   ├── Changelist/Staging Tree
    │   │   ├── Changes (3)
    │   │   │   ├── M  src/components/Button.tsx
    │   │   │   ├── A  src/utils/config.ts
    │   │   │   └── D  old/legacy.ts
    │   │   ├── Unversioned Files (2)
    │   │   └── Merge Conflicts (when present)
    │   ├── Inline Diff Preview (selected file)
    │   ├── Commit Message Editor
    │   ├── Commit Options (amend, sign-off, GPG)
    │   └── [Commit] [Commit and Push ▾]
    │
    ├── Log Tab
    │   ├── Toolbar: Search | Branch ▾ | Author ▾ | Paths ▾
    │   ├── Branch Tree (collapsed by default)
    │   │   ├── Local
    │   │   └── Remote
    │   ├── Commit Graph + List
    │   │   └── ● feat: support variants  HEAD  a1b2c3d  Erik  2m ago
    │   ├── Right Panel
    │   │   ├── Changed Files (top)
    │   │   └── Commit Details (bottom)
    │   └── Diff Preview (Ctrl+D)
    │
    ├── Blame Tab
    │   └── Annotation view of current file
    │
    └── Temporary Tab
        ├── Stashes
        │   └── stash@{0}: WIP feature/auth
        ├── Shelves
        │   └── shelf: button-fix
        └── Patches
            └── patch: config-changes

EDITOR TABS (webview panels, full-width)
├── Git History
│   └── Same as Log tab but in editor space
├── Git Diff
│   ├── Side-by-side / Unified toggle
│   ├── File navigation tabs
│   └── Hunk actions per line
├── Git Blame
│   ├── Annotation gutter
│   └── History panel
├── Merge Studio (3-way)
│   ├── Left (Local) | Center (Result) | Right (Incoming)
│   ├── Conflict navigation
│   └── Block actions
├── Conflict List
│   ├── File list with status
│   └── Bulk actions
├── Interactive Rebase Editor
│   ├── Todo list (left)
│   └── Preview (right)
└── Compare Branches
    ├── Branch A selector
    ├── Branch B selector
    └── Diff viewer

CONTEXT MENUS
├── Explorer (native VS Code)
│   └── Git submenu
│       ├── History group
│       ├── Local group
│       ├── Commit group
│       ├── Remote group
│       └── Integrate group
├── Editor (native VS Code)
│   └── Same Git submenu
├── SCM Resource (native VS Code)
│   └── Same Git submenu
├── Git Workspace Changes (webview)
│   └── GitContextMenuItems
├── Git Workspace Log Commit (webview)
│   └── GitHistoryCommitMenuItems
├── Git Workspace Log File (webview)
│   └── GitHistoryFileMenuItems
├── Merge Studio (webview)
│   ├── Block context menu
│   └── Gutter context menu
├── Conflict List (webview)
│   └── ConflictsContextMenuContent
└── Branch Popup (webview)
    └── Per-branch overflow menu

DIALOGS (webview modals)
├── Push Dialog (when no upstream)
├── Force Push Confirmation
├── Pull/Update Dialog
├── Reset Dialog (Soft/Mixed/Hard)
├── Create Branch Dialog
├── Create Tag Dialog
├── Rename Branch Dialog
├── Delete Branch Confirmation
├── Merge Dialog
├── Rebase Dialog
├── Stash Dialog
├── Cherry-pick Dialog
└── Generic GitDialogShell

STATUS BAR
├── Branch indicator (click → Branch Popup)
├── Sync status indicator
└── Active operation (Merging… / Rebasing…)
```

## Navigation Model

```
Primary:    Activity Bar → GitView Git → Git Workspace
Secondary:  Command Palette → any command
Contextual: Right-click → Git submenu
Trigger:    Conflict markers → "Resolve conflict" button
Status:     Status Bar → Branch Popup
```

## Screen Inventory (Complete)

| # | Screen | Surface | Wireframe | Priority |
|---|--------|---------|-----------|----------|
| S01 | Git Workspace — Changes | Sidebar | ✅ Frame 01 | DONE |
| S02 | Git Workspace — Log | Sidebar | ✅ Frame 01 | DONE |
| S03 | Git Workspace — Blame | Sidebar | — | EXISTING |
| S04 | Git Workspace — Temporary | Sidebar | — | EXISTING |
| S05 | Git History | Editor | ✅ Frame 02 | DONE |
| S06 | Merge Studio (3-way) | Editor | ✅ Frame 03 | DONE |
| S07 | Explorer Git Menu | Native | ✅ Frame 04 | DONE |
| S08 | Git Diff App | Editor | — | EXISTING |
| S09 | Git Blame App | Editor | — | EXISTING |
| S10 | **Branch Popup** | Popup | ✅ W05 | **NEW** |
| S11 | **Push Dialog** | Dialog | ✅ W06 | **NEW** |
| S12 | **Force Push Confirm** | Dialog | ✅ In W06 | **NEW** |
| S13 | **Reset Dialog** | Dialog | ✅ W08 | **NEW** |
| S14 | **Interactive Rebase** | Editor | ✅ W09 | **NEW** |
| S15 | **Conflict List** | Editor | ✅ W10 | **NEW** |
| S16 | **Pull/Update Dialog** | Dialog | ✅ W11 | **NEW** |
| S17 | Create Branch Dialog | Dialog | — | P1 |
| S18 | Create Tag Dialog | Dialog | — | P1 |
| S19 | Merge Dialog | Dialog | — | P1 |
| S20 | Cherry-pick Dialog | Dialog | — | P1 |
| S21 | Compare Branches | Editor | — | P1 |
| S22 | Stash Details | Dialog | — | P2 |

## Command Inventory

See: `docs/reference/commands.md`

New commands proposed:

| ID | Title |
|----|-------|
| `gitView.branchPopup` | Show Branch Popup |
| `gitView.pushDialog` | Push… (dialog) |
| `gitView.forcePushLease` | Force Push with Lease |
| `gitView.pullDialog` | Pull… (dialog) |
| `gitView.resetDialog` | Reset Current Branch… |
| `gitView.interactiveRebase` | Start Interactive Rebase… |
| `gitView.rebaseSkip` | Skip Commit |
| `gitView.stashCreateBranch` | Create Branch from Stash |
| `gitView.createTag` | Create Tag… |
| `gitView.deleteTag` | Delete Tag… |
| `gitView.compareBranches` | Compare Branches… |
