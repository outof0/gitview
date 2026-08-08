# Feature Coverage Matrix — vs JetBrains Git Benchmark

Status: ✅ Implemented+Tested | 🟡 Implemented (no wireframe) | 🔴 Missing Wireframe | ⬜ Not Yet

## A. Git Tool Window

| Feature | Status | Notes |
|---------|--------|-------|
| Repository selector | ✅ | Frame 01 |
| Current branch display | ✅ | Frame 01 toolbar |
| Sync status (incoming/outgoing) | ✅ | ↓2 ↑1 indicators |
| Local changes tree | ✅ | Frame 01 Changes tab |
| Changelists | ✅ | Frame 01 |
| Unversioned files | ✅ | Collapsible group |
| Ignored files | ✅ | Toggle setting |
| Merge conflicts banner | ✅ | Shows during conflict state |
| Stashes list | ✅ | Frame 01 Temporary tab |
| Shelves list | ✅ | Frame 01 Temporary tab |
| Submodules | ✅ | Coverage matrix |
| Worktrees | ✅ | Coverage matrix |
| Quick actions (Fetch/Pull/Push) | ✅ | Frame 01 toolbar |
| Multi-repo workspace | ✅ | Repo selector |
| Empty repo state | 🔴 | Needs compact empty state design |
| Clean working tree | 🔴 | Needs empty state design |
| Detached HEAD state | 🟡 | Works but no visual spec |
| Rebase-in-progress state | 🟡 | Works but no visual spec |
| No-remote state | 🟡 | Works but no visual spec |
| Offline state | 🔴 | No design for connectivity errors |

## B. Commit Experience

| Feature | Status | Notes |
|---------|--------|-------|
| Changed files list | ✅ | Frame 01 Changes tab |
| Stage/unstage | ✅ | Per-file, per-hunk |
| Partial commit (hunk-level) | ✅ | Diff preview + stage hunk |
| Commit message editor | ✅ | Frame 01 inline editor |
| Amend commit | 🟡 | Feature exists, UI not spec'd |
| Sign-off | 🟡 | Feature exists |
| GPG signing | 🟡 | Feature exists |
| Commit and Push | ✅ | Split button |
| Pre-commit hooks | ✅ | Settings + check |
| Commit checks (TODO, lint) | ✅ | Settings |
| Commit message history | 🔴 | No design |
| Commit templates | 🔴 | No design |
| Spellcheck | 🔴 | No design |
| Warning: empty message | 🔴 | No visual spec |
| Warning: no files selected | 🔴 | No visual spec |

## C. Git Log

| Feature | Status | Notes |
|---------|--------|-------|
| Commit graph | ✅ | Frame 02 |
| Branch lines/refs | ✅ | Colored dots |
| Local/remote branches | ✅ | Branch tree (collapsed default) |
| Tags | ✅ | Coverage matrix |
| HEAD indicator | ✅ | Frame 02 |
| Commit details panel | ✅ | Frame 02 right panel |
| Changed files panel | ✅ | Frame 02 |
| Diff preview | ✅ | Ctrl+D |
| Search/filter | ✅ | Frame 02 filter bar |
| Branch filter | ✅ | |
| Author filter | ✅ | |
| Date filter | ✅ | |
| Path filter | ✅ | File/folder history |
| Cherry-pick | ✅ | Multi-select supported |
| Revert | ✅ | Multi-select supported |
| Reset to commit | 🟡 | Feature exists, dialog not wireframed |
| Create branch from commit | ✅ | |
| Create tag | 🟡 | Feature exists, dialog not wireframed |
| Compare branches | 🟡 | Feature exists, screen not wireframed |
| Copy hash | ✅ | Context menu |
| Open on remote | ✅ | |
| Pagination/virtual scroll | 🟡 | Large repo handling exists |
| Very large repo | ✅ | n-limit + debounce |

## D. Branch Management

| Feature | Status | Notes |
|---------|--------|-------|
| Current branch | ✅ | |
| Local branches | ✅ | |
| Remote branches | ✅ | |
| Recent branches | 🔴 | In branch popup wireframe |
| Favorite branches | 🔴 | In branch popup wireframe |
| Search branch | 🔴 | In branch popup wireframe |
| Checkout | ✅ | With dirty work guard |
| Create branch | ✅ | From current or selected |
| Rename branch | ✅ | |
| Delete branch | ✅ | Unmerged warning |
| Merge into current | ✅ | |
| Rebase onto | ✅ | |
| Compare with current | ✅ | |
| Push branch | ✅ | |
| Set/unset upstream | ✅ | |
| Smart Checkout | ✅ | Stash+switch+unstash |
| Force Checkout | ✅ | Destructive confirm |
| Branch popup UI | 🔴 | NEEDS WIREFRAME (W05) |

## E. Merge Conflict Resolution

| Feature | Status | Notes |
|---------|--------|-------|
| Three-way merge editor | ✅ | Frame 03 |
| Left (Local) pane | ✅ | Read-only |
| Center (Result) pane | ✅ | Editable |
| Right (Incoming) pane | ✅ | Read-only |
| Accept Left/Right/Both | ✅ | Per-block actions |
| Navigate conflicts | ✅ | F7/Shift+F7 |
| Conflict counter | ✅ | Frame 03 |
| Auto-resolve simple | ✅ | |
| Manual edit | ✅ | With validation |
| Apply / mark resolved | ✅ | With git add |
| Abort merge/rebase | ✅ | |
| Continue operation | ✅ | |
| Syntax highlighting | ✅ | Monaco editor |
| Word-level diff | ✅ | Setting |
| Conflict overview list | 🔴 | NEEDS WIREFRAME (W10) |
| Bulk accept actions | 🔴 | In conflict list design |
| Binary conflict handling | 🟡 | Fallback exists |
| Add/add conflict | 🟡 | Merge doc handles |
| Modify/delete conflict | 🟡 | Merge doc handles |

## F. Diff Viewer

Two surfaces render diffs: the workspace panel (`WorkspaceDiffPanel`, own renderer)
and Show Diff / Compare (`GitDiffApp`, Monaco renderer). Status below covers both
unless a surface is named.

| Feature | Status | Notes |
|---------|--------|-------|
| Side-by-side diff | ✅ | |
| Unified diff | ✅ | Viewer-mode switch on both surfaces |
| Three-way diff | ✅ | Merge studio |
| Word-level diff | 🟡 | Workspace panel only; Monaco has no granularity option |
| Ignore whitespace | 🟡 | Show Diff offers trim only (Monaco `ignoreTrimWhitespace`) |
| Collapse unchanged | 🟡 | Show Diff only |
| Previous/next change | ✅ | Show Diff toolbar + F7 / Shift+F7 |
| Difference counter | ✅ | Show Diff toolbar |
| Soft wrap toggle | ✅ | Show Diff toolbar |
| Stage/revert hunk | 🟡 | Workspace panel only; Show Diff compares read-only revisions |
| File navigation | ✅ | |
| Standalone diff app | 🟡 | Exists, not wireframed |

## G. Push, Pull, Fetch, Sync

| Feature | Status | Notes |
|---------|--------|-------|
| Fetch | ✅ | Silent |
| Pull | ✅ | Strategy setting |
| Pull with rebase | ✅ | Setting |
| Push | ✅ | Silent when upstream set |
| Force push | 🟡 | NEEDS WIREFRAME (W07) |
| Force push with lease | 🟡 | NEEDS WIREFRAME (W07) |
| Sync | ✅ | |
| Push dialog | 🔴 | NEEDS WIREFRAME (W06) |
| Pull/update dialog | 🔴 | NEEDS WIREFRAME |
| Incoming/outgoing preview | 🔴 | In push/pull dialogs |
| Rejected push handling | 🔴 | In push dialog design |
| Protected branch warning | ✅ | Setting + guard |
| Auth error handling | 🟡 | Error surfaces exist |
| Progress + cancel | 🟡 | Toast notifications |

## H. Rebase

| Feature | Status | Notes |
|---------|--------|-------|
| Rebase onto branch | ✅ | |
| Interactive rebase | 🔴 | NEEDS WIREFRAME (W09) |
| Reorder commits | 🔴 | In interactive rebase editor |
| Reword/Squash/Fixup/Drop | 🔴 | In interactive rebase editor |
| Continue/Skip/Abort | ✅ | Operation recovery |
| Conflict during rebase | ✅ | Enters merge studio |
| Public commit warning | 🟡 | Protected branch guard |

## I. Stash & Shelf

| Feature | Status | Notes |
|---------|--------|-------|
| Create stash | ✅ | All or selected |
| Stash message | ✅ | |
| Include untracked | ✅ | |
| Apply/Pop/Drop | ✅ | |
| Create branch from stash | 🟡 | Feature exists |
| Shelf (custom) | ✅ | GitView shelf |
| Shelve files/hunks | ✅ | |
| Unshelve | ✅ | |
| Patch create/apply | ✅ | File or clipboard |
| Stash management UI | 🔴 | NEEDS WIREFRAME (see Temporary tab) |

## J. Reset, Revert, Restore

| Feature | Status | Notes |
|---------|--------|-------|
| Soft reset | 🟡 | NEEDS WIREFRAME (W08) |
| Mixed reset | 🟡 | NEEDS WIREFRAME (W08) |
| Hard reset | 🟡 | NEEDS WIREFRAME (W08) |
| Revert commit | ✅ | Multi-select |
| Rollback file | ✅ | With confirm |
| Discard changes | ✅ | With confirm |
| Reset dialog UI | 🔴 | NEEDS WIREFRAME (W08) |

## K. File History & Blame

| Feature | Status | Notes |
|---------|--------|-------|
| File history | ✅ | Frame 02 variant |
| Folder history | ✅ | |
| Blame/annotate | ✅ | GitBlameApp |
| Hover details | ✅ | Annotation gutter |
| Navigate to commit | ✅ | From blame |

## L. Remote & Repository Management

| Feature | Status | Notes |
|---------|--------|-------|
| Add/edit/remove remote | 🟡 | Feature exists, UI minimal |
| Clone | 🟡 | VS Code native |
| Init | 🟡 | VS Code native |
| Submodules | ✅ | |
| Worktrees | ✅ | |
| Repository settings | ✅ | VS Code settings.json |
| Protected branches | ✅ | |
| Pull strategy | ✅ | Setting |

## Summary

| Category | ✅ Done | 🟡 Needs UI | 🔴 Missing |
|----------|---------|-------------|------------|
| A. Tool Window | 15 | 4 | 3 |
| B. Commit | 8 | 3 | 4 |
| C. Git Log | 18 | 4 | 0 |
| D. Branches | 14 | 0 | 6 |
| E. Merge Conflict | 14 | 4 | 2 |
| F. Diff Viewer | 10 | 1 | 0 |
| G. Push/Pull/Fetch | 6 | 4 | 6 |
| H. Rebase | 3 | 1 | 5 |
| I. Stash/Shelf | 11 | 1 | 1 |
| J. Reset/Revert | 4 | 3 | 1 |
| K. File History | 5 | 0 | 0 |
| L. Remote Mgmt | 8 | 3 | 0 |
| **TOTAL** | **116** | **28** | **28** |

### Priority: Wireframes Needed (P0)
1. W05 — Branch Popup
2. W06 — Push Dialog
3. W07 — Force Push Confirmation
4. W08 — Reset Dialog (Soft/Mixed/Hard)
5. W09 — Interactive Rebase Editor
6. W10 — Conflict List Overview
7. W11 — Pull/Update Dialog
