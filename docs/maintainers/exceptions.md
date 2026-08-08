# Product Exception Registry

Record **active** product exceptions here before shipping: required behavior from the
experience spec that cannot be implemented exactly.

Statuses: `Proposed` · `Accepted` · `Rejected` · `Resolved`.

---

## Active

None.

## Resolved (historical)

| ID | Topic | Resolved |
| --- | --- | --- |
| PE-2026-001 | Review line comment authoring | 2026-08-08 |
| PE-2026-002 | Create PR/MR from IDE | 2026-08-08 |
| PE-2026-003 | GitLab merge method `rebase` (API) | 2026-08-08 |
| PE-2026-004 | Review filters (assignee, milestone) | 2026-08-08 |
| PE-2026-005 | GitLab rebase merge method in UI | 2026-08-08 |

Implementation lives under GitView Review (`review.*` protocol, GitHub/GitLab providers,
`WorkspaceReviewPanel`). See coverage matrix for tests.

## Copy ownership

UI copy and docs are GitView-owned. Automated guard:

```bash
pnpm --filter gitview-webview exec vitest run src/__tests__/copyOwnership.test.ts
```

Do not ship third-party proprietary help text, trademarked IDE workflow names, or vendor
assets in webview Git UI.
