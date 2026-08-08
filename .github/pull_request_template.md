## Summary

Describe the user or framework outcome, not only the files changed.

## Risk and contracts

- Risk: <!-- low / medium / high -->
- Public API or protocol impact: <!-- none / additive / breaking + version -->
- Git mutation, persistence, concurrency, or security impact: <!-- describe or none -->
- Architecture boundary impact: <!-- describe or none -->

## Evidence

- Tests added or updated:
- Manual verification:
- Performance or package evidence, when relevant:

## Quality checklist

- [ ] `pnpm run quality` passes.
- [ ] Risk-proportional integration/E2E suites pass.
- [ ] Public API, protocol, settings, storage, and docs are updated when affected.
- [ ] No quality threshold or budget was weakened to make this change pass.
- [ ] No new architecture exception was added, or its owner, rationale, and expiry are documented.
- [ ] The change follows [the quality standard](../docs/maintainers/quality-standard.md).
