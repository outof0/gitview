#!/usr/bin/env node

/**
 * Review scope report.
 *
 * Answers the question the quality standard leaves to memory: given *this*
 * diff, which gates do I owe, which checklist applies, and is it too big to
 * review properly?
 *
 *   node scripts/review-scope.mjs                # vs origin/main (or main)
 *   node scripts/review-scope.mjs --base HEAD~3
 *   node scripts/review-scope.mjs --json
 *   node scripts/review-scope.mjs --strict       # exit 1 on a red flag
 *
 * See docs/maintainers/code-review.md sections 3, 6 and 8.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const strict = args.includes("--strict");
const baseArgIndex = args.indexOf("--base");
const baseArg = baseArgIndex >= 0 ? args[baseArgIndex + 1] : undefined;

function git(...gitArgs) {
  try {
    return execFileSync("git", gitArgs, {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return "";
  }
}

function refExists(ref) {
  return (
    execFileSync("git", ["rev-parse", "--verify", "--quiet", ref], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim().length > 0
  );
}

const base =
  baseArg ??
  ["origin/main", "origin/HEAD", "main", "master"].find(refExists) ??
  "HEAD";

// ---------------------------------------------------------------- collection

const committedFiles = git("diff", "--name-only", `${base}...HEAD`);
const workingFiles = git("diff", "--name-only", "HEAD");
const numstat =
  git("diff", "--numstat", `${base}...HEAD`) + git("diff", "--numstat", "HEAD");
const diffBody = git("diff", `${base}...HEAD`, "--", ".") + git("diff", "HEAD");

const changed = [
  ...new Set([...committedFiles.split("\n"), ...workingFiles.split("\n")]),
]
  .map((line) => line.trim())
  .filter(Boolean);

function collectAddedLines(diff) {
  const entries = [];
  let currentFile = "";
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ ")) {
      currentFile = line.startsWith("+++ b/") ? line.slice(6) : "";
      continue;
    }
    if (line.startsWith("+") && !line.startsWith("+++")) {
      entries.push({ file: currentFile, text: line.slice(1) });
    }
  }
  return entries;
}

const addedLines = collectAddedLines(diffBody);

// -------------------------------------------------------------------- budget

// Design files, snapshots, binaries and build output are not reviewable code,
// so they do not consume the review budget.
const excludedFromBudget =
  /^(?:pnpm-lock\.yaml|.*\.(?:snap|pen|vsix|png|jpe?g|gif|ico|woff2?|ttf)$|coverage\/|out\/|webview\/dist\/|e2e-results\/|test-results\/|e2e-report\/)/;

let added = 0;
let removed = 0;
let excludedFiles = 0;
for (const line of numstat.split("\n")) {
  const [rawAdded, rawRemoved, file] = line.split("\t");
  if (!file) {
    continue;
  }
  if (excludedFromBudget.test(file)) {
    excludedFiles += 1;
    continue;
  }
  added += Number.parseInt(rawAdded, 10) || 0;
  removed += Number.parseInt(rawRemoved, 10) || 0;
}

const churn = added + removed;
const budget =
  churn <= 200
    ? { verdict: "OK", note: "standard review, one pass" }
    : churn <= 600
      ? {
          verdict: "LARGE",
          note: "two passes in two sittings; justify the size in the PR",
        }
      : {
          verdict: "SPLIT",
          note: "split it; a skimmed review is worse than none",
        };

// --------------------------------------------------------------------- zones

const zones = [
  {
    id: "core",
    label: "core (pure algorithms)",
    test: (f) => f.startsWith("src/core/"),
    gates: ["pnpm run test:unit", "pnpm run bench:lcs (if complexity changed)"],
    checklist: "A",
  },
  {
    id: "protocol",
    label: "protocol (host <-> webview contract)",
    test: (f) =>
      f.startsWith("src/shared/protocol/") ||
      f.startsWith("webview/src/protocol/"),
    gates: ["pnpm run typecheck", "pnpm run test:unit"],
    checklist: "C",
  },
  {
    id: "foundation",
    label: "foundation (shared contracts and types)",
    test: (f) => f.startsWith("src/shared/") || f.startsWith("src/types/"),
    gates: ["pnpm run check:architecture", "pnpm run typecheck"],
    checklist: "C",
  },
  {
    id: "publicApi",
    label: "public extension API",
    test: (f) => f === "src/publicApi.ts",
    gates: ["pnpm run typecheck", "pnpm run test:int"],
    checklist: "Pass 1",
  },
  {
    id: "infrastructure",
    label: "infrastructure (Git, storage, settings, telemetry)",
    test: (f) =>
      /^src\/(?:services|storage|config|util|observability)\//.test(f),
    gates: ["pnpm run test:int", "pnpm run test:unit"],
    checklist: "B",
  },
  {
    id: "commands",
    label: "commands and native menus",
    test: (f) => f.startsWith("src/commands/"),
    gates: ["pnpm run check:architecture", "pnpm run test:e2e"],
    checklist: "E",
  },
  {
    id: "host",
    label: "host handlers and panels",
    test: (f) =>
      f.startsWith("src/webviewHost/") || f.startsWith("src/webview/"),
    gates: ["pnpm run test:int", "pnpm run check:architecture"],
    checklist: "F",
  },
  {
    id: "composition",
    label: "composition root and DI",
    test: (f) =>
      f.startsWith("src/application/") ||
      f === "src/extension.ts" ||
      f === "src/activation.ts",
    gates: ["pnpm run check:architecture"],
    checklist: "Pass 3",
  },
  {
    id: "frontend",
    label: "webview frontend",
    test: (f) => f.startsWith("webview/src/"),
    gates: [
      "pnpm run check:ui-system",
      "pnpm run test:unit",
      "pnpm run test:e2e (user-visible workflow)",
    ],
    checklist: "D",
  },
  {
    id: "e2e",
    label: "end-to-end tests",
    test: (f) => f.startsWith("e2e/"),
    gates: ["pnpm run test:e2e"],
    checklist: "G",
  },
  {
    id: "tests",
    label: "unit and integration tests",
    test: (f) =>
      /\.(?:test|spec|bench)\.tsx?$/.test(f) ||
      f.includes("__tests__/") ||
      f.startsWith("src/test/"),
    gates: ["pnpm run test:coverage"],
    checklist: "G",
  },
  {
    id: "ci",
    label: "CI, scripts, packaging",
    test: (f) => f.startsWith(".github/") || f.startsWith("scripts/"),
    gates: ["the CI run on this PR"],
    checklist: "H",
  },
  {
    id: "manifest",
    label: "extension manifest and build config",
    test: (f) =>
      f === "package.json" ||
      f === "knip.json" ||
      f === ".vscodeignore" ||
      f === ".gitignore" ||
      f === "tsconfig.json" ||
      f === "tsconfig.e2e.json" ||
      f === "vitest.config.ts" ||
      f === "playwright.config.ts" ||
      f.startsWith("webview/vite.config"),
    gates: ["pnpm run check:package", "pnpm run check:bundle"],
    checklist: "H",
  },
  {
    id: "docs",
    label: "documentation",
    test: (f) => f.endsWith(".md") || f.startsWith("docs/"),
    gates: ["pnpm run check:docs"],
    checklist: "I",
  },
];

const touched = zones
  .filter((zone) => changed.some((file) => zone.test(file)))
  .map((zone) => zone);

const unclassified = changed.filter(
  (file) => !zones.some((zone) => zone.test(file)),
);

// --------------------------------------------------------------------- flags

const flags = [];

function hasFile(predicate) {
  return changed.some(predicate);
}

function addedLineMatching(pattern, filePredicate) {
  return addedLines.filter(
    (entry) =>
      pattern.test(entry.text) &&
      (filePredicate ? filePredicate(entry.file) : true),
  );
}

/**
 * An inline opt-out, for the cases where swallowing really is correct.
 *
 * Deliberately hard to use: it must sit on the offending line and carry a
 * reason (`// review-scope:allow silent-catch — <why>`). A bare marker without
 * a reason is not an exemption, so the line still gets flagged.
 */
const ALLOW_MARKER = /review-scope:allow\s+\S/;

function withoutAllowListed(entries) {
  return entries.filter((entry) => !ALLOW_MARKER.test(entry.text));
}

function sampleFiles(entries, limit = 4) {
  const files = [
    ...new Set(entries.map((entry) => entry.file).filter(Boolean)),
  ];
  const shown = files.slice(0, limit).join(", ");
  return files.length > limit
    ? `${shown}, +${files.length - limit} more`
    : shown;
}

const silentCatch =
  /\.catch\(\s*\(\s*\)\s*=>\s*(?:\{\s*\}|undefined|null)\s*\)/;
const emptyCatch = /catch\s*(?:\([^)]*\))?\s*\{\s*\}/;

const silentCatchHits = withoutAllowListed(
  addedLineMatching(new RegExp(`${silentCatch.source}|${emptyCatch.source}`)),
);
if (silentCatchHits.length > 0) {
  flags.push({
    severity: "red",
    title: "Silent failure",
    detail: `${silentCatchHits.length} added line(s) discard an error (empty catch or \`.catch(() => {})\`) in ${sampleFiles(silentCatchHits)}. A swallowed rejection is how the shelf data-loss bug reached release. Name the failure or surface it.`,
  });
}

const suppressionHits = withoutAllowListed(
  addedLineMatching(
    /\bas any\b|@ts-ignore|@ts-expect-error|eslint-disable|oxlint-disable|@ts-nocheck/,
  ),
);
if (suppressionHits.length > 0) {
  flags.push({
    severity: "yellow",
    title: "Type or lint suppression",
    detail: `${suppressionHits.length} added line(s) suppress a check in ${sampleFiles(suppressionHits)}. Needs a reason in the PR body.`,
  });
}

const nondeterministicHits = addedLineMatching(
  /\bDate\.now\(\)|\bMath\.random\(\)|\bnew Date\(\s*\)/,
  (file) => file.startsWith("src/core/"),
);
if (nondeterministicHits.length > 0) {
  flags.push({
    severity: "red",
    title: "core/determinism",
    detail: `Clock or randomness reached \`src/core/\` (${sampleFiles(nondeterministicHits)}). Nondeterministic input must be injected by the caller; \`check:architecture\` does not catch every form of this.`,
  });
}

if (hasFile((f) => f === "docs/maintainers/quality-exceptions.json")) {
  flags.push({
    severity: "red",
    title: "Architecture exception edited",
    detail:
      "Requires owner, meaningful reason, createdOn, and expiresOn within 90 days. An active exception caps architecture and maintainability below 10/10.",
  });
}

if (hasFile((f) => f === "src/services/git/exec.ts")) {
  flags.push({
    severity: "red",
    title: "Process boundary",
    detail:
      "`src/services/git/exec.ts` is the only module allowed to spawn Git. Every caller is in scope for review.",
  });
}

const ratchetFiles = [
  "vitest.config.ts",
  "scripts/check-architecture.mjs",
  "scripts/check-bundle-budget.mjs",
  "scripts/check-package-contents.mjs",
  "knip.json",
];
const ratchetTouched = changed.filter((f) => ratchetFiles.includes(f));
if (ratchetTouched.length > 0) {
  flags.push({
    severity: "red",
    title: "Ratchet touched",
    detail: `Gate definitions changed: ${ratchetTouched.join(", ")}. A threshold may not be relaxed to make this change pass; the quality standard requires measured evidence, a rationale, and a follow-up target.`,
  });
}

if (hasFile((f) => f === "package.json")) {
  flags.push({
    severity: "yellow",
    title: "Manifest changed",
    detail:
      "`package.json` is the extension's public contract (commands, settings, menus, activation). Confirm `pnpm run check:package` and update the settings and commands reference if anything is user-visible.",
  });
}

// Checklist D, item 1: a standalone webview app that mounts without
// `GitWorkspaceApp` must register its own host-message listener, or every
// protocol promise hangs and the panel spins forever.
const standaloneApps = changed.filter(
  (f) =>
    /^webview\/src\/(?:apps\/)?[\w.]*App\.tsx$/.test(f) &&
    fs.existsSync(path.join(root, f)),
);
const listenerlessApps = standaloneApps.filter((f) => {
  const source = fs.readFileSync(path.join(root, f), "utf8");
  // `GitWorkspaceApp`, the shared subscription, and the controller hook that
  // installs it all provide the listener for everything they render. The
  // merge surface installs its own listener through useMergeHostSubscription
  // (App.tsx renders it via MergeAppBody), which the check used to miss.
  if (source.includes("<GitWorkspaceApp")) {
    return false;
  }
  if (source.includes("useGitWorkspaceHostSubscription")) {
    return false;
  }
  if (source.includes("useMergeHostSubscription")) {
    return false;
  }
  if (source.includes("useGitWorkspaceController(")) {
    return false;
  }
  if (/addEventListener\(\s*["']message["']/.test(source)) {
    return false;
  }
  return true;
});
if (listenerlessApps.length > 0) {
  flags.push({
    severity: "red",
    title: "Standalone app without a host-message listener",
    detail: `${listenerlessApps.join(", ")} never call \`client.handleHostMessage\`. Protocol promises never settle and the panel hangs on its loading state with no error and no timeout. Reference: GitDiffApp.tsx:228-238.`,
  });
}

// Checklist D, item 2: `client.ready()` is not a nicety. Every host panel
// pushes a surface's data only *after* it answers this handshake
// (gitWorkspacePanel.ts, gitViewPresentation.ts, GitViewPanel.ts), so a
// rejected handshake means the panel never receives anything. An un-caught
// rejection is worse than a swallowed one: it is silent *and* unhandled.
// This one is deliberately file-level rather than diff-level. The generic
// "silent failure" flag above only sees added lines, so a swallow merged last
// year stays invisible forever. The handshake is the invariant that matters
// most in this codebase, so touching the file is enough to re-check it.
const READY_CALL = /\.ready\(\s*["'][\w.]+["']\s*\)/;
const SWALLOWED_CATCH =
  /\.catch\(\s*\(\s*\)\s*=>\s*(?:\{\s*\}|undefined|null)\s*\)/;
const badHandshakes = [];
for (const f of changed) {
  if (!f.startsWith("webview/src/")) {
    continue;
  }
  // Tests intentionally create rejected `ready()` promises to exercise the
  // production hook's error path; the hook, not the test stub, owns handling.
  if (f.includes("/__tests__/") || /\.test\.[jt]sx?$/.test(f)) {
    continue;
  }
  const full = path.join(root, f);
  if (!fs.existsSync(full)) {
    continue;
  }
  const lines = fs.readFileSync(full, "utf8").split("\n");
  lines.forEach((text, index) => {
    if (!READY_CALL.test(text)) {
      return;
    }
    // Prettier wraps these chains, so the `.catch` usually sits a few lines
    // below the call rather than on it.
    const window = lines.slice(Math.max(0, index - 2), index + 24).join("\n");
    if (ALLOW_MARKER.test(window)) {
      return;
    }
    const problem = SWALLOWED_CATCH.test(window)
      ? "swallows the rejection"
      : window.includes(".catch(")
        ? null
        : "has no .catch at all";
    if (problem) {
      badHandshakes.push({ file: f, line: index + 1, problem });
    }
  });
}
if (badHandshakes.length > 0) {
  flags.push({
    severity: "red",
    title: "Handshake has no failure path",
    detail: `${badHandshakes
      .map((site) => `${site.file}:${site.line} ${site.problem}`)
      .join(
        "; ",
      )}. The host pushes a surface's data only after it answers \`client.ready\`, so a rejected handshake leaves the panel on its loading state with an empty screen. Surface it where the handshake gates rendering (GitCreateBranchApp, GitHistoryApp); log it where a load timeout already covers the user (GitDiffApp, GitBlameApp).`,
  });
}

// -------------------------------------------------------------------- report

const requiredGates = [...new Set(touched.flatMap((zone) => zone.gates))];
const checklists = [
  ...new Set(touched.flatMap((zone) => zone.checklist)),
].sort();
const redFlags = flags.filter((flag) => flag.severity === "red");

const report = {
  base,
  filesChanged: changed.length,
  filesExcludedFromBudget: excludedFiles,
  linesAdded: added,
  linesRemoved: removed,
  churn,
  budget,
  zones: touched.map((zone) => zone.label),
  unclassified,
  requiredGates,
  checklists,
  flags,
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Review scope — diff vs ${base}`);
  console.log("");
  console.log(
    `  Files changed        ${changed.length} (${excludedFiles} excluded from budget)`,
  );
  console.log(
    `  Lines added/removed  +${added} / -${removed}  (churn ${churn})`,
  );
  console.log(`  Size verdict         ${budget.verdict} — ${budget.note}`);
  console.log("");

  if (touched.length === 0) {
    console.log("  Zones: none detected.");
  } else {
    console.log("  Zones touched:");
    for (const zone of touched) {
      console.log(`    - ${zone.label}  (checklist ${zone.checklist})`);
    }
  }
  if (unclassified.length > 0) {
    console.log("");
    console.log(
      "  Unclassified files (add a zone rule if these are recurring):",
    );
    for (const file of unclassified.slice(0, 10)) {
      console.log(`    - ${file}`);
    }
  }

  console.log("");
  console.log("  Required gates:");
  if (requiredGates.length === 0) {
    console.log("    (none beyond the PR's own CI run)");
  } else {
    for (const gate of requiredGates) {
      console.log(`    - ${gate}`);
    }
  }
  console.log(`    - pnpm run quality   (always, before merge)`);

  if (checklists.length > 0) {
    console.log("");
    console.log(
      `  Checklists to apply: ${checklists.join(", ")} — docs/maintainers/code-review.md#6-zone-checklists`,
    );
  }

  console.log("");
  if (flags.length === 0) {
    console.log("  Flags: none.");
  } else {
    console.log(`  Flags (${redFlags.length} red):`);
    for (const flag of flags) {
      const marker = flag.severity === "red" ? "[RED]" : "[YEL]";
      console.log(`    ${marker} ${flag.title}`);
      console.log(`           ${flag.detail}`);
    }
  }

  console.log("");
  console.log(
    "  Review passes: docs/maintainers/code-review.md#4-the-review-passes",
  );
}

if (strict && redFlags.length > 0) {
  process.exit(1);
}
