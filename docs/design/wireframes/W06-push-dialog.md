# W06 — Push Dialog (Webview Dialog)

## Screen Info
- **Surface:** Webview dialog (modal)
- **Width:** 400px (min 340, max 560)
- **Entry:** Push button (when no upstream), Ctrl+Shift+K (when no upstream)
- **Purpose:** Configure and confirm push with commit preview

## Layout

```
┌──────────────────────────────────────┐
│ Push Commits                    ✕    │
├──────────────────────────────────────┤
│                                      │
│ Remote: [origin            ▾]        │
│                                      │
│ Branch: [feature/auth      ▾]        │
│                                      │
│ ☑ Set upstream                       │
│   (origin/feature/auth)              │
│                                      │
│ ☐ Push tags                          │
│                                      │
│ ☐ Force push                         │
│   ⚠ (--force-with-lease recommended) │
│                                      │
│ ──────────────────────────────────── │
│                                      │
│ Commits to push (3):                 │
│ ┌──────────────────────────────────┐ │
│ │ a1b2c3d feat: add auth flow     │ │
│ │         Erik · 2m ago           │ │
│ │ ────────────────────────────    │ │
│ │ e4f5g6h fix: login redirect     │ │
│ │         Erik · 5m ago           │ │
│ │ ────────────────────────────    │ │
│ │ i7j8k9l chore: update deps      │ │
│ │         Erik · 10m ago          │ │
│ └──────────────────────────────────┘ │
│                                      │
├──────────────────────────────────────┤
│               [Cancel]  [Push →]     │
└──────────────────────────────────────┘
```

## Force Push Variant

When "Force push" is checked, replace commits area with warning:

```
┌──────────────────────────────────────┐
│ ⚠ Force Push Confirmation      ✕    │
├──────────────────────────────────────┤
│                                      │
│ ⚠ You are about to OVERWRITE         │
│   origin/feature/auth                │
│                                      │
│ Local branch has diverged:           │
│   Your branch:     3 commits ahead   │
│   Remote branch:   2 commits ahead   │
│                                      │
│ These remote commits will be LOST:   │
│ ┌──────────────────────────────────┐ │
│ │ z9y8x7w feat: other work        │ │
│ │ y8x7w6v fix: critical hotfix    │ │
│ └──────────────────────────────────┘ │
│                                      │
│ 💡 Safer alternative:                │
│    Use "Force Push with Lease"       │
│    Only pushes if remote hasn't      │
│    changed since your last fetch.    │
│                                      │
│ ☐ I understand this is destructive   │
│                                      │
│ Type 'feature/auth' to confirm:      │
│ [________________________]           │
│                                      │
├──────────────────────────────────────┤
│    [Force w/ Lease]  [Force Push]    │
│              (disabled until confirm)│
└──────────────────────────────────────┘
```

## States

### Default (upstream not set)
- Remote dropdown shows configured remotes
- Branch input pre-filled with current branch name
- "Set upstream" checked by default

### Upstream Already Set
- Skip dialog entirely, push silently
- Show brief toast: "Pushed to origin/feature/auth"
- If rejected → show Rejected Push dialog

### Rejected Push
```
┌───────────────────────────────────┐
│ ⚠ Push Rejected             ✕    │
├───────────────────────────────────┤
│                                   │
│ Remote contains work you don't    │
│ have locally.                     │
│                                   │
│ error: failed to push some refs   │
│ hint: Updates were rejected       │
│ because the remote contains work  │
│ that you do not have locally.     │
│                                   │
│ What would you like to do?        │
│                                   │
│ [Pull first]  [Force w/ Lease]    │
│               [Force Push]        │
└───────────────────────────────────┘
```

### Pushing (loading)
```
Push button shows spinner:
  [◌ Pushing...]
Cancel button remains visible but changes to:
  [Cancel Push]
```

### Success
```
Toast (non-blocking):
  ✓ Pushed feature/auth to origin
  [View on GitHub]
```

### Error
```
┌───────────────────────────────────┐
│ ✕ Push Failed                ✕    │
├───────────────────────────────────┤
│                                   │
│ Authentication failed.            │
│                                   │
│ Remote: origin                    │
│ URL: https://github.com/...       │
│                                   │
│ [Configure Credentials]           │
│                                   │
├───────────────────────────────────┤
│                   [Close] [Retry] │
└───────────────────────────────────┘
```

### Protected Branch
```
  ⚠ Cannot force push to 'main'
  Branch is protected.
  Pattern: main (in settings)
  [OK]
```

### No Remote Configured
```
┌───────────────────────────────────┐
│ Push Commands                ✕    │
├───────────────────────────────────┤
│                                   │
│  No remote configured             │
│                                   │
│  This repository has no remote.   │
│  Add a remote to push commits.    │
│                                   │
│  [Add Remote...]                  │
│                                   │
├───────────────────────────────────┤
│                          [Close]  │
└───────────────────────────────────┘
```

## Component Tree

```
PushDialog
├── DialogTitle ("Push Commits")
├── DialogBody
│   ├── RemoteSelector (dropdown)
│   ├── BranchInput (text + autocomplete)
│   ├── Checkbox (Set upstream)
│   ├── Checkbox (Push tags)
│   ├── Checkbox (Force push — dangerous)
│   ├── Divider
│   └── CommitPreviewList
│       └── CommitRow[]
│           ├── CommitHash (short, blue)
│           ├── CommitMessage
│           └── AuthorDate
├── DialogFooter
│   ├── CancelButton (secondary)
│   └── PushButton (primary)
│
├── ForcePushConfirmation (conditional overlay)
│   ├── WarningIcon + Title
│   ├── LostCommitsList
│   ├── SaferAlternative (text, suggested)
│   ├── ConfirmCheckbox
│   ├── TypeToConfirmInput
│   └── ActionButtons
│
├── PushRejectedDialog (conditional)
│   ├── ErrorMessage
│   ├── GitErrorDetails
│   └── ActionOptions (Pull / Force / Force-Lease)
│
└── PushErrorDialog (conditional)
    ├── ErrorIcon + Message
    ├── ErrorDetails
    └── ActionButtons (Retry / Configure)
```

## Keyboard

| Key | Action |
|-----|--------|
| Enter | Push (when enabled) |
| Esc | Cancel / Close |
| Tab | Navigate fields |
| ↑/↓ | Navigate remote options |

## Theme Tokens

| Element | Token |
|---------|-------|
| Dialog bg | `--vscode-editor-background` |
| Input bg | `--vscode-input-background` |
| Commit list bg | `--vscode-sideBar-background` |
| Lost commits bg | Dark red tint (`--vscode-diffEditor-removedTextBackground` with low opacity) |
| Danger button | Dark red bg |
| Hash color | Blue (link color from theme) |

## Acceptance Criteria

- [ ] Opens when push has no upstream configured
- [ ] Skips dialog when upstream exists (push silently)
- [ ] Shows commit list preview
- [ ] Force push requires Level-3 confirmation (checkbox + type)
- [ ] Force push with lease requires Level-2 confirmation
- [ ] Rejected push shows options (pull / force / force-lease)
- [ ] Protected branch blocks force push
- [ ] Auth error shows configure action
- [ ] No remote shows add remote action
- [ ] Progress state with cancel
- [ ] All themes: light, dark, high contrast
- [ ] Keyboard: full navigation
