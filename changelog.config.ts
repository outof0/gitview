/**
 * Changelogen config (Antfu / Nuxt ecosystem).
 * Commit messages follow Conventional Commits — see CONTRIBUTING.md.
 *
 * Loaded as `changelog.config.ts` by c12.
 *
 * @see https://github.com/unjs/changelogen
 */
import type { ChangelogConfig } from "changelogen";

export default {
  types: {
    feat: { title: "Features", semver: "minor" },
    fix: { title: "Bug Fixes", semver: "patch" },
    perf: { title: "Performance", semver: "patch" },
    refactor: { title: "Refactors" },
    docs: { title: "Documentation" },
    chore: { title: "Chores" },
    test: { title: "Tests" },
    build: { title: "Build" },
    ci: { title: "CI" },
  },
  output: "CHANGELOG.md",
} satisfies Partial<ChangelogConfig>;
