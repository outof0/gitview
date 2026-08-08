# Hosted review

GitView Review lists and manages **GitHub pull requests** and **GitLab merge requests** from the Git Workspace.

## Auth

Use Secret Storage (recommended):

| Command | Purpose |
| --- | --- |
| **GitView: Set GitHub Review Token…** | Store GitHub PAT |
| **GitView: Set GitLab Review Token…** | Store GitLab PAT |
| **GitView: Clear GitHub Review Token** | Remove stored token |
| **GitView: Clear GitLab Review Token** | Remove stored token |

Deprecated settings `gitView.githubReviewToken` / `gitlabReviewToken` still work as fallbacks and migrate into Secret Storage on first use.

## API bases

| Setting | Default |
| --- | --- |
| `gitView.githubApiBaseUrl` | `https://api.github.com` |
| `gitView.gitlabApiBaseUrl` | `https://gitlab.com/api/v4` |

Override for GitHub Enterprise or self-hosted GitLab.

## Capabilities

- List / filter PR·MR (author, labels, assignee, milestone where supported)
- Create PR/MR from current branch
- Line comments and suggestion apply (path-validated)
- Merge methods: merge, squash, rebase (provider-dependent)
- Timeline, close, checkout

## Privacy

Tokens never leave your machine except as `Authorization` headers to the configured API base. They are not sent to GitView product servers (there is no product telemetry).

---

[← History & blame](./history-and-blame.md) · [Docs index](../../README.md) · [Settings reference →](../../reference/settings.md)
