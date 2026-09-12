# Design System Audit — Webview UI

Normative implementation rules and the CI ratchet now live in
[UI System Standard](./ui-system.md). This document remains the measured audit
and migration history.

Status: **batches 1–2 and the safe parts of 3 implemented** (see
"Completed" below). Visual baselines were NOT refreshed: the committed
snapshots already fail in this environment on pristine HEAD (font noise,
0.01 ratio, proven via stash), so they cannot validate this work —
review the running extension instead.

## Completed

- Max-height report: root cause was an old installed build. `MENU_MAX_HEIGHT`
  clamping shipped in `949f469` (after the v0.1.0 tag); current code caps
  the branch filter menu and scrolls (verified on real VS Code:
  `maxHeight: 120px`, `overflowY: auto`, programmatic scroll works).
  Reinstall the freshly packaged vsix.
- Batch 1: dead tokens removed (`brand-ink/surface`, `titlebar-h`,
  `pad-y`); `borderRadius.vscode` points at `--nx-menu-radius`; new
  `--nx-font-size-title` (13px) and `--nx-font-size-micro` (9px) so every
  size has a token. Value-duplicate tokens (blues/greens/surfaces) and
  missing light/HC overrides deliberately left for a visual prototype —
  changing them alters rendering.
- Batch 2: typo'd `text-list-active-foreground` fixed; selected rows now
  always set a foreground; disabled opacity unified to 40; conflict-table
  rows are keyboard-operable; Tags/Worktrees gained empty states.
- Batch 3 (mechanical, canonical-wins): raw px sizes → tokens; `rounded-sm`,
  `rounded-[2px]`, `rounded-[3px]` → `rounded-vscode`; `vscode-*` raw vars →
  Tailwind aliases; `list-activeSelectionBackground` literals → `bg-list-active`;
  icon outliers normalized (17→16, dialog 13→14, inline 13→12); portal/filter
  menu rows → MenuItem metrics + focus rings; changelist items and popup
  section headers → `MenuItem`/`MenuSectionHeader`/`MenuDivider`; 6 legacy
  dialogs → `GitDialogShell` metrics + `gitDialogBtn*`; empty/loading/error
  states → `p-3`/`ui-sm`; icon-column/`hideIcon` left as-is (structural).
- Intentionally NOT changed (need visual prototype): row heights driven by
  content (FileRow 30px, two-line rows), `LogMenuPortal` vs `ContextMenu`
  merge, overlay token differences (`bg-black/40` vs translucent vs opaque),
  danger-language semantics, value-duplicate token colors.
- Scroll owners (2026-09-06): `ad-hoc-horizontal-scroll` ratcheted **28 → 0**.
  `ScrollArea` gained `axis="none"` so a region can declare "an inner pane owns
  scrolling" instead of leaving it implicit; `GitDialogShell` now renders
  through `ScrollArea` and carries geometry only in `SIZE_CLASSES`. 18 files
  migrated: `GitCommitDetail`, `CompareSplitView`, `WorkspaceDiffSplitView`,
  `WorkspaceDiffUnifiedView`, `GitHistoryDiffViewer`, `WorkspaceReviewList`,
  `WorkspaceReviewDetails`, `ChangelistBar`, `ChangesFromBranchPanel`,
  `GitChangedFilesTree`, `SyncBranchConfirmDialog`, `UpdateAllRootsDialog`,
  `WorkspaceTemporaryWorkPanel`, `ConflictsNavSidebar`, `ConflictListScreen`,
  `DevToolbar`, plus the two primitives. The per-line `overflow-x-auto` in
  `WorkspaceDiffCodeLines` was **removed**, not wrapped: each row used to own a
  horizontal scrollbar, which is exactly what rule 2 forbids. Diff panes now
  carry a `min-w-max` content wrapper — the convention `CompareSplitView`
  already used — so rows stretch to the widest line and tints stay correct
  while scrolling.
- Dialog buttons (2026-09-06): `raw-interactive` ratcheted **256 → 207**. All
  49 `<button className={gitDialogBtn*}>` call sites across 20 files are now
  `<Button variant="…" size="compact">`; the three `gitDialogBtn*` class
  constants are deleted. Making `Button` a drop-in exposed the root cause of
  section 4's mixed geometry: `base.css` resets `button { border: none }` with
  an **element selector**, which outranks Tailwind's universal
  `* { border-style: solid }` reset, so any `border-*` utility on a button
  collapsed to a computed 0. `Button` now declares `border border-solid`
  itself and variants set only the colour. The `.btn-vscode*` classes were an
  earlier workaround for the same trap; being unlayered they beat *every*
  utility, so `gitDialogBtnPrimary` rendered at 28px while the `h-row` (22px)
  written right beside it had no effect. That is why footers mixed a 28px
  primary/secondary with a 22px danger button. Footers are now uniformly
  22px, matching the danger button and the 22px `gitDialogInput` next to them.
  Verified against the shipped CSS with a computed-style probe: border
  width/style diffs are gone, and the remaining deltas (height 28→22, padding
  12→8, font-size 12→11, weight 500→400 on secondary) are exactly the
  properties `.btn-vscode*` was winning. `fontFamily` differs in the computed
  string only — "Inter Tight" is not loaded, so it falls through to the same
  family `body` resolves.

## Follow-up fixes (user-reported, verified on real VS Code)

- Branch filter menu overflow: root cause was the installed build predating
  `MENU_MAX_HEIGHT` clamping (`949f469`, after the v0.1.0 tag). Current code
  caps and scrolls correctly — reinstall the packaged vsix.
- Create Branch horizontal scrollbar: root cause was global `content-box`
  sizing (preflight disabled, no reset) — every `w-full` + padded input
  overflowed. Fixed with unlayered `border-box` in `styles/base.css` and
  verified zero overflowing elements on the real dialog.
- Native checkboxes replaced with a shared `ui/Checkbox` primitive
  (Branches popup + Create Branch dialog); Branches card now sizes to
  content instead of a fixed 520px; Tags/Worktrees headers and inputs
  aligned to the same popup chrome.

## Verdict

The webview has a token layer (`styles/tokens.css` + `tailwind.config.js`)
with real adoption, but three parallel styling languages grew around it.
Same job, different treatment, in five areas: **radius** (5 variants),
**type size** (tokens exist, raw px dominates), **row height** (22px token vs
`h-7` sprawl), **menus** (2 systems), **dialogs/buttons** (2 shells, ~14
button variants). Plus a handful of outright bugs (unreadable selected
text, a typo'd token, keyboard-unreachable rows).

## 1. Tokens: two systems, partial adoption

- `--nx-*` aliases exist for surfaces, borders, text, rows, menus, type —
  but Tailwind maps none of them; they are reachable only via arbitrary
  `bg-[var(--nx-…)]` syntax. Direct `var(--vscode-*)` references bypass the
  aliases (`descriptionForeground` 89 hits, `input-background` 56, …), and
  inline fallbacks re-hardcode token values (`text-[var(--nx-muted,#9B9CA3)]`),
  defeating single-source updates.
- Type tokens (`--nx-font-size-ui/sm/section` = 12/11/10px) have 115 correct
  usages — and 293 raw `text-[11px]/[12px]/[10px]/[13px]` bypasses.
- Row tokens: `--nx-row-h` (22px, 58 hits) vs `h-7` (92) / `h-6` (31);
  `--nx-menu-item-h` (24px) has 2 hits; `--nx-titlebar-h`, `--nx-pad-y`,
  `--nx-section-gap` are effectively unused.
- Dead/duplicated tokens: `--gitview-brand-ink/surface` unused;
  three near-identical dark surfaces (`--nx-bg #18181b`, `--background`
  `#1e1e1e`, `--nx-panel #202126`); three blues (`--nx-blue`, `--ring`,
  `--nx-active-block` mix); three "added" greens; `--nx-word-added` mixes
  at 45% while siblings use 50%; graph/semantic tokens have no light/HC
  overrides; `--nx-word-added`, `--nx-active-block`, `--nx-deleted-soft`
  have no high-contrast override.
- Icons: effective convention is 14 = buttons, 12 = dense/tree, 16 =
  headers, 10 = check glyphs. Outliers: 13px (`CommitPanel`, log panel),
  11px (3 sites), 17px (`EditorPaneIcons.tsx:13`, sibling uses 16).

## 2. Radius: five languages

`rounded-vscode` (154, = 2px) is the majority; then bare `rounded` (55),
`rounded-sm` (29, Tailwind default ≠ token), `rounded-[2px]` (26, duplicates
the token literally), `rounded-[var(--nx-menu-radius)]` (14, correct),
`rounded-[3px]` (6, `GitWidget`/`CommitPanel`), `rounded-full` (3).
`borderRadius.vscode` in `tailwind.config.js` hardcodes `2px` instead of
pointing at `--nx-menu-radius` — drift risk by construction.

## 3. Two menu systems

- `ContextMenu` + `MenuItem` (+ `MenuSectionHeader`, `MenuDivider`): token
  hover `menu-selection`, focus ring, `disabledReason` tooltips. Used by all
  `*MenuItems` surfaces.
- `LogMenuPortal` family (log filters/sort/view/settings): `rounded-sm`,
  `p-1.5 + gap-1`, arbitrary `vscode-menu-selectionBackground` hover chain,
  `role=dialog`, no `disabledReason`, no checkbox variant parity. Plus
  custom rows in `ToolbarDropdown`, `WorkspaceLogFilters itemCls`, and the
  changelist picker (`hover:bg-list-hover` on a menu surface — wrong token).
- `BranchRow` kebab hand-rolls the `ContextMenu` shell (inline radius ×3
  across the repo instead of a shared class).
- Menu icon column: three behaviors (always icons / `hideIcon` /
  empty reserved column).

## 4. Two dialog shells + ~14 button variants

- `GitDialogShell` (`p-3`, `editorWidget-background`, 400/520/1000px,
  `ui/ui-sm` type, focus trap, Cancel-first footers) vs legacy hand-rolled
  (`p-4`, `editor-background`, 420/480px, `13px/12px`, `h-7 px-3` buttons):
  Sync, PushUpstream, EditCommitMessage, CommitCheckWarning, UpdateAllRoots,
  DeleteReviewSourceBranch. Same `bg-black/40` overlay, so they look like
  one system with different metrics.
- `BranchesPopup` (own translucent overlay, taller card, no footer),
  `ConflictsDialog` (own grid shell, centered title, `justify-between`
  footer — the only one), `GitPanelChrome` (large modal chrome).
- Buttons: filled primary / secondary / danger are canonical
  (`.btn-vscode*`, `gitDialogBtn*`), but popups/rows/toolbars repeat
  `h-7 px-2 text-[11px] bordered` and `rounded-[3px]` pills; `GitWidget`
  even has a no-op self-hover. Footer order is consistently
  Cancel → primary/danger everywhere (good — no change needed).
- Destructive language splits: typed-danger (Reset/ForceCheckout/Drop) vs
  primary-blue confirms for history/remote mutations (Sync, PushUpstream,
  "Commit anyway"). Inputs: `h-row` (shell) vs `h-8` (typed-confirm) vs
  `h-7` (legacy/popup) vs `h-[22px]` (history micro).

## 5. Selection, current-state, hover: no single language

- Selected: (a) `bg-list-active + activeForeground`, (b) explicit
  `bg-[list-activeSelectionBackground]`, (c) inactiveSelection + left
  focusBorder (Changes panel, shifts content 2px), (d) BranchRow current =
  disabled button with no background.
- **Bugs:** `LogBranchTree.tsx:71` uses typo'd `text-list-active-foreground`
  (resolves to nothing); `WorkspaceBranchComparePanel.tsx:84` and
  `WorkspaceReviewList.tsx:29` set `bg-list-active` with no foreground
  (unreadable selected text on dark themes).
- Current-branch: suffix label (BranchRow, LogBranchTree) vs bold + `*`
  (commit rows) vs ref badges (graph mode).
- Hover: `menu-selection` (true menus), `list-hover` (lists + most buttons),
  `toolbar-hover` (icon buttons) — plus the LogMenuPortal arbitrary chain.
  Same verb, different surface: row-level Checkout (`list-hover`) vs
  kebab-menu Checkout (`menu-selection`).
- Disabled opacity: `40` vs `50` in different files. Focus: only `MenuItem`
  has an explicit ring; `ConflictsFileTable` rows and Changes `FileRow`
  wrappers are clickable `<div>`s with no role/tabIndex — unreachable by
  keyboard. `SearchPanel` suppresses focus outlines.

## 6. Empty / loading / error: five paddings, gaps

- Loading: two sizes (`py-1.5 ui-sm` vs `p-3 12px`); Stash/shelf/compare
  lists have none.
- Empty: five padding/size combos; Tags/Worktrees popups render nothing
  when empty; only Changes panel has a rich empty state.
- Error: four red-text variants; only the log panel has icon + Retry.
  Only `CrlfBanner` uses `aria-live`.

## Proposed unification (prototype scope, not authorized work)

Batch 1 — tokens (no visual change possible, pure refactor):
alias `--nx-*` into `tailwind.config.js`, delete dead tokens, fix the
`45%`/`blues`/`greens`/`surfaces` duplicates, add missing light/HC
overrides, point `borderRadius.vscode` at `--nx-menu-radius`.
Batch 2 — bugs (safe fixes): typo token, selected foregrounds, disabled
opacity, div-row keyboard access, focus-outline suppressions.
Batch 3 — prototypes (needs a chosen direction): one menu system, one
dialog shell, one button scale, one row scale, one selected/current
language, one empty/loading/error pattern.

Suggested prototype order: menus → dialogs/buttons → rows → states,
because menus and dialogs are where users currently see the seams
(Branches popup vs native menus was the original report).
