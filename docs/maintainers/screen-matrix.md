# Menu → Screen Audit & Update Plan

Date: 2026-08-08
Owner: Engineering
Status: **Approved scope — implement PR-A → PR-H**
Related: [experience-spec.md](./experience-spec.md), [ui-density.md](./ui-density.md), [coverage-matrix.md](./coverage-matrix.md)

## 1. Goal

Audit every **Git menu entry** and every **product screen/dialog** it opens. Produce a
single update plan so UI/UX is:

- Dense IDE tool-window (not dashboard/hero/marketing empty states)
- Sensible **interactive defaults** (no always-on chrome that should start closed)
- One visual language (VS Code tokens + Lucide + density tokens + `MenuItem` / `ToolEmptyState`)
- Dual-UX is intentional, not accidental (see §4)

**Out of scope for this plan:** restyling native VS Code Explorer/editor chrome (we own
order, titles, enablement only).

---

## 2. Inventory: entry points

| Entry | Surface | Owner | Density control |
| --- | --- | --- | --- |
| Explorer context → **Git** submenu | Native VS Code menu | `GIT_SUBMENU_ITEMS` + `package.json` | Titles/order/enablement only |
| Editor context → **Git** submenu | Same | Same | Same |
| SCM resource context → **Git** submenu | Same | Same | Same |
| Command Palette | Same commands | `registerGitMenuCommands` | N/A |
| Webview Changes/context Git menu | `GitContextMenuItems` | Full | Tokens + `MenuItem` |
| Merge resolver context menus | `MergeContextMenu` | Full | Tokens |
| Conflicts dialog context | `ConflictsContextMenuContent` | Full | Tokens |
| History commit / file menus | `GitHistoryCommitMenuItems`, `GitHistoryFileMenuItems` | Full | Tokens |
| Branches popup overflow | `branchesPopup/BranchRow` | Full | Tokens |
| Workspace tab chrome | `GitWorkspaceShell` | Full | Needs density pass |

Manifest source of truth: `src/types/gitSubmenu.ts` (`GIT_SUBMENU_ITEMS`).

---

## 3. Menu action → destination matrix

### 3.1 Explorer / Editor / Palette Git submenu

| # | Menu title | Action | Destination today | UX type | Grade | Notes / update target |
| --- | ---: | --- | --- | --- | --- | --- |
| 1 | Resolve conflict | `openConflictResolver` | `GitViewPanel` → Merge Studio | Webview screen | B | Density polish PR-H; only when merge changes |
| 2 | Show History | `showHistory` | `GitHistoryWebviewPanel` → `GitHistoryToolWindow` | Webview screen | B | Log layout; **branch tree closed by default** (PR-A); toggle opens |
| 3 | Compare with Revision… | `compareWithRevision` | QuickPick → `GitDiffApp` | QuickPick + Diff screen | B | Dense `ToolEmptyState` (PR-B); fixture `gitDiffVisual` |
| 4 | Compare with Branch… | `compareWithBranch` | QuickPick → `GitDiffApp` | QuickPick + Diff screen | B | Same as #3 |
| 5 | Show Diff | `showDiff` | `GitDiffApp` | Diff screen | B | Same as #3 |
| 6 | Annotate with Git Blame | `annotateBlame` | `GitBlameApp` (annotate + history two-pane) | Webview screen | B | Polish empty/loading; fixture exists |
| 7 | Rollback | `rollback` | Native `showWarningMessage` | Confirm toast | C | Dual-UX: Workspace has `RollbackConfirmDialog` |
| 8 | Add | `add` | Silent git | Side-effect | A | OK for Explorer |
| 9 | Unstage | `unstage` | Silent git | Side-effect | A | OK |
| 10 | Commit… | `commit` | Input / prompt commit message | Native prompt | C | Dual-UX: Workspace `CommitPanel` is richer |
| 11 | Commit and Push… | `commitAndPush` | Prompt + push | Native prompt | C | Same dual-UX |
| 12 | Fetch | `fetch` | Silent git | Side-effect | A | OK |
| 13 | Pull… | `pull` | Git pull (strategy limited) | Side-effect | B− | Workspace has strategy UI |
| 14 | Push… | `push` | Git push | Side-effect | B− | Workspace has `PushUpstreamDialog` |
| 15 | Sync | `sync` | Fetch + pull/push | Side-effect | B | Workspace has `SyncBranchConfirmDialog` |
| 16 | Branches… | `checkoutBranch` | QuickPick branch switch | QuickPick | C | Dual-UX: Workspace `BranchesPopup` |
| 17 | New Branch… | `createBranch` | InputBox | Native prompt | B | Dual-UX: BranchesPopup create |
| 18 | Stash Changes… | `stash` | Silent `stash push` | Side-effect | B | Enablement fixed mid-merge; no options UI |
| 19 | Unstash Changes… | `unstash` | `stash pop` | Side-effect | B | Enablement fixed |
| 20 | Shelve Changes… | `shelve` | Patch shelf util | Side-effect | B | Workspace Temporary tab richer |
| 21 | Unshelve Changes… | `unshelve` | Restore latest shelf | Side-effect | B | Same |
| 22 | Merge… | `merge` | QuickPick branch + merge | QuickPick | C | Dual-UX: `MergeBranchDialog` |
| 23 | Rebase… | `rebase` | QuickPick branch + rebase | QuickPick | C | Dual-UX: `RebaseOntoDialog` |

**Enablement keys (native):** `canCommit`, `canFetch`, `canPull`, `canPush`, `canSync`,
`canStash`, `canUnstash`, `canShelve`, `canUnshelve`, `canIntegrate` — mid-merge must
disable stash/shelve and surface clear errors.

### 3.2 History / Log secondary actions (not in Explorer submenu)

| Action | Destination | Grade |
| --- | --- | --- |
| Show Diff (revision) | `GitDiffApp` tab | C (shared Diff polish) |
| Compare with Local | Diff panel | C |
| Cherry-pick / Revert / Checkout revision | Confirm + git | B |
| Copy hash / message | Clipboard | A |
| Get from revision | Confirm + checkout file | B |
| Create branch from commit | Dialog (Workspace) / limited History | B |

### 3.3 Workspace-only surfaces (not Explorer menu)

Opened via **GitView: Open Git workspace** (`gitView.openGit`):

| Tab / chrome | Component | Grade | Update PR |
| --- | --- | --- | --- |
| Widget (branch / sync) | `GitWidget` | B | E |
| Changes | `WorkspaceChangesPanel` | B | E |
| Commit panel | `CommitPanel` | B | E |
| Log | `WorkspaceLogPanel` | B− | D — align with History Log layout |
| Blame | `WorkspaceBlamePanel` | B | C |
| Temporary Work | `WorkspaceTemporaryWorkPanel` | B | F |
| Review | `WorkspaceReviewPanel` | B | later polish |
| Branches popup | `BranchesPopup` | B | G parity copy only |
| Tags / Worktrees popups | `TagsPopup`, `WorktreesPopup` | B | G |
| Ops dialogs (reset, rewrite, push upstream, …) | `GitWorkspaceOpsDialogs` | B | G density |

### 3.4 Conflict / Merge surfaces

| Surface | Open path | Component | Grade | PR |
| --- | --- | --- | --- | --- |
| Conflicts list / dialog | Widget / merge boot | `ConflictsDialog`, `ConflictListScreen` | B | H |
| Merge Studio | Resolve conflict / open file | `MergeResolverScreen` | B | H |
| Conflict actions bar | Mid-merge | `ConflictActionsBar` | B | H |

---

## 4. Dual-UX policy (do not “fix” by forcing one path)

| Path | When | Interaction style |
| --- | --- | --- |
| **Explorer / Palette** | User never opened Git Workspace | Fast: QuickPick / InputBox / silent git / dedicated History·Diff·Blame panels |
| **Git Workspace** | User works inside GitView tool window | Rich: panels, popups, option dialogs, preview |

Rules:

1. Do **not** require Workspace for Explorer menu correctness.
2. Do **not** replace Workspace dialogs with QuickPicks.
3. Shared **screens** (History, Diff, Blame, Merge) must use the same density system.
4. Error copy for mid-merge / dirty / no-repo must match between paths (`formatGitCommandError`).

---

## 5. Product screens catalog (webview apps)

| App mode | Root | Primary user job | Fixture / visual |
| --- | --- | --- | --- |
| `merge` | `App` / MergeResolver | Resolve conflicts | previews `02-merge-boot` |
| `gitHistory` | `GitHistoryApp` | File/folder/repo log | `HistoryVisualFixture`, previews `04-*` |
| `gitDiff` | `GitDiffApp` | Compare revisions | `GitDiffVisualFixture` (`gitDiffVisual`) |
| `gitBlame` | `GitBlameApp` | Annotate + file history | `BlameVisualFixture`, previews `05-*` |
| `gitWorkspace` | `GitWorkspaceApp` | Full Git tool window | No full visual e2e yet |
| `gitMenu` | `GitMenuVisualFixture` | Menu density regression | e2e visual baseline |

Density rules for **all** of the above:

- Toolbar height `--nx-toolbar-h`, row `--nx-row-h`, UI font `--nx-font-size-ui`
- Empty states: `ToolEmptyState` (left-aligned), **not** centered marketing cards
- Context menus: `MenuItem` / section headers only

---

## 6. Critical UX defects found (audit)

### P0 — wrong interactive default

| ID | Issue | Expected | Location |
| --- | --- | --- | --- |
| H-01 | ~~History branch tree always visible~~ | Closed by default; open only via **Branches** | **Fixed PR-A** — layout respects `branchTreeOpen` |
| H-02 | Local/Remote sections open-by-default (partially fixed) | Sections **collapsed** when tree opens | `LogBranchTree` `defaultSectionsOpen=false` — keep |
| H-03 | ~~Missing `cn` import~~ | Compiles | **Fixed PR-A** |

### P1 — density / empty / static chrome

| ID | Issue | Expected | Location |
| --- | --- | --- | --- |
| D-01 | ~~Diff empty/loading centered hero~~ | Dense `ToolEmptyState` | **Fixed PR-B** |
| D-02 | ~~No Diff visual fixture~~ | `/?app=gitDiffVisual` | **Fixed PR-B** (`GitDiffVisualFixture`) |
| B-01 | ~~Blame empty loose~~ | ToolEmptyState + testIds | **Fixed PR-C** |
| W-01 | ~~Workspace tab bar loose~~ | Density tokens / compact tabs | **Fixed PR-E** |
| L-01 | ~~Workspace Log ≠ History layout~~ | commits \| files+details \| diff | **Fixed PR-D** |
| M-01 | Some menus still ad-hoc padding risk | All through `MenuItem` | Residual; Dropdowns OK |

### P2 — dual-UX gaps (document, don’t overbuild Explorer)

| ID | Issue | Policy |
| --- | --- | --- |
| X-01 | Explorer Commit is prompt-only | Keep; Workspace is full Commit panel |
| X-02 | Explorer Merge/Rebase QuickPick | Keep; optional later “Open in Workspace” link in message |
| X-03 | Stash no message/options from Explorer | Keep silent stash; rich Temporary tab in Workspace |

---

## 7. Target UX per screen (acceptance sketch)

### 7.1 Show History — Log

Reference (structure only): mature IDE VCS log tool window layout.

| Region | Default | Behavior |
| --- | --- | --- |
| Toolbar | Always | Search · **Branches** toggle · Branch filter · User · Paths · Refresh |
| Left branch tree | **Hidden** | Toggle opens; Local/Remote **collapsed** until expanded |
| Center | Commits + graph + ref chips | Select updates right |
| Right top | Changed files | Context menu → Diff tab |
| Right bottom | Commit details (`detailsOnly`) | No embedded editor stack by default |
| Diff | Off | Ctrl/menu “Show Diff” → Diff panel or optional preview |

File history: same layout; Paths shows file; no redundant second history UI.

### 7.2 Diff Viewer

- Title bar: file path + left/right labels (dense)
- Body: existing `GitHistoryDiffViewer` standalone
- Empty / error / timeout: `ToolEmptyState` top-left, one title + one hint

### 7.3 Annotate / Blame

- Code + gutter + commit side panel (existing)
- Annotate mode: commits | files (two-pane History embed)
- Empty/loading: dense, not hero

### 7.4 Git Workspace tabs

- Compact tab strip + widget
- Log tab aligned with History Log
- Changes + Commit dense
- Temporary Work: stash/shelf lists primary

### 7.5 Merge Studio / Conflicts

- Keep three-pane merge
- Compact conflict list rows
- Context menus via shared menu components

---

## 8. PR plan (implementation order)

```text
PR-A  foundations + History defaults
  └─► PR-B  Diff screen density + fixture
  └─► PR-C  Blame polish
  └─► PR-D  Workspace Log parity
  └─► PR-E  Changes + Commit density
  └─► PR-F  Temporary Work density
  └─► PR-G  Dialogs / popup density (Workspace)
  └─► PR-H  Merge + Conflicts density
```

### PR-A — Foundations + History sensible defaults

**Ship:**

1. This `screen-matrix.md` (living inventory).
2. History: when `!branchTreeOpen`, render **only** commits | files+details (no left pane).
3. Import `cn`; fixture `branchTreeOpen: false`.
4. Tests: toggle shows/hides tree; default closed on init.
5. Refresh History visual screenshot / preview if needed.

**Done when:** opening Show History does not show a branch tree until the user clicks Branches.

### PR-B — Diff screen

**Ship:**

1. `ToolEmptyState` for empty / error / timeout in `GitDiffApp`.
2. Optional `GitDiffVisualFixture` + preview under `docs/previews/`.
3. Toolbar density pass if still loose.

**Done when:** Diff empty state matches History/Blame density language.

### PR-C — Blame screen

**Ship:** empty/loading polish; ensure annotate two-pane defaults stay sensible (no branch tree noise in annotate).

### PR-D — Workspace Log parity

**Ship:** Log tab matches History Log region model (or embeds shared layout component). Branch tree same closed-by-default rule if present.

### PR-E — Changes + Commit

**Ship:** tree row height tokens, empty states, remove padding bloat on tab chrome and commit form.

### PR-F — Temporary Work

**Ship:** dense stash/shelf lists; clear empty; mid-merge disabled messaging consistent with Explorer.

### PR-G — Workspace dialogs / popups

**Ship:** shared dialog chrome spacing; no hero empty; MenuItem in branch row menus (already mostly done — audit only).

### PR-H — Merge + Conflicts

**Ship:** list density, toolbar density, empty conflict states, menu consistency.

---

## 9. Test matrix (per PR)

| Layer | What |
| --- | --- |
| Unit | Store defaults (`branchTreeOpen`), layout conditional, empty state components |
| Component | History toolbar toggle, Diff empty, Log panels |
| Integration | Menu actions still open correct panel (`gitMenuActions.*`) |
| E2E native | Show History / Diff / Blame still open; stash mid-merge disabled |
| Visual | `gitMenu` baseline; add History/Diff fixtures when stable |

Commands:

```bash
pnpm test
pnpm --filter gitview-webview test
pnpm run test:e2e:visual
# native when needed:
pnpm run test:e2e:native   # if script present
```

---

## 10. Explicit non-goals

- Pixel-clone of third-party IDEs or proprietary assets
- Re-skinning native VS Code context menu chrome
- Forcing all Explorer actions into Git Workspace dialogs in one PR
- Rewriting protocol / Git services unless a screen bug requires it

---

## 11. Implementation checklist (track in PRs)

- [x] **A1** History layout respects `branchTreeOpen`
- [x] **A2** Fixture + unit tests default closed
- [x] **A3** screen-matrix kept up to date when menus change
- [x] **B1** Diff `ToolEmptyState` + fixture
- [x] **C1** Blame empty density
- [x] **D1** Workspace Log align (commits | files+details | diff)
- [x] **E1** Changes/Commit/tab chrome
- [x] **F1** Temporary Work
- [x] **G1** Dialog density (`GitDialogShell` + migrations)
- [x] **H1** Merge/Conflicts density

---

## 12. Change log of this audit

| Date | Change |
| --- | --- |
| 2026-08-08 | Initial full menu→screen audit + PR-A–H plan |
| 2026-08-08 | Record History branch tree P0: store false but tree always mounted |
| 2026-08-08 | **PR-A:** layout hides branch tree unless `branchTreeOpen`; toggle + tests |
| 2026-08-08 | **PR-B:** Diff dense empty + `GitDiffVisualFixture` (`/?app=gitDiffVisual`) |
| 2026-08-08 | **PR-C–H:** Blame empty; Workspace Log parity; Changes/Commit/tabs; Temporary; `GitDialogShell`; Merge/Conflicts density |
)
