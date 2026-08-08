# CLAUDE.md

See [AGENTS.md](AGENTS.md) — it is the single source of truth for agent instructions in this repository (commands, layering rules, dialog wiring recipe, test traps).

Claude-specific reminders:

- Verify UI changes in real VS Code with Playwright and look at the screenshot before reporting a task complete. Passing vitest proves nothing about whether a feature surfaces.
- Run `pnpm run typecheck && pnpm run lint && pnpm run check:architecture && pnpm run test:unit` before saying a change is done.
- This working copy is not a git checkout; do not offer to commit.
