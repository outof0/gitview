# GitView Diff — Design System

> IDE tool-window density · VS Code theme-native · Lucide icons · No dashboard chrome

## 1. Density Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--nx-row-h` | 22px | Tree rows / commit list rows |
| `--nx-toolbar-h` | 28px | All toolbars |
| `--nx-menu-item-h` | 24px | Context menu items |
| `--nx-font-size-ui` | 12px | UI chrome text |
| `--nx-font-size-section` | 10px | Section headers (uppercase) |
| `--nx-font-size-code` | 11-13px | Code in trees/panels |
| `--nx-menu-pad-x` | 10px | Menu horizontal padding |
| `--nx-dialog-min-w` | 340px | Dialog minimum |
| `--nx-dialog-max-w` | 560px | Dialog maximum |

## 2. VS Code Theme Token Mapping (ALL colors)

| Usage | VS Code Token |
|-------|---------------|
| Panel bg | `var(--vscode-editor-background)` |
| Sidebar bg | `var(--vscode-sideBar-background)` |
| Foreground | `var(--vscode-editor-foreground)` |
| Selected row | `var(--vscode-list-activeSelectionBackground)` |
| Hover row | `var(--vscode-list-hoverBackground)` |
| Focus | `var(--vscode-list-focusOutline)` |
| Input bg | `var(--vscode-input-background)` |
| Button primary | `var(--vscode-button-background)` |
| Button secondary | `var(--vscode-button-secondaryBackground)` |
| Git added | `var(--vscode-gitDecoration-addedResourceForeground)` |
| Git modified | `var(--vscode-gitDecoration-modifiedResourceForeground)` |
| Git deleted | `var(--vscode-gitDecoration-deletedResourceForeground)` |
| Git untracked | `var(--vscode-gitDecoration-untrackedResourceForeground)` |
| Git conflict | `var(--vscode-gitDecoration-conflictingResourceForeground)` |
| Diff insert | `var(--vscode-diffEditor-insertedTextBackground)` |
| Diff remove | `var(--vscode-diffEditor-removedTextBackground)` |
| Warning | `var(--vscode-editorWarning-foreground)` |
| Error | `var(--vscode-editorError-foreground)` |

## 3. Typography

| Level | Font | Size | Weight |
|-------|------|------|--------|
| UI chrome | `var(--vscode-font-family)` | 12px | 400 |
| UI bold | `var(--vscode-font-family)` | 12px | 600 |
| Section header | `var(--vscode-font-family)` | 10px | 600, uppercase |
| Code | `var(--vscode-editor-font-family)` | 11-13px | 400, monospace |
| Dialog title | `var(--vscode-font-family)` | 13px | 600 |

## 4. Component Patterns

### Button
```
Primary:   height 26px, bg --vscode-button-background
Secondary: height 26px, bg --vscode-button-secondaryBackground
Danger:    height 26px, red-tinted bg
Icon:      26x26, icon 14-16px
Split:     primary + dropdown arrow
Disabled:  opacity 0.5
```

### Confirmation Levels for Destructive Actions

| Level | When | Pattern |
|-------|------|---------|
| L1 | Safe | Inline toast |
| L2 | Medium risk | Dialog + Confirm button |
| L3 | Destructive | Impact viz + checkbox acknowledge + type-to-confirm |

L3 Pattern:
```
[Impact description]
[Red box: list of affected items]
[ ] I understand this is destructive
Type 'name' to confirm: [____]
              [Cancel] [Confirm]
           (Confirm disabled until checkbox + text match)
```

### Empty State (Compact)
```
[icon 16px muted]
One-line description (12px)
[Optional action link]
No hero, no cards, no marketing text
```

## 5. File Status Indicators

| Status | Prefix | Color Token |
|--------|--------|-------------|
| Modified | M | gitDecoration-modifiedResourceForeground |
| Added | A | gitDecoration-addedResourceForeground |
| Deleted | D | gitDecoration-deletedResourceForeground |
| Renamed | R | same as modified |
| Untracked | ? | gitDecoration-untrackedResourceForeground |
| Ignored | I | gitDecoration-ignoredResourceForeground |
| Conflicted | ! | gitDecoration-conflictingResourceForeground |

## 6. Responsive Breakpoints

### Git Workspace Sidebar
- >280px: Full layout (toolbar + tabs + tree + commit panel)
- 220-280px: Compact (hide commit panel)
- <220px: Minimal (icons only)

### Git History (Editor)
- >900px: Branch tree + graph + files + details
- 600-900px: Graph + files + details stacked
- <600px: Graph only, details on click

### Merge Studio (Editor)
- >900px: 3 columns (Local | Result | Incoming)
- 500-900px: 2 columns (Result center + toggle)
- <500px: 1 column (Result only)

## 7. Keyboard Shortcuts

### Workspace
| Key | Action |
|-----|--------|
| Ctrl+Shift+G | Open Git Workspace |
| Ctrl+Enter | Commit |
| Ctrl+Shift+Enter | Commit and Push |
| Ctrl+Shift+K | Push |
| Ctrl+T | Pull / Update |
| Ctrl+Shift+F | Fetch |
| Ctrl+Shift+B | Branch Popup |

### Changes Tab
| Key | Action |
|-----|--------|
| Space | Toggle stage |
| Ctrl+D | Show diff |
| Delete | Discard (confirm) |

### Merge Studio
| Key | Action |
|-----|--------|
| F7 / Shift+F7 | Next/Prev conflict |
| Alt+1 | Accept Left |
| Alt+2 | Accept Right |
| Alt+3 | Accept Both |
| Ctrl+Enter | Apply |

## 8. Destructive Action Safeguards

| Action | Level | Guard |
|--------|-------|-------|
| Force Push | 3 | Show lost commits + checkbox + type branch |
| Force Push w/ Lease | 2 | Safety explanation + confirm |
| Hard Reset | 3 | Show lost commits + checkbox + confirm |
| Mixed Reset | 2 | Show unstaged changes + confirm |
| Delete unmerged branch | 2 | List unmerged commits + confirm |
| Rollback file | 2 | Diff preview + confirm |
| Discard all | 3 | File list + checkbox + confirm |
| Drop stash | 2 | Show stash message + confirm |
| Abort rebase | 2 | Lost work warning + confirm |
