# History & blame

## Show History

Explorer or editor context menu → **Git** → **Show History**.

Opens a history surface with:

- Commit list / graph for the file or folder
- Branch filter
- Inline diff preview for selected commits

## Annotate with Git Blame

Explorer or editor context menu → **Git** → **Annotate with Git Blame** on a file (or the Annotate action in a compare diff tab).

Opens the file in the editor area with:

- Monaco-based editor with color-coded per-line authorship gutter
- Focus line positioning corresponding to the active editor cursor
- Coordinated with the Git bottom panel: concurrently opens the file history (`History · {file}`)
- Direct navigation: clicking a blame annotation in the editor selects and highlights that revision in the Git bottom panel log

## Diff & compare

| Command | Use |
| --- | --- |
| Show Diff | Working tree / index diff for the file |
| Compare with Revision… | Pick a commit or revision |
| Compare with Branch… | Pick a branch |

## Related settings

- `gitView.gitExecutablePath` — custom Git binary
- `gitView.confirmDestructiveActions` — for history rewrite from Log panel

---

[← Git Workspace](./git-workspace.md) · [Docs index](../../README.md) · [Hosted review →](./hosted-review.md)
