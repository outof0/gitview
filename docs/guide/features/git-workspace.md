# Git Workspace

Desktop-IDE-style Git tool window in the activity bar.

## Open

- Activity bar → **GitView**
- Command Palette → **GitView: Open Git workspace**

## Panels (typical)

| Area | Purpose |
| --- | --- |
| Widget | Current branch, ahead/behind, fetch/pull/push/sync |
| Changes | Staging, changelists, rollback |
| Commit | Message, amend/sign-off options, commit checks |
| Branches | Checkout, create, compare, favorites |
| Log | Commit graph / list, rewrite actions (with protection) |
| Diff | File / hunk / line staging |
| Temporary work | Stash and shelf |
| Review | Hosted PR/MR (see [Hosted review](./hosted-review.md)) |
| Operation bar | Continue / Skip / Abort for in-progress merge/rebase/… |

## Multi-root

With multiple folders, repositories are listed separately. `synchronousBranchControl` can apply branch checkout across matching roots after confirmation.

## Safety

- Protected branch patterns block dangerous history actions (`protectedBranchPatterns`).
- `confirmDestructiveActions` gates discard / rewrite when enabled.

---

[← Merge resolver](./merge-resolver.md) · [Docs index](../../README.md) · [History & blame →](./history-and-blame.md)
