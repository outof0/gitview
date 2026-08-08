# Merge resolver

True **3-way** conflict resolution from Git index stages (base / ours / theirs), not only marker text.

## Open

- Explorer / editor: **Git** → **Resolve conflict**
- Conflict list dialog → select file → **Merge…**
- Command: **Resolve conflict** (category Git)

## Layout

| Pane | Content |
| --- | --- |
| Local (left) | Ours (`:2:`) |
| Result (center) | Editable merge output |
| Repository (right) | Theirs (`:3:`) |
| Base (optional) | Base (`:1:`) when `showBasePanel` is on |

## Common actions

- Accept left / right side for a conflict block
- Accept both (order via `acceptBothOrder`)
- Auto-resolve when ours and theirs are identical (`autoResolveBothSame`)
- **Apply** — write result; optionally `git add` (`autoStageOnResolved`)

## Settings

| Key | Default | Effect |
| --- | --- | --- |
| `gitView.mergeEngine` | `threeWay` | `threeWay` stages vs `markers` only |
| `gitView.autoStageOnResolved` | `true` | Stage after apply |
| `gitView.confirmBeforeMarkResolved` | `false` | Extra confirm before write |
| `gitView.foldUnchangedRegions` | `false` | Collapse long unchanged runs |
| `gitView.highlightingMode` | `lines` | `lines` · `words` · `none` |

Full list: [Settings](../../reference/settings.md).

## Keyboard

See [Keyboard shortcuts](../../reference/keyboard-shortcuts.md).

---

[← Features overview](./overview.md) · [Docs index](../../README.md) · [Git Workspace →](./git-workspace.md)
