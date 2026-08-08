# Getting started

## 1. Open a trusted Git workspace

GitView shells out to your local `git` and can modify the working tree. Use only **trusted** folders.

## 2. Open the Git Workspace

Command Palette:

```text
GitView: Open Git workspace
```

Or use the **GitView** activity-bar icon.

You get: widget (branch / sync), changes, commit, branches, log, diff, temporary work (stash/shelf), and hosted review (with token).

## 3. Resolve a merge conflict

1. Start or continue a merge that produces conflicts.
2. Explorer → right-click a conflicted file → **Git** → **Resolve conflict**.
3. In the merge studio: accept Local / Incoming / both, edit the Result pane, then **Apply**.

See [Merge resolver](./features/merge-resolver.md) for shortcuts and settings.

## 4. History, blame, and compare

From Explorer or editor context menu under **Git**:

- **Show History**
- **Annotate with Git Blame**
- **Show Diff** / **Compare with Revision…** / **Compare with Branch…**

## 5. Configure settings

Open Settings → search **GitView**. Full list: [Settings reference](../reference/settings.md).

Useful defaults:

| Setting | Default | Why |
| --- | --- | --- |
| `gitView.mergeEngine` | `threeWay` | Real Git stages |
| `gitView.autoStageOnResolved` | `true` | `git add` after Apply |
| `gitView.confirmDestructiveActions` | `true` | Confirm history rewrite / discard |

## 6. Hosted review (optional)

Command Palette:

- **GitView: Set GitHub Review Token…**
- **GitView: Set GitLab Review Token…**

Tokens go to VS Code Secret Storage. Details: [Hosted review](./features/hosted-review.md).

## Next

- [Features overview](./features/overview.md)
- [Commands](../reference/commands.md)

---

[← Introduction](./introduction.md) · [Docs index](../README.md) · [Features overview →](./features/overview.md)
