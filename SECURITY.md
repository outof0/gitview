# Security Policy

## Supported versions

GitView is pre-1.0. Security fixes land on the latest released minor version
only. Please upgrade before reporting an issue against an older build.

| Version | Supported |
| ------- | --------- |
| 0.1.x   | Yes       |
| < 0.1   | No        |

## Reporting a vulnerability

**Do not open a public issue for a security vulnerability.**

Report privately via [GitHub Security Advisories](https://github.com/gitview/gitview/security/advisories/new).
If that is unavailable to you, open a regular issue that contains only the words
"security report — please provide a private contact" and no technical detail; a
maintainer will follow up with a private channel.

Please include, where you can:

- the extension version, VS Code version and operating system
- a minimal reproduction (a repository shape or sequence of actions)
- the impact you believe is achievable

You can expect an acknowledgement within 7 days and a status update at least
every 14 days until the report is resolved. We will credit you in the advisory
unless you ask us not to.

## Scope

GitView runs inside the editor, executes the local `git` binary, reads and
writes files in the open workspace, and talks to code-review APIs. Findings in
these areas are in scope:

- **Command execution** — any input that reaches the Git subprocess in a way
  that changes which program runs or injects additional arguments. All Git
  invocations funnel through `src/services/git/exec.ts` using `execFile` with an
  argument array and no shell.
- **Path traversal** — any webview message that causes a read or write outside
  the repository root. Inbound paths are checked by
  `src/webviewHost/validatePaths.ts`.
- **Protocol trust boundary** — messages from the webview that bypass the
  runtime validators in `src/shared/protocol/requestValidation.ts`.
- **Credential handling** — exposure of review tokens held in VS Code Secret
  Storage, or leakage of tokens into logs, telemetry or error messages.
- **Workspace trust** — mutations that succeed while the workspace is untrusted.

### Out of scope

- Git itself, VS Code itself, or third-party dependencies (report upstream).
- Destructive Git operations the user explicitly confirmed.
- Findings that require the attacker to already have local code execution as the
  user, or to have write access to the user's `.git` directory.
- The deprecated plaintext `githubReviewToken` / `gitlabReviewToken` settings.
  These are documented as insecure fallbacks and migrate to Secret Storage on
  use; see [docs/guide/security.md](docs/guide/security.md).

## Hardening notes for contributors

Two invariants are enforced automatically by `pnpm run check:architecture` and
must not be worked around:

- Only `src/services/git/exec.ts` may import `child_process`.
- Git's human-readable output is interpreted only in
  `src/shared/errors/classifyGitError.ts`, which is paired with the C-locale pin
  in `exec.ts`. Matching Git diagnostics inline is a build failure.
