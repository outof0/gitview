## Summary

Describe the user or framework outcome, not only the files changed.

## Scope

Run `pnpm run review:scope` and paste the zone line.

- Zones touched: <!-- core · protocol · infrastructure · commands · host · webview · e2e · ci · docs · manifest -->
- Changed LOC (excl. lockfile / generated / snapshots): <!-- number -->
- Over the 200-line review budget? <!-- no / yes + why it cannot be split -->

## Risk and contracts

- Risk: <!-- low / medium / high / critical -->
- Public API or protocol impact: <!-- none / additive / breaking + version -->
- Git mutation, persistence, concurrency, or security impact: <!-- describe or none -->
- Architecture boundary impact: <!-- describe or none -->

## Evidence

- Tests added or updated:
- These tests fail without this change: <!-- yes / how you verified -->
- Manual verification:
- Performance or package evidence, when relevant:

## AI assistance

- [ ] AI wrote or substantially produced this diff (label `ai-assisted`).
      If checked: what the agent produced, and confirm you read the whole diff.
- [ ] Every new import, method, and setting key was verified against source.

## Quality checklist

- [ ] `pnpm run quality` passes.
- [ ] Risk-proportional integration/E2E suites pass.
- [ ] Public API, protocol, settings, storage, and docs are updated when affected.
- [ ] No quality threshold or budget was weakened to make this change pass.
- [ ] No new architecture exception was added, or its owner, rationale, and expiry are documented.
- [ ] The change follows [the quality standard](../docs/maintainers/quality-standard.md).

## Review

Reviewer: work the six passes in
[the code review standard](../docs/maintainers/code-review.md#4-the-review-passes)
in order, and prefix every comment with `blocking:`, `consider:`, `nit:`, or
`question:`.

- [ ] Pass 0 — intent is clear from the Summary alone.
- [ ] Pass 1 — contracts and blast radius reviewed.
- [ ] Pass 2 — failure paths and rollback reviewed.
- [ ] Pass 3 — layering verified against `pnpm run check:architecture`.
- [ ] Pass 4 — evidence is real and proportional to risk.
- [ ] Pass 5 — consistency with existing patterns checked.
- [ ] Zone checklist applied: <!-- A · B · C · D · E · F · G · H · I -->
- [ ] If self-reviewed: cold-review protocol recorded (30 min delay, diff view, adversarial five).
