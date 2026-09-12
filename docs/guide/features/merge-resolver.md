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
- **Magic Merge (✦) / Resolve simple conflicts** — combine safe,
  non-overlapping edits in the currently open file
- Auto-resolve byte-for-byte identical ours/theirs blocks
  (`autoResolveBothSame`)
- **Apply** — write result; optionally `git add` (`autoStageOnResolved`)

## Magic Merge

Magic Merge is a local, deterministic 3-way merge for the file currently open
in the resolver. For each unresolved conflict block, it compares base, Local,
and Repository text at word and character level. When the two sides changed
different spans, it combines both edits in Result.

For example:

```text
Base:       version: 1.0.0
Local:      version: 2.0.0
Repository: version: 1.0.4
Result:     version: 2.0.4
```

The action is conservative. It leaves a block unresolved when both sides edit
the same span, make competing insertions at the same position, combine a
deletion with an ambiguous edit, or otherwise lack one deterministic result.
Blocks already changed manually are left alone. Magic Merge uses no network
service and does not guess between competing versions.

Magic Merge only updates the editable Result and marks blocks it combined as
resolved. It does not write or stage the file. Review the merged text, make any
needed adjustments, resolve anything left over, and then select **Apply**.

## Settings

| Key | Default | Effect |
| --- | --- | --- |
| `gitView.mergeEngine` | `threeWay` | `threeWay` stages vs `markers` only |
| `gitView.autoResolveBothSame` | `true` | Auto-resolve identical sides; separate from Magic Merge |
| `gitView.autoStageOnResolved` | `true` | Stage after apply |
| `gitView.confirmBeforeMarkResolved` | `false` | Extra confirm before write |
| `gitView.foldUnchangedRegions` | `false` | Collapse long unchanged runs |
| `gitView.highlightingMode` | `lines` | `lines` · `words` · `none` |

Full list: [Settings](../../reference/settings.md).

## Keyboard

See [Keyboard shortcuts](../../reference/keyboard-shortcuts.md).

---

[← Features overview](./overview.md) · [Docs index](../../README.md) · [Git Workspace →](./git-workspace.md)
