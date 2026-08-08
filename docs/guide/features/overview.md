# Features overview

| Feature | Entry points |
| --- | --- |
| [Merge resolver](./merge-resolver.md) | Git submenu → Resolve conflict; conflict list |
| [Git Workspace](./git-workspace.md) | Activity bar **GitView**; command **Open Git workspace** |
| [History & blame](./history-and-blame.md) | Show History, Annotate, Show Diff, Compare… |
| [Hosted review](./hosted-review.md) | Review panel in Git Workspace (token required) |

## Design principles

1. **Git is source of truth** — CLI operations, not a parallel SCM model.
2. **Visible before destructive** — confirmations for rewrite/discard when enabled.
3. **Keyboard-first merge** — navigate and accept sides without leaving the editor.
4. **Theme-aware UI** — VS Code CSS variables; light, dark, high contrast.

## Related reference

- [Settings](../../reference/settings.md)
- [Commands](../../reference/commands.md)
- [Keyboard shortcuts](../../reference/keyboard-shortcuts.md)

---

[← Getting started](../getting-started.md) · [Docs index](../../README.md) · [Merge resolver →](./merge-resolver.md)
