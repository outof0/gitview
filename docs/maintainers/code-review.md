# Code Review Standard

Status: **normative**, complementary to
[the quality standard](./quality-standard.md).

The quality standard defines **what must be true** of a change: architecture
invariants, risk-to-evidence pairing, severity policy, ratchets. This document
defines **how a human checks it**: who reviews, in what order, with which
questions, and within what budget.

If the two documents conflict, the quality standard wins on _substance_; this
document wins on _process_.

---

## 1. Why this exists

Automated gates answer a narrow question: _does this change violate a rule we
already encoded?_ They cannot answer the questions that actually cost this
project money:

- Does the change do what the author thinks it does?
- Is the pattern consistent with the eight other places that already solve this?
- Did an AI agent produce something plausible, type-clean, and wrong?

GitView is currently maintained by one person, so "review" cannot mean "a second
human reads it". This document makes review a **repeatable procedure that works
solo**, and degrades gracefully to a multi-maintainer project without rewrite.

---

## 2. Roles

| Role            | Who                                                | Duty                                                                                   |
| --------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Author          | Anyone opening the PR                              | Self-review _before_ requesting review; declare risk, zone, and AI assistance honestly |
| Reviewer        | Any maintainer **other than** the author           | Apply the passes in §4; every finding carries a severity prefix (§5)                   |
| Owner           | CODEOWNER of a touched zone (`.github/CODEOWNERS`) | Approve the zone they own; owns the escaped-defect loop (§9)                           |
| Release captain | Whoever runs `pnpm release`                        | Verify no unresolved `blocking:` finding and no active architecture exception          |

**The author is never the sole reviewer of a High- or Critical-risk change.**
In solo mode this is satisfied by §7 (cold review + time delay), not by skipping
it.

---

## 3. Review budget

Review quality collapses with diff size faster than reviewer skill rises.

| Changed LOC (excl. lockfiles, generated, snapshots) | Rule                                                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| ≤ 200                                               | Standard review. One pass of §4.                                                                              |
| 201–600                                             | Two passes (§4 Pass 0–2, then Pass 3–5 in a second sitting). Author must justify the size in the PR body.     |
| > 600                                               | **Split it.** Mechanical refactors, generated output, and snapshot updates are exempt; say so in the PR body. |

Reviewer time cap: **60 minutes per sitting**. After that, stop and say
"I need this split" rather than skimming. A skimmed 600-line review is worse
than no review, because it converts unknown risk into false confidence.

Get the numbers mechanically before starting:

```bash
pnpm run review:scope
```

It prints changed files, LOC, the zones touched, the gates owed for those
zones, the checklist sections that apply, and a set of pattern flags (§8).

---

## 4. The review passes

Read the diff **in this order**, not in file order. Reviewers who read
top-to-bottom spend their whole budget on naming and never reach the
correctness question.

### Pass 0 — Intent (2 minutes)

Read the PR description _before_ the diff.

- Is the intended behavior and the non-goal clear in under 30 seconds?
- Does the summary describe an outcome, or just list files?

If intent is unclear: **stop.** Request a rewrite and do not review the diff.
Reviewing a change whose purpose you guessed produces comments about the wrong
thing, and the author fixes comments instead of the design.

### Pass 1 — Contracts and blast radius

What the change exposes to the outside world. Breaking these is expensive to
reverse.

- `package.json` manifest: new commands, settings, menus, activation events.
- `src/publicApi.ts` and `apiVersion`.
- Protocol: `src/shared/protocol/**`, `PROTOCOL_VERSION`, runtime validators.
- Persisted formats: version field present, migration or safe fallback.
- Does anything additive stay optional for older senders?

### Pass 2 — Correctness and failure paths

- Happy path, boundary, malformed input, and large input.
- For Git mutations: **what happens if the command fails halfway?** Is there
  rollback or a safe intermediate state? Data-loss bugs in this project
  (shelf, drop-selected, branch apply — commit `949f469`) came from exactly
  this gap.
- Concurrency: coalescing, cancellation, disposal, bounded parallelism.
- Error surface: is the user-facing message sanitized and non-leaky?

### Pass 3 — Architecture and layering

Verify against
[the invariants](../maintainers/quality-standard.md#architecture-invariants)
and `AGENTS.md`, not against your taste:

- `core/` pure: no `vscode`, no `fs`, no `child_process`, no `Date.now()`, no
  randomness.
- Webview imports nothing from the host except `core/`, `shared/`, `types/`.
- Git subprocesses only through `src/services/git/exec.ts`.
- No new entry in `quality-exceptions.json` without owner, reason, and expiry.
- No new lint suppression, no re-export barrel used to dodge a boundary.

### Pass 4 — Evidence

- Do the tests **fail without the production change**? If you cannot tell from
  reading, say so. This is the single most-faked property in AI-authored tests.
- Risk-to-evidence: is the evidence at the lowest layer that can prove it?
  Mock-only assertions are insufficient for destructive Git operations,
  persistence, process failure, and concurrency.
- If the diff edits a threshold, budget, or the architecture guard, it is
  weakening a ratchet — see §8.

### Pass 5 — Consistency and clarity (last, lowest priority)

- Does this duplicate a pattern that already exists elsewhere? If so, why is
  the new copy different?
- Dead code, unused exports, naming.

**Do not open a review at Pass 5.** Naming feedback on a change with an
unresolved correctness question tells the author the design is fine.

---

## 5. Severity taxonomy

Every comment carries a prefix. A comment with no prefix defaults to
`consider:`.

| Prefix      | Maps to         | Meaning                                                                                                                                                           |
| ----------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `blocking:` | Critical / High | Must be fixed before merge. Data loss, credential exposure, broken boundary, public contract break, unsafe Git mutation, lifecycle leak, common-path correctness. |
| `consider:` | Medium          | Should be fixed; author may defer with a written reason and a follow-up issue.                                                                                    |
| `nit:`      | Low             | Take it or leave it. Never block.                                                                                                                                 |
| `question:` | any             | You do not understand. Ask instead of guessing — a `question:` that reveals a real problem becomes `blocking:` on the author's answer.                            |

Rules:

- Style a linter can catch is not a review comment. Fix the linter instead.
- "Can you add a test?" is not a finding until you name the behavior that is
  unproven.
- Say what is good when it is genuinely good. A review that is purely
  corrective teaches the author to hide work, not to improve it.

---

## 6. Zone checklists

`pnpm run review:scope` prints which of these apply to the diff. Skim the rest.

### A — Core algorithms (`src/core/**`)

- No clock, no randomness, no I/O. Nondeterministic input is injected.
- Boundary inputs: empty, single element, duplicate, very large.
- Complexity changed? `pnpm run bench:lcs` or the wall-clock guard in
  `src/core/__tests__/lcs.perf.test.ts`.

### B — Git mutation and infrastructure (`src/services/**`, `src/storage/**`, `src/config/**`, `src/util/**`, `src/observability/**`)

- Destructive? Confirmation path exists and is not bypassable by a caller.
- Partial-failure behavior proven against a **real** temporary repository, not
  a mocked executor.
- Error messages do not leak absolute paths or tokens.
- `src/util/**` is not a leaf today; new leaf helpers belong in
  `src/shared/lib/`.

### C — Protocol (`src/shared/protocol/**`, `webview/src/protocol/**`)

- Both directions validated: request payload and event payload.
- `protocolVersion`, `requestId`, `type` handled; malformed payload rejected,
  not thrown into `postMessage`.
- Additive fields optional until all senders provide them.
- `docs/reference/protocol.md` updated.
- Host has a timeout or the client has a safety net for a request that never
  settles.

### D — Webview UI (`webview/src/**`)

- **Standalone app?** Every app mounted outside `GitWorkspaceApp` must register
  its own `window.addEventListener("message", …)` calling
  `client.handleHostMessage(event.data)`. `GitWorkspaceApp` gets this through
  `useGitWorkspaceHostSubscription`; anything else must do it by hand. A
  missing listener does not error — the promise never settles and the panel
  spins on "Loading…" forever. Reference pattern: `GitDiffApp.tsx:228-238`.
- **Handshake failure path.** Every `client.ready(...)` needs a `.catch`, and
  it must not be `.catch(() => {})`. The host pushes a surface's data only
  *after* it answers this handshake — `gitWorkspacePanel.ts`,
  `gitViewPresentation.ts`, `GitViewPanel.ts` — so a rejected handshake means
  the panel never receives anything and sits on its loading state with an empty
  screen. Two legal resolutions:
  - the handshake **gates rendering** → surface the error
    (`GitCreateBranchApp`, `GitHistoryApp`);
  - a load timeout already covers the user → log it
    (`warnHandshakeFailure` in `GitDiffApp`, `GitBlameApp`).

  Never leave it bare: `void client.ready("merge")` is an unhandled rejection
  *and* a blank panel.
- Any request that can hang has a timeout, and the UI has an error state.
  A spinner with no failure branch is a bug, not a loading state.
- Handlers passed to a memoized component are wrapped in `useCallback`; no
  store getter is called inline in JSX (`files={visibleFiles()}`) — hoist to
  `useMemo`. Only bites where the consumer is memoized: check before
  "fixing".
- No `vscode` or Node builtin import.
- User-facing copy is GitView-owned; `pnpm run check:brand`.

### E — Commands and native menus (`src/commands/**`)

Opening a panel dialog is six steps and fails silently if any is missed:

1. dialog id in `GIT_PANEL_DIALOGS` (`src/shared/protocol/hostToWebview.ts`)
2. `presentation?.openPanelDialog({ dialog })` **before** any `showInputBox`
   fallback, and after resolving the repo root
3. `gitView.gitMenuPresentation` passed at the `src/extension.ts` registration
4. `presentation` threaded through `gitMenuActionDispatcher.ts`
5. store slice across `gitWorkspaceStoreTypes.ts`,
   `gitWorkspaceStoreSlice.ts`, `gitWorkspaceStore.ts`
6. host event mapped in `useGitWorkspaceHostSubscription.ts`, component
   rendered from `GitWorkspaceDialogs.tsx`

`webview/src/apps/__tests__/GitWorkspaceApp.openDialog.test.tsx` fails on
step 1 without steps 5–6. Keep it that way.

### F — Host handlers (`src/webviewHost/handlers/**`)

- Request is validated before use; failure returns a structured error.
- Idempotent and disposable; duplicate registration rejected.
- Long-running work is cancellable on panel disposal.

### G — Tests

- Would it fail if the production change were reverted?
- Does the mock preserve the unit's shape? A `memo` component must be mocked
  as `memo` or the test proves nothing about memoization.
- No hardcoded commit counts from a fixture repo — `createTempGitRepo()` seeds
  an "Initial commit"; compare `rev-list --count` before and after instead.

### H — CI, scripts, packaging

- Workflow changes: pinned action SHAs, least-privilege `permissions`.
- New gate wired into `pnpm run quality` **and** the CI job, or it does not
  exist.
- Not every script in `scripts/` is a gate. `check-brand.mjs` is an offline
  naming tool — it resolves candidate product names against domain and handle
  registries over the network. It is deliberately absent from `quality` and CI:
  a network-dependent brainstorm would make the gate flaky. Do not "fix" that by
  wiring it in. The brand check that *is* a gate runs with the unit suite
  (`webview/src/__tests__/copyOwnership.test.ts`).
- `check:package` and `check:bundle` still pass; budgets are a ratchet.
- Suppression comments must match the linter in use. This repo runs **oxlint**,
  so `// eslint-disable-next-line` is dead text that looks like a decision.
  Either use `oxlint-disable-next-line` or write the rationale as a plain
  comment — the latter is better, because the reason survives the tooling.

### I — Docs

- `pnpm run check:docs` passes; new pages linked from `docs/README.md`.
- User-facing change documented in `docs/guide/**` and `CHANGELOG.md` category.

---

## 7. Solo-maintainer mode

One maintainer, no second pair of eyes. This is the part that makes the rest of
this document real rather than aspirational.

**Cold-review protocol**, for any change classified Medium risk or above:

1. **Time delay.** Do not review within 30 minutes of writing. Overnight is
   better. The author's memory of intent is the single biggest obstacle to
   finding your own bug.
2. **Different surface.** Review from the GitHub diff view or
   `git diff origin/main...HEAD`, never from your editor with the code you just
   typed still on screen.
3. **Different order.** Run §4 mechanically and in sequence. Do not skip to
   Pass 5.
4. **Adversarial five.** Answer in writing, in the PR:
   - What is the worst thing this does if it is wrong?
   - Which input have I not tried?
   - What does this do when the host/webview never replies?
   - Does this fail loudly or silently?
   - What did I assume rather than verify?
5. **Automated second opinion.** `pnpm run review:scope` (§3, §8), then the
   narrow inner loop, then `pnpm run quality`.

**Two-sitting rule.** High- and Critical-risk changes get two review sittings
separated by sleep. If you cannot afford that, the change is too big — split
it.

**Get an outside reviewer quarterly.** In an OSS project the cheapest path is
reciprocal: review someone else's PR and ask for one back. It does not have to
be this repo.

---

## 8. Pattern flags

`pnpm run review:scope` scans the diff for these automatically. Each one is a
class of defect that has already cost this project time.

| Flag                                                                                 | Severity | Why                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Empty or discarding `catch` (`.catch(() => {})`, `catch {}`)                         | 🔴       | Silent failure. A swallowed rejection is how the shelf data-loss bug survived to release. The extension host no longer installs a global `unhandledRejection` swallower — a local one is worse. |
| `as any`, `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `oxlint-disable`       | 🟡       | Suppression instead of a fix. Needs a reason in the PR.                                                                                                                                         |
| `Date.now()`, `Math.random()`, `new Date()` under `src/core/`                        | 🔴       | Breaks `core/determinism`.                                                                                                                                                                      |
| New or edited file matching `webview/src/apps/*App.tsx` without a `message` listener | 🔴       | Panel hangs forever (checklist D).                                                                                                                                                              |
| `client.ready(...)` with no `.catch`, or with a swallowing one                       | 🔴       | The host pushes data only after the handshake, so the panel stays blank and the rejection is unhandled. Checked per **file**, not per added line (checklist D).                                |
| Diff edits a coverage threshold, bundle budget, or `scripts/check-architecture.mjs`  | 🔴       | Ratchet weakening. Requires the four conditions in the quality standard.                                                                                                                        |
| Diff edits `docs/maintainers/quality-exceptions.json`                                | 🔴       | Needs owner, reason, expiry ≤ 90 days.                                                                                                                                                          |
| Diff edits `src/services/git/exec.ts`                                                | 🔴       | Process boundary; every caller is affected.                                                                                                                                                     |
| Diff edits `package.json`                                                            | 🟡       | Manifest is the extension's public contract; confirm `check:package`.                                                                                                                           |

### Exempting a line

Sometimes swallowing really is correct — a `finally` block that cleans up a
temp directory must not replace the original error with a filesystem error. The
escape hatch is an inline marker **with a reason**, on the offending line:

```ts
await fs.rm(dir, { recursive: true, force: true }).catch(() => {}); // review-scope:allow silent-catch — see the doc comment
```

A bare `review-scope:allow` with no reason is not an exemption and still gets
flagged. This is the same bargain as `quality-exceptions.json`: nothing is
silenced without a written justification that the next reviewer can read.

---

## 9. Escaped-defect loop

This is the mechanism that stops quality from being inconsistent. A standard
that never changes is a standard that stops matching reality.

When a defect is found **after** merge:

1. Log it: what shipped, how it was found, what the diff looked like.
2. Classify: which pass (§4) should have caught it?
3. Convert it into exactly one of:
   - a new line in the relevant zone checklist (§6),
   - a new pattern flag in `scripts/review-scope.mjs` (§8),
   - a new automated gate wired into `quality` **and** CI.
4. Prefer the automated option. A checklist line relies on a reviewer
   remembering; a flag runs every time.
5. If none of the three would have caught it, the review process has a hole —
   fix §4, not the author.

### Worked example

`GitBranchesPanelApp` shipped without a `window.addEventListener("message")`
listener. Every other standalone app had one. The panel stayed on
"Loading branches…" forever because the protocol promise never settled; there
was no error, no timeout, and no test. Fixed 2026-08-30 together with a
12-second safety-net timeout and an error state.

Escaped-defect loop output: checklist **D** now requires the listener on any
standalone app (item 1) and requires a timeout plus an error branch for any
request that can hang (item 2). The mechanical detection is a pattern flag
(§8). The remaining instance of the same class — `void client.ready(…).catch(
() => {})` in `GitCreateBranchApp.tsx:41` — is tracked, not fixed, and should
be closed by the same rule.

---

## 10. Review SLA and merge rules

| Rule                             | Value                                                                                                           |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| First response on an external PR | 48 hours, even if only "seen, will review Thursday"                                                             |
| Required approvals               | One approving review from a CODEOWNER of **every** zone touched                                                 |
| Merge blockers                   | Unresolved `blocking:` finding, red CI, or an undeclared ratchet change                                         |
| Self-merge                       | Allowed for Low-risk changes after the §7 protocol. Not allowed for High/Critical without the two-sitting rule. |
| Stale PR                         | No response from author for 30 days → close with a pointer to reopen                                            |

---

## 11. Anti-patterns

Review theater, in rough order of how much damage it does:

1. **"LGTM" on a >200-line change.** You did not read it; say so or read it.
2. **Reviewing the description instead of the diff.** The description is the
   author's theory. The diff is what shipped.
3. **Style comments on a change with an open correctness question.**
4. **Relitigating architecture inside a PR.** New architectural direction is an
   issue and a design doc, not a 40-comment thread.
5. **Vague asks.** "Add tests" → name the behavior. "Refactor this" → name the
   property it violates.
6. **Letting the same agent that wrote the diff review it.** An AI reviewer on
   its own output checks consistency with its own assumptions — the one thing
   that does not need checking.
7. **Re-reviewing from scratch after every push.** Re-read only the delta plus
   the threads you opened.

---

## 12. Labels

Create these in the repository so the PR list is filterable by what a change
needs, not by what it is:

| Label                                                                                                                 | Use for                                                     |
| --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `risk/low` · `risk/medium` · `risk/high` · `risk/critical`                                                            | Author's self-assessment; reviewer confirms                 |
| `needs/split`                                                                                                         | Over the §3 budget                                          |
| `needs/evidence`                                                                                                      | Risk-to-evidence matrix not satisfied                       |
| `area/core` · `area/git` · `area/protocol` · `area/webview` · `area/commands` · `area/host` · `area/ci` · `area/docs` | Zone, mirrors §6                                            |
| `ai-assisted`                                                                                                         | AI wrote or substantially produced the diff (§13)           |
| `review/solo`                                                                                                         | Reviewed under the §7 cold-review protocol, no second human |

---

## 13. AI-authored diffs

Most changes in this repository are produced with AI assistance. That is fine;
it changes what review must check, not whether review happens.

**Author must, in the PR body:**

- check `ai-assisted` and state what the agent produced (whole change, tests
  only, a refactor pass),
- declare that the diff was read in full, not spot-checked,
- state which gates were run.

**Reviewer must additionally:**

1. **Verify every symbol exists.** AI invents plausible APIs. Grep each new
   import, method, and setting key against the source. Type-clean code calling
   a method that does not exist is the most common AI defect in this repo's
   class of codebase.
2. **Hunt the smooth failure.** Search the diff for empty `catch`,
   `.catch(() => {})`, `?? []`, `|| {}`, `as any`, and default branches that
   make an error path look like an empty result. `pnpm run review:scope` does
   the mechanical part.
3. **Check the tests can fail.** AI-authored tests frequently assert that the
   mock returns what the mock was given. Revert the production change locally
   and confirm red.
4. **Confirm no gate was moved.** If the diff touches a threshold, budget, or
   the architecture guard, treat it as blocking until justified.
5. **Diff against the existing pattern.** AI produces a working solution that
   does not match the eight other places this codebase already solves the same
   problem. Consistency is a correctness property here, not a style preference.
6. **Never accept an agent's self-review as the review.**

---

## 14. Definition of a finished review

- Every touched zone has an approving CODEOWNER, or the §7 protocol is
  recorded in the PR.
- No unresolved `blocking:` finding.
- `consider:` findings are either fixed or converted into a linked issue.
- Required gates for the touched zones are green (§3, `pnpm run review:scope`).
- The author, not the reviewer, pushed the final fixups — and the reviewer
  re-read the delta.
