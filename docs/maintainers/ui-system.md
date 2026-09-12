# UI System Standard

Status: **normative**. This is the implementation and review contract for every
GitView webview. A screen-specific screenshot fix is incomplete unless it also
preserves the rules below.

## Architecture

GitView UI has four layers. Dependencies only point downward.

| Layer         | Owns                                                                                  | Must not own                              |
| ------------- | ------------------------------------------------------------------------------------- | ----------------------------------------- |
| Theme adapter | `styles/tokens.css`: maps VS Code theme values to GitView semantic tokens             | Component layout or one-off screen colors |
| Primitives    | `components/ui`: buttons, fields, menus, dialogs, scroll areas, resizing and feedback | Git or screen-specific behavior           |
| Patterns      | Toolbars, pane headers, lists, trees, commit rows and editor chrome                   | Raw controls or direct theme values       |
| Screens       | State, data loading and composition                                                   | A second styling language                 |

Production components consume semantic tokens or Tailwind aliases. They do not
read `--vscode-*` directly. This gives dark, light and high-contrast themes one
adapter instead of hundreds of local fallback chains.

The minimum primitive set is:

- `Button`, `TextField`, `SelectField`, `TextArea`, `Checkbox`;
- `MenuItem`, `ContextMenu`, `GitDialogShell`;
- `ScrollArea`, `ResizableSplit`, `ResizableColumns`;
- shared toolbar, pane-header, empty/loading/error and toast patterns.

If two screens need the same interaction, extend the primitive or pattern. Do
not copy its class string into the second screen.

## Cascade rules

`base.css` sets element resets — `button { border: none }` among them — outside
any Tailwind layer. Tailwind's own `* { border-style: solid }` reset is a
universal selector, which an element selector outranks, so **on a `<button>` a
`border-*` colour utility alone still computes to `border-style: none` and
collapses the width to 0.** The symptom is a control that carries `border` in
its class list and renders no border.

Rules that follow:

- A primitive that draws a border declares **width and style itself**
  (`border border-solid`); variants set only the *colour*. `Button` does this —
  see the `Button border contract` tests.
- Never paper over a missing border with `!important` or a new unlayered class.
  Fix it in the primitive that renders the element.
- The unlayered `.btn-vscode*` classes in `base.css` were an earlier workaround
  for this trap. Because they are unlayered they beat *every* utility, so
  `gitDialogBtnPrimary` rendered at 28px while the `h-row` (22px) written next
  to it had no effect. Do not add new unlayered component classes.
- Element resets belong in `@layer base` so utilities can win. Migrating the
  remaining unlayered resets is tracked debt, not a pattern to copy.

## Layout contracts

Every composed surface must satisfy these invariants at runtime:

1. Every pane has `min-width: 0` and `min-height: 0` at the flex/grid boundary.
2. A region has one explicit scroll owner. Use `ScrollArea`; nested rows and
   cells do not create their own scrollbar.
3. Horizontal scrolling is opt-in for content that is intrinsically horizontal
   (code, diff, timeline). Lists, forms, toolbars and commit metadata reflow,
   truncate or progressively disclose instead. A horizontally scrolling code
   region wraps its rows in one `min-w-max` element so every row shares the
   width of the widest line — row tints and pinned gutters then stay correct
   when the pane is scrolled right.
4. A visualization may size itself only from data that can be rendered. Missing
   or truncated Git parents cannot reserve graph lanes.
5. Primary content remains inside the viewport. Icons, badges and metadata may
   collapse before the subject, filename, input or action disappears.
6. Bottom-panel behavior is tested at 258px height; side panes at 320–640px
   width; editor tabs at 1024–1400px width. `vh` is never assumed to mean the
   full VS Code window.

## Test model

Three kinds of evidence are required because none is sufficient alone.

| Gate              | Proves                                                                           |
| ----------------- | -------------------------------------------------------------------------------- |
| Unit/component    | State, semantics, topology and boundary algorithms                               |
| UI contract E2E   | Bounding boxes, overflow ownership, visible primary content, focus and scrolling |
| Native screenshot | The packaged extension renders correctly in real VS Code and the active theme    |

Presence assertions such as “the commit list exists” are not layout coverage.
For a list or graph, assert the usable geometry: the visualization is bounded,
the primary label intersects the row viewport, and the intended scroll owner
can actually scroll when content exceeds it.

User-visible changes run this matrix in the relevant native specs:

| Dimension | Required values                                                     |
| --------- | ------------------------------------------------------------------- |
| Theme     | Dark, Light, High Contrast when color/chrome changes                |
| Width     | Narrow pane, normal pane, full editor                               |
| Height    | Bottom panel and full editor                                        |
| Data      | Empty, loading, error, normal, long labels, large/truncated history |
| Input     | Mouse, keyboard focus, disabled state                               |

Screenshots are review artifacts, not the oracle. Baselines are never refreshed
merely to make a test pass.

## Static ratchet

`pnpm run check:ui-system` inventories six sources of UI drift:

- raw interactive HTML outside `components/ui`;
- direct VS Code token access in components;
- component-local color literals;
- literal pixel utility classes;
- non-system radii;
- ad-hoc horizontal scroll owners.

The current debt is recorded in
`ui-system-baseline.json`. The gate fails both when debt increases and when debt
decreases without lowering the baseline. Therefore every cleanup permanently
ratchets the repository toward zero. Raising a baseline is a quality-policy
change and follows the approval rules in `quality-standard.md`.

The target for every category is zero. The baseline is not an allowlist or an
approved design.

## Migration order

Migration is by repeated interaction pattern, not by whichever screenshot was
reported most recently:

1. Controls and theme access: migrate raw controls, direct tokens and local
   colors to primitives and semantic tokens.
2. Chrome: one toolbar, pane header, menu and dialog language across all apps.
3. Layout: declare scroll owners, remove accidental horizontal overflow, add
   narrow-pane progressive disclosure.
4. Data-heavy views: enforce topology/virtualization/truncation invariants for
   log, blame, changes, review and conflict lists.
5. Native matrix: promote geometry contracts for all product screens into CI.

Each migration lowers `ui-system-baseline.json` in the same change and adds at
least one contract test for the pattern. Completing a single screen while the
same pattern remains duplicated elsewhere is not completion of that migration.
