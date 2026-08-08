# Quality Standard

Status: **normative**. This document defines the minimum bar for every pull
request and public release. If another contributor document conflicts with this
one, this standard wins.

## What “10/10” means

Ten out of ten is an evidence state, not a permanent project label. GitView Diff
is at 10/10 only while all six quality dimensions below satisfy their evidence
requirements, every required CI job is green, and there are no active quality
exceptions.

Scores are not averaged. A release-blocking failure in one dimension means the
release is not 10/10 even when every other dimension is healthy.

| Dimension       | 10/10 evidence                                                                                                                           |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Architecture    | Architecture guard passes with zero active exceptions; dependency graph is acyclic; all layer and runtime boundaries hold.               |
| System design   | Real Git mutation, persistence, lifecycle, concurrency, and failure paths have integration coverage proportional to risk.                |
| Code quality    | Strict TypeScript, lint, unit tests, and coverage thresholds pass without weakening a gate in the same change.                           |
| Extensibility   | Public API and protocol changes are versioned, runtime-validated, documented, disposable, and represented in packaged declarations.      |
| Maintainability | One local quality command reproduces CI; decisions and temporary deviations are discoverable; no expired or stale exceptions exist.      |
| OSS readiness   | Build, bundle budget, package contract, extension-host integration, E2E, changelog, and release workflow all pass from a clean checkout. |

## Architecture invariants

The source tree has four architectural zones:

```text
composition roots       extension.ts, activation.ts, application context
interface adapters      commands/, webview/, webviewHost/
infrastructure          services/, storage/, config/, util/, observability/
foundation              core/, shared/, types/

browser frontend        webview/src/ -> browser packages + foundation only
```

Composition roots may wire implementations across zones. Dependencies in lower
zones must not point back to outer adapters. The browser frontend and extension
host communicate only through the validated protocol.

`pnpm run check:architecture` enforces these rules:

| Rule                       | Invariant                                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------------------- |
| `core/dependency`          | `core/` imports only itself and type-only contracts from `types/`.                                 |
| `core/determinism`         | `core/` does not read clocks or randomness; callers provide nondeterministic inputs.               |
| `foundation/dependency`    | `shared/` and `types/` depend only on foundation modules.                                          |
| `frontend/host-isolation`  | Browser code cannot import VS Code, Node built-ins, host services, storage, commands, or handlers. |
| `infrastructure/direction` | Infrastructure cannot depend on application/composition or interface adapters.                     |
| `runtime/process-boundary` | Production subprocess execution is centralized in `services/git/exec.ts`.                          |
| `graph/cycle`              | The production host and frontend dependency graph is acyclic, including type edges.                |
| `imports/unresolved`       | Every local production import resolves to a checked source module or explicit asset.               |
| `imports/test-code`        | Production modules never import test helpers or fixtures.                                          |
| `e2e/imports-unresolved`   | Every local E2E import resolves to source or to its generated-output source counterpart.           |

Do not bypass these boundaries with re-export barrels, dynamic imports, path
aliases, or inline lint suppression. The guard resolves all supported local
import forms before evaluating a dependency.

## Required gates

Use the narrowest command while iterating, then run the aggregate gate before a
pull request:

| Command                       | Required for                                             | Evidence                                                                                           |
| ----------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `pnpm run check:architecture` | Any source-boundary change                               | Layering, purity, cycles, process ownership, exceptions                                            |
| `pnpm run quality`            | Every pull request                                       | Architecture, documentation, types, lint, coverage, production build, bundle and package contracts |
| `pnpm run test:int`           | Host, Git, filesystem, lifecycle, or VS Code API changes | Real extension host and Git repository behavior                                                    |
| `pnpm run test:e2e`           | User workflow, command, protocol, or UI changes          | Native/webview workflow behavior                                                                   |
| `pnpm run quality:release`    | Local release candidate                                  | Aggregate quality, integration, E2E, and final VSIX                                                |

GitHub Actions runs quality, integration, and E2E as separate jobs for useful
failure isolation. A `v*` tag invokes that reusable workflow again; GitHub
Release creation waits for all jobs to pass.

## Risk-to-evidence matrix

Every behavior change needs evidence at the lowest layer that can prove the
behavior. Higher-risk changes also need end-to-end evidence.

| Change                           | Minimum evidence                                                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Pure algorithm/parser            | Unit tests for normal, boundary, malformed, and large inputs; benchmark when complexity can change.                                        |
| Git mutation                     | Real temporary repository test asserting worktree, index, refs, and failure rollback; extension-host test when VS Code state participates. |
| Storage or migration             | Round-trip, corruption, interrupted-write, linked-worktree, and backward-compatibility tests.                                              |
| Repository lifecycle/concurrency | Coalescing, cancellation/disposal, bounded concurrency, listener isolation, and partial-failure tests.                                     |
| Protocol request/event           | Public type, runtime validator, malformed-payload test, structured error, client handling, and protocol documentation.                     |
| Public extension API/provider    | API version decision, declarations, disposal/duplicate behavior, failure isolation, integration test, and reference documentation.         |
| Setting                          | Manifest/default contract test, typed reader, runtime propagation, UI behavior, and settings reference.                                    |
| UI workflow                      | Component/store test plus relevant Playwright workflow; accessibility and visual evidence when layout or interaction changes.              |
| Security boundary                | Negative tests for path trust, token redaction, untrusted workspaces, and sanitized user-facing errors.                                    |

Mock-only assertions are insufficient for destructive Git operations,
persistence guarantees, process failures, or concurrency behavior.

## API and compatibility policy

- Public extension API compatibility is keyed by `apiVersion`.
- Protocol compatibility is keyed by `PROTOCOL_VERSION` and runtime validators.
- Additive fields should be optional for consumers until all supported senders
  provide them.
- A breaking API or protocol change requires a new version, migration notes,
  tests for the old rejection path, and a changelog entry.
- Storage formats require explicit format versions and migration or safe
  fallback behavior. Silent reinterpretation of persisted data is forbidden.
- Provider and handler registrations must reject duplicate IDs and return an
  idempotent disposable.

Before 1.0, semantic versioning still applies to the exported extension API.
“Pre-release” is not permission to break integrations without documentation.

## Quality ratchet

Coverage thresholds, bundle budgets, package checks, architecture rules, and
test scope are ratchets. A pull request must not relax a gate merely to make its
own change pass.

A deliberate threshold or architecture-policy change requires:

1. Measured evidence showing why the old limit no longer represents quality.
2. An architecture rationale in the pull request or a durable design document.
3. Maintainer approval independent from the implementation author when the
   project has more than one active maintainer.
4. A follow-up target when the change accepts temporary quality debt.

## Time-bounded exceptions

Architectural exceptions live only in
`docs/maintainers/quality-exceptions.json`. Inline suppressions are not an
alternative.

Each exception must identify the exact rule and file, an owner, a meaningful
reason, creation date, and expiration date. Maximum lifetime is 90 days. The
architecture guard rejects malformed, expired, unmatched, duplicate, and stale
entries.

An active exception can keep CI operational for an approved migration, but it
caps the architecture and maintainability dimensions below 10/10. A public
release with an active exception requires an explicit maintainer decision in
the release notes.

Example (do not add unless a real violation exists):

```json
{
  "id": "remove-legacy-host-import",
  "rule": "frontend/host-isolation",
  "file": "webview/src/legacy.ts",
  "dependency": "src/services/legacy.ts",
  "owner": "maintainer-handle",
  "reason": "Temporary compatibility bridge while the protocol replacement ships.",
  "createdOn": "2026-08-08",
  "expiresOn": "2026-08-08"
}
```

## Blocking review policy

| Severity | Definition                                                                                                                    | Release policy                                                              |
| -------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Critical | Data loss, credential exposure, arbitrary execution, or repository corruption.                                                | Never release. Fix immediately and add regression coverage.                 |
| High     | Broken architecture boundary, public contract break, unsafe Git mutation, lifecycle leak, or common-path correctness failure. | Never release.                                                              |
| Medium   | Material maintainability, observability, performance, or uncommon-path reliability weakness.                                  | Fix before release or record a time-bounded, maintainer-approved exception. |
| Low      | Localized improvement with no meaningful correctness or evolution risk.                                                       | May follow up; must not be mislabeled as architecture debt.                 |

“Tests pass” does not override a Critical or High design finding. Conversely,
style preferences do not become blocking findings without a demonstrated
quality impact.

## Definition of done

A pull request is done when:

- its intended behavior and non-goals are clear;
- architecture and compatibility impact are declared;
- risk-proportional tests exist and fail without the change;
- `pnpm run quality` passes from a clean checkout;
- relevant integration/E2E suites pass;
- docs, changelog category, and public declarations are current;
- no new unowned or non-expiring debt is introduced.

A release candidate is 10/10 only when the reusable CI workflow passes on the
release tag and `quality-exceptions.json` is empty.
