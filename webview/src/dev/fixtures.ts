import { buildMergeDocument } from "../../../src/core/mergeDocument";
import type { MergeDocument } from "../../../src/core/types";
import type { GitCommitEntry, GitViewSettings } from "@gitview/types";

export const DEMO_REPO = "/Users/demo/my-project";

export const DEMO_CONFLICT_FILES = [
  { relativePath: "src/app.ts", stageCode: "UU", conflictCount: 2 },
  { relativePath: "src/utils/helpers.ts", stageCode: "UU", conflictCount: 1 },
  { relativePath: "package.json", stageCode: "AU", conflictCount: 1 },
  {
    relativePath: "src/components/Button.tsx",
    stageCode: "UD",
    conflictCount: 3,
  },
  { relativePath: "README.md", stageCode: "UD", conflictCount: 1 },
  { relativePath: "src/long.ts", stageCode: "UU", conflictCount: 1 },
];

const TS_BASE =
  'import { foo } from "./bar";\n\nfunction hello() {\n  return "world";\n}\n\nexport default hello;\n';
const TS_OURS =
  'import { foo } from "./bar";\n\nfunction hello() {\n  return "our world";\n}\n\nexport default hello;\n';
const TS_THEIRS =
  'import { foo } from "./bar";\n\nfunction hello() {\n  return "their world";\n}\n\nexport default hello;\n';

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
    base: TS_BASE,
    ours: TS_OURS,
    theirs: TS_THEIRS,
    worktree: TS_OURS,
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
    "keep\n<<<<<<< HEAD\nours-line\n=======\ntheirs-line\n>>>>>>> feature/login\nend\n";
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
    sha: "abc1234567890abcdef1234567890abcdef12345",
    shortSha: "abc1234",
    author: "Jane Doe",
    authorEmail: "jane@example.com",
    authorTime: 1_719_000_000,
    subject: "Fix greeting copy",
    changedFiles: [{ path: "src/app.ts", status: "M" }],
  },
  {
    sha: "def1234567890abcdef1234567890abcdef12345",
    shortSha: "def1234",
    author: "Alex Kim",
    authorEmail: "alex@example.com",
    authorTime: 1_718_900_000,
    subject: "Refactor helpers",
    changedFiles: [{ path: "src/utils/helpers.ts", status: "M" }],
  },
];

export function createPlaygroundFixtures(): PlaygroundFixtures {
  return {
    repoRoot: DEMO_REPO,
    branchInfo: { currentBranch: "feature/login", mergeHead: "a1b2c3d" },
    conflictFiles: DEMO_CONFLICT_FILES,
    documents: {
      "src/app.ts": buildTsConflict("src/app.ts"),
      "src/utils/helpers.ts": buildTsConflict("src/utils/helpers.ts"),
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
      return fixtures.documents["src/app.ts"] ?? null;
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
      return "src/app.ts";
  }
}