# UI density (IDE tool-window patterns)

GitView Git UI targets **IDE tool-window density**, not dashboard chrome.
Inspiration: mature desktop VCS tool windows (compact rows, dense menus).
This is **not** a pixel clone of any third-party product.

## Rules

| Do | Don't |
| --- | --- |
| Use density tokens (`--nx-row-h`, `--nx-toolbar-h`, `--nx-menu-item-h`) | Invent one-off `py-3` / `text-sm` on Git surfaces |
| VS Code theme CSS variables for color | Hardcoded Darcula / New UI palettes |
| Lucide icons at 14–16px | Third-party proprietary icons or screenshots |
| GitView / generic Git copy | Branded third-party menu labels |
| Sectioned context menus with disabled reasons | Flat lists of always-enabled dead actions |

## Tokens

Defined in `webview/src/styles/tokens.css`:

| Token | Default | Use |
| --- | --- | --- |
| `--nx-row-h` | 22px | Tree / commit list rows |
| `--nx-toolbar-h` | 28px | Toolbars |
| `--nx-menu-item-h` | 24px | Context menu rows |
| `--nx-font-size-ui` | 12px | UI chrome |
| `--nx-font-size-section` | 10px | Menu section labels |
| `--nx-menu-pad-x` | 10px | Menu horizontal padding |

## Git submenu

- **Native** Explorer `Git` menu: VS Code paints chrome; we own order, groups, enablement, titles.
- **Webview** mirror: `GitContextMenuItems` + `MenuItem` — full density control.
- Groups: History → Local → Commit → Remote → Branch & temporary work → Integrate.

## Menu inventory (all use `MenuItem` / `MenuSectionHeader` / `MenuDivider`)

| Surface | Component |
| --- | --- |
| Explorer Git (webview mirror) | `GitContextMenuItems` |
| Merge resolver block/gutter | `MergeContextMenu` |
| Conflicts dialog | `ConflictsContextMenuContent` |
| History commit / file | `GitHistoryCommitMenuItems`, `GitHistoryFileMenuItems` |
| Branches popup overflow | `branchesPopup/BranchRow` |
| Merge toolbar dropdowns | `layout/Toolbar` Dropdown |

Do **not** reintroduce ad-hoc `px-4 py-1.5 text-xs` menu rows.

## Dialogs

Prefer `GitDialogShell` + `gitDialogBtn*` for confirm/input modals (force checkout, delete branch, rename, …). Keep dense title (`--nx-font-size-ui`), body (`--nx-font-size-ui-sm`), button height (`--nx-row-h`).

## Visual regression

```bash
pnpm run test:e2e:visual          # compare
pnpm run test:e2e:visual:update   # refresh baselines after intentional UI changes
```

Fixtures:

| Route | Component |
| --- | --- |
| `/?app=gitMenu` | `GitMenuVisualFixture` |
| `/?app=gitHistoryVisual` | `HistoryVisualFixture` |
| `/?app=gitBlameVisual` | `BlameVisualFixture` |
| `/?app=gitDiffVisual` | `GitDiffVisualFixture` |

Full **menu → screen inventory** and update plan: [screen-matrix.md](./screen-matrix.md).

## Git History / Log layout

Reference layout (structure only — mature IDE VCS log tool window):

| Region | Content |
| --- | --- |
| Left | Branch tree (Local / Remote) |
| Center | Commit graph + message · **ref chips** · author · date |
| Right top | Changed files for selected commit |
| Right bottom | Commit details (subject, body, author, time) |
| Toolbar | Search · Branch · User · Paths · Refresh |
| Diff | Ctrl+D / Diff Viewer — not the default right pane |

Code: `data-layout="log"` — `LogBranchTree` + `GitCommitList` (graph) + files/details.
