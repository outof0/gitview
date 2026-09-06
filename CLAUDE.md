# CLAUDE.md

See [AGENTS.md](AGENTS.md) — it is the single source of truth for agent instructions in this repository (commands, layering rules, dialog wiring recipe, test traps).

Claude-specific reminders:

- Verify UI changes in real VS Code with Playwright and look at the screenshot before reporting a task complete. Passing vitest proves nothing about whether a feature surfaces.
- Run `pnpm run quality` before saying a change is done. It is the aggregate gate (9 steps: architecture, docs, deadcode, typecheck, lint, coverage, build, bundle, package). `test:unit` alone does not check coverage thresholds and neither does it build, so it is not enough.
