import { buildMergeDocument } from "../../../src/core/mergeDocument";
import type { MergeDocument } from "../../../src/core/types";
import type { GitCommitEntry, GitViewSettings } from "@gitview/types";

const DEMO_REPO = "/Users/demo/my-project";

// Fixture content mirrors the public `gitview-demo` repo so the playground (and
// therefore every launch screenshot) shows the same story a visitor gets when
// they clone it. Dev-only: nothing in src/ or webview/src (outside dev/) reads
// this file.
const DEMO_CONFLICT_FILES = [
  { relativePath: "src/config.ts", stageCode: "UU", conflictCount: 1 },
  { relativePath: "src/components/Button.tsx", stageCode: "UU", conflictCount: 2 },
  { relativePath: "src/theme.ts", stageCode: "UU", conflictCount: 1 },
  { relativePath: "package.json", stageCode: "AU", conflictCount: 1 },
  { relativePath: "README.md", stageCode: "UD", conflictCount: 1 },
  { relativePath: "src/long.ts", stageCode: "UU", conflictCount: 1 },
];

// Base → ours touches `retries`/`timeout`; base → theirs touches `timeout` too
// (a real conflict) and `region` (auto-merges). One shot therefore shows both a
// conflicting hunk and a cleanly merged one.
const CFG_HEAD = "export const config = {\n  retries: ";
const CFG_BASE = `${CFG_HEAD}1,\n  timeout: 2_000,\n  verbose: true,\n};\n\nexport function endpoint() {\n  return \`https://\${deployment.region}\`;\n}\n\nexport const deployment = {\n  region: "us-east-1",\n  replicas: 2,\n};\n\nexport const limits = {\n  perPage: 20,\n};\n`;
const CFG_OURS = `${CFG_HEAD}3,\n  timeout: 5_000,\n  verbose: true,\n};\n\nexport function endpoint() {\n  return \`https://\${deployment.region}\`;\n}\n\nexport const deployment = {\n  region: "us-east-1",\n  replicas: 2,\n};\n\nexport const limits = {\n  perPage: 20,\n};\n`;
const CFG_THEIRS = `${CFG_HEAD}1,\n  timeout: 8_000,\n  verbose: true,\n};\n\nexport function endpoint() {\n  return \`https://\${deployment.region}\`;\n}\n\nexport const deployment = {\n  region: "eu-west-1",\n  replicas: 2,\n};\n\nexport const limits = {\n  perPage: 20,\n};\n`;

export type PlaygroundScenario =
  | "conflictList"
  | "simpleMerge"
  | "tallMerge"
  | "markersMerge";

export type PlaygroundFixtures = {
  repoRoot: string;
  branchInfo: { currentBranch: string; mergeHead?: string };
  conflictFiles: typeof DEMO_CONFLICT_FILES;
  settings?: Partial<GitViewSettings>;
  documents: Record<string, MergeDocument>;
  fileLog: GitCommitEntry[];
  changesFromSide: {
    commits: GitCommitEntry[];
    revisionRange: string;
  };
};

function buildTsConflict(relativePath: string): MergeDocument {
  return buildMergeDocument({
    repoRoot: DEMO_REPO,
    relativePath,
    absolutePath: `${DEMO_REPO}/${relativePath}`,
    base: CFG_BASE,
    ours: CFG_OURS,
    theirs: CFG_THEIRS,
    worktree: CFG_OURS,
  });
}

function buildTallConflict(): MergeDocument {
  const prefix = Array.from({ length: 30 }, (_, i) => `ctx${i}`).join("\n");
  const suffix = Array.from({ length: 30 }, (_, i) => `tail${i}`).join("\n");
  const mid = (center: string) => `${prefix}\n${center}\n${suffix}\n`;
  return buildMergeDocument({
    repoRoot: DEMO_REPO,
    relativePath: "src/long.ts",
    absolutePath: `${DEMO_REPO}/src/long.ts`,
    base: mid("base"),
    ours: mid("ours"),
    theirs: mid("theirs"),
    worktree: mid("ours"),
  });
}

function buildMarkersConflict(): MergeDocument {
  const worktree =
    "keep\n<<<<<<< HEAD\nours-line\n=======\ntheirs-line\n>>>>>>> demo/theirs\nend\n";
  return buildMergeDocument({
    repoRoot: DEMO_REPO,
    relativePath: "src/markers.ts",
    absolutePath: `${DEMO_REPO}/src/markers.ts`,
    base: "ignored",
    ours: "ignored",
    theirs: "ignored",
    worktree,
    mergeEngine: "markers",
  });
}

const SAMPLE_COMMITS: GitCommitEntry[] = [
  {
    sha: "cb7d63f1a0e4b2c9d8f7a6b5c4d3e2f1a0b9c8d7",
    shortSha: "cb7d63f",
    author: "Alice Chen",
    authorEmail: "alice@example.com",
    authorTime: 1_759_000_000,
    subject: "feat: ship ButtonGroup",
    changedFiles: [{ path: "src/components/ButtonGroup.tsx", status: "A" }],
  },
  {
    sha: "0f95e684c3b2a1908f7e6d5c4b3a291807f6e5d4",
    shortSha: "0f95e68",
    author: "Alice Chen",
    authorEmail: "alice@example.com",
    authorTime: 1_758_900_000,
    subject: "merge: bring in button variants",
    changedFiles: [{ path: "src/components/Button.tsx", status: "M" }],
  },
  {
    sha: "60b98c37d2c1b0a9f8e7d6c5b4a39281706f5e4d",
    shortSha: "60b98c3",
    author: "Bob Rivera",
    authorEmail: "bob@example.com",
    authorTime: 1_758_800_000,
    subject: "test: cover button variants",
    changedFiles: [{ path: "src/components/Button.test.tsx", status: "A" }],
  },
  {
    sha: "65e74bf6c1b0a9f8e7d6c5b4a39281706f5e4d3c",
    shortSha: "65e74bf",
    author: "Bob Rivera",
    authorEmail: "bob@example.com",
    authorTime: 1_758_700_000,
    subject: "feat: button variant prop",
    changedFiles: [{ path: "src/components/Button.tsx", status: "M" }],
  },
  {
    sha: "5170e715b0a9f8e7d6c5b4a39281706f5e4d3c2b",
    shortSha: "5170e71",
    author: "Carol Diaz",
    authorEmail: "carol@example.com",
    authorTime: 1_758_600_000,
    subject: "docs: document cx helper",
    changedFiles: [{ path: "CONTRIBUTING.md", status: "M" }],
  },
  {
    sha: "8c251904a9f8e7d6c5b4a39281706f5e4d3c2b1a",
    shortSha: "8c25198",
    author: "Alice Chen",
    authorEmail: "alice@example.com",
    authorTime: 1_758_500_000,
    subject: "chore: bump tsconfig target",
    changedFiles: [{ path: "tsconfig.json", status: "M" }],
  },
  {
    sha: "22e7bf393f8e7d6c5b4a39281706f5e4d3c2b1a0",
    shortSha: "22e7bf3",
    author: "Bob Rivera",
    authorEmail: "bob@example.com",
    authorTime: 1_758_400_000,
    subject: "feat: add Button component",
    changedFiles: [{ path: "src/components/Button.tsx", status: "A" }],
  },
  {
    sha: "ef444fd28e7d6c5b4a39281706f5e4d3c2b1a09f",
    shortSha: "ef444fd",
    author: "Carol Diaz",
    authorEmail: "carol@example.com",
    authorTime: 1_758_300_000,
    subject: "fix: token contrast in dark theme",
    changedFiles: [{ path: "src/theme.ts", status: "M" }],
  },
];

export function createPlaygroundFixtures(): PlaygroundFixtures {
  return {
    repoRoot: DEMO_REPO,
    branchInfo: { currentBranch: "demo/ours", mergeHead: "demo/theirs" },
    conflictFiles: DEMO_CONFLICT_FILES,
    documents: {
      "src/config.ts": buildTsConflict("src/config.ts"),
      "src/components/Button.tsx": buildTsConflict("src/components/Button.tsx"),
      "src/long.ts": buildTallConflict(),
      "src/markers.ts": buildMarkersConflict(),
    },
    fileLog: SAMPLE_COMMITS,
    changesFromSide: {
      commits: SAMPLE_COMMITS,
      revisionRange: "base123..HEAD",
    },
  };
}

export function scenarioDocument(
  fixtures: PlaygroundFixtures,
  scenario: PlaygroundScenario,
): MergeDocument | null {
  switch (scenario) {
    case "simpleMerge":
      return fixtures.documents["src/config.ts"] ?? null;
    case "tallMerge":
      return fixtures.documents["src/long.ts"] ?? null;
    case "markersMerge":
      return fixtures.documents["src/markers.ts"] ?? null;
    default:
      return null;
  }
}

export function scenarioRelativePath(scenario: PlaygroundScenario): string {
  switch (scenario) {
    case "tallMerge":
      return "src/long.ts";
    case "markersMerge":
      return "src/markers.ts";
    default:
      return "src/config.ts";
  }
}
