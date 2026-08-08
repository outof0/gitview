# GitView Diff — Design Documentation

> Principal Product Designer + Senior UX Engineer handoff
> Target: JetBrains-level Git experience for VS Code

## Deliverable Status

### Phase 1: Product & UX Spec ✅

| Document | Status | File |
|----------|--------|------|
| Product Principles | ✅ | `../maintainers/experience-spec.md` (existing) |
| Feature Coverage Matrix | ✅ | `specs/feature-coverage-matrix.md` |
| Information Architecture | ✅ | `specs/information-architecture.md` |
| Screen Inventory | ✅ | 22 screens cataloged |
| User Flows | ✅ | `specs/user-flows.md` (12 critical flows) |
| Design System | ✅ | `specs/design-system.md` |
| Interaction Rules | ✅ | In design system + per-wireframe |
| Accessibility | ✅ | In design system §10 |
| Responsive Behavior | ✅ | In design system §7 |
| Destructive Safeguards | ✅ | In design system §9 + per-wireframe |

### Phase 2: Wireframes ✅

| # | Screen | Status | File |
|---|--------|--------|------|
| 01 | Git Workspace (Changes) | ✅ EXISTING | `gitview-vscode-ui.pen` Frame 01 |
| 02 | Git History (Editor) | ✅ EXISTING | `gitview-vscode-ui.pen` Frame 02 |
| 03 | 3-Way Merge Editor | ✅ EXISTING | `gitview-vscode-ui.pen` Frame 03 |
| 04 | Explorer Git Menu | ✅ EXISTING | `gitview-vscode-ui.pen` Frame 04 |
| 05 | **Branch Popup** | ✅ NEW | `wireframes/W05-branch-popup.md` |
| 06 | **Push Dialog** | ✅ NEW | `wireframes/W06-push-dialog.md` |
| 07 | **Force Push Confirm** | ✅ NEW | In W06 (force push variant) |
| 08 | **Reset Dialog** | ✅ NEW | `wireframes/W08-reset-dialog.md` |
| 09 | **Interactive Rebase** | ✅ NEW | `wireframes/W09-interactive-rebase.md` |
| 10 | **Conflict List** | ✅ NEW | `wireframes/W10-conflict-list.md` |
| 11 | **Pull/Update Dialog** | ✅ NEW | `wireframes/W11-pull-update-dialog.md` |
| 17 | Create Branch Dialog | ⬜ P1 | Needs wireframe |
| 18 | Create Tag Dialog | ⬜ P1 | Needs wireframe |
| 19 | Merge Dialog | ⬜ P1 | Needs wireframe |
| 20 | Cherry-pick Dialog | ⬜ P1 | Needs wireframe |
| 21 | Compare Branches | ⬜ P1 | Needs wireframe |
| 22 | Stash Details | ⬜ P2 | Needs wireframe |

### Phase 3: High-Fidelity Design

- Existing frames (01-04) in `.pen` format with dark theme
- All wireframes include theme token mappings for light/dark/high-contrast
- Colors are theme-variable-based, not hardcoded

### Phase 4: Prototype

- Not applicable (no Figma/sketch capability)
- Wireframes are implementation-ready with all states documented

### Phase 5: Engineering Handoff ✅

| Artifact | Status |
|----------|--------|
| Component Hierarchy | ✅ Per wireframe |
| Component States | ✅ Per wireframe (empty/loading/error/success) |
| Design Tokens | ✅ `specs/design-system.md` |
| VS Code Theme Mapping | ✅ `specs/design-system.md` §2 |
| Layout Constraints | ✅ Responsive breakpoints per screen |
| Keyboard Shortcuts | ✅ Per wireframe + design system §7 |
| Command IDs | ✅ `specs/information-architecture.md` |
| Context Menu Placements | ✅ `specs/information-architecture.md` |
| Empty/Error/Loading Copy | ✅ Per wireframe |
| Accessibility Annotations | ✅ Design system §10 |
| Acceptance Criteria | ✅ Per wireframe |

## Quick Start for Engineers

1. **Design System:** `specs/design-system.md` — tokens, colors, component patterns
2. **Feature Gaps:** `specs/feature-coverage-matrix.md` — what's done vs missing
3. **New Screens to Build:** `wireframes/` directory — 6 P0 wireframes with full specs
4. **User Flows:** `specs/user-flows.md` — 12 critical flows to test against
5. **IA:** `specs/information-architecture.md` — where everything lives

## Priority Implementation Order

### P0 (Match JetBrains parity)
1. **W05 — Branch Popup:** Webview popup with search, groups, quick actions
2. **W06 — Push Dialog:** Commit preview, force push with lease, all states
3. **W08 — Reset Dialog:** Soft/Mixed/Hard with impact visualization
4. **W09 — Interactive Rebase:** Todo list editor with preview
5. **W10 — Conflict List:** Overview with bulk actions
6. **W11 — Pull/Update Dialog:** Strategy selector, incoming preview

### P1 (Strongly recommended)
7. Create Branch Dialog
8. Create Tag Dialog
9. Merge Dialog (with strategy options)
10. Cherry-pick Dialog (multi-select aware)
11. Compare Branches Screen (dedicated editor)

### P2 (Polish)
12. Stash Details dialog
13. Commit message history browser
14. Commit template editor

## Design Principles (from the spec)

1. Git state must be visible before it is changed
2. Destructive actions must be explicit and recoverable where Git allows
3. Local work must never disappear silently
4. Dense IDE tooling — no dashboard/hero/card UI
5. Default path safe; advanced power actions still available
6. VS Code theme-native — no hardcoded colors
7. Keyboard-first — every common action has a shortcut
8. Screen reader accessible — ARIA labels, focus order
9. Responsive — works at 300px sidebar to full editor width

## File Structure

```
docs/design/
├── README.md                          ← THIS FILE
├── gitview-vscode-ui.pen            ← Frames 01-04 (Pencil format)
├── specs/
│   ├── design-system.md               ← Tokens, components, patterns
│   ├── feature-coverage-matrix.md      ← Gap analysis vs JetBrains
│   ├── information-architecture.md     ← Feature→surface mapping
│   └── user-flows.md                  ← 12 critical Git flows
└── wireframes/
    ├── W05-branch-popup.md            ← Branch popup + per-branch actions
    ├── W06-push-dialog.md             ← Push + force push confirmation
    ├── W08-reset-dialog.md            ← Soft/Mixed/Hard reset
    ├── W09-interactive-rebase.md      ← Rebase todo editor
    ├── W10-conflict-list.md           ← Conflict overview + bulk actions
    └── W11-pull-update-dialog.md      ← Pull strategy + incoming preview
```
