import * as fs from "node:fs";
import * as path from "node:path";
import {
  EDITOR_CONFLICT_RESOLVE_WHEN,
  FILE_ONLY_WHEN,
  GIT_SUBMENU_CONTEXT_GROUP,
  GIT_SUBMENU_ITEMS,
  MERGE_CHANGES_WHEN,
  RESOLVE_CONFLICT_KEYBINDING_WHEN,
  RESOURCE_FILE_WHEN,
  type GitSubmenuScope,
} from "../types/gitSubmenu";

export type MenuEntry = {
  command?: string;
  submenu?: string;
  when?: string;
  group?: string;
};

type KeybindingEntry = {
  command: string;
  key: string;
  mac?: string;
  when?: string;
};

type PackageJson = {
  contributes?: {
    keybindings?: KeybindingEntry[];
    menus?: Record<string, MenuEntry[]>;
    submenus?: Array<{ id: string; label: string }>;
    commands?: Array<{ command: string; title: string; enablement?: string }>;
  };
};

export const GIT_SUBMENU_ID = "gitView.git";

export {
  EDITOR_CONFLICT_RESOLVE_WHEN,
  FILE_ONLY_WHEN,
  GIT_SUBMENU_CONTEXT_GROUP,
  MERGE_CHANGES_WHEN,
  RESOLVE_CONFLICT_KEYBINDING_WHEN,
  RESOURCE_FILE_WHEN,
};

/** Resolve Conflicts has no reserved default chord for Resolve Conflicts; Alt/Cmd+Shift+M is VS Code–safe (M = merge). */
export const RESOLVE_CONFLICT_KEYBINDING_SPEC = {
  command: "gitView.open",
  key: "alt+shift+m",
  mac: "cmd+alt+shift+m",
  when: RESOLVE_CONFLICT_KEYBINDING_WHEN,
} as const;

export const GIT_CONTEXT_SLOT_SPECS = [
  {
    slot: "explorer/context",
    group: GIT_SUBMENU_CONTEXT_GROUP,
    when: RESOURCE_FILE_WHEN,
  },
  {
    slot: "editor/context",
    group: GIT_SUBMENU_CONTEXT_GROUP,
    when: RESOURCE_FILE_WHEN,
  },
  {
    slot: "scm/resourceState/context",
    group: GIT_SUBMENU_CONTEXT_GROUP,
  },
] as const;

export const EDITOR_TITLE_CONFLICT_RESOLVE_SPEC = {
  slot: "editor/title" as const,
  command: "gitView.open",
  group: "navigation@0",
  when: EDITOR_CONFLICT_RESOLVE_WHEN,
};

export const GIT_CONTEXT_SLOTS = GIT_CONTEXT_SLOT_SPECS.map(
  (spec) => spec.slot,
);

export type { GitSubmenuScope };

export type GitSubmenuCommandSpec = {
  command: string;
  title: string;
  group: string;
  scope: GitSubmenuScope;
  when?: string;
  feature: string;
};

/** Native VS Code submenu contract — derived from GIT_SUBMENU_ITEMS. */
export const GIT_SUBMENU_COMMAND_SPECS = GIT_SUBMENU_ITEMS.map((spec) => {
  const when = "when" in spec ? spec.when : undefined;
  return {
    command: spec.command,
    title: spec.title,
    group: spec.group,
    scope: spec.scope,
    feature: spec.feature,
    ...(when ? { when } : {}),
  };
}) as GitSubmenuCommandSpec[];

export const GIT_SUBMENU_MENU_ENTRIES: MenuEntry[] = GIT_SUBMENU_COMMAND_SPECS.map(
  (spec) => {
    const when = "when" in spec ? spec.when : undefined;
    return {
      command: spec.command,
      group: spec.group,
      ...(when ? { when } : {}),
    };
  },
);

export type ExplorerGitSubmenuFeatureSpec = {
  featureId: string;
  feature: string;
  expectedCommand: string | null;
  coverage: "functional-integration" | "unit-delegate" | "missing";
};

/**
 * GitView Explorer/tree Git submenu feature matrix.
 * A feature with expectedCommand=null is a deliberate red test until GitView
 * exposes an equivalent command or records an explicit product exception.
 */
export const EXPLORER_GIT_SUBMENU_FEATURE_SPECS = [
  {
    featureId: "HIST-001",
    feature: "Show file/folder history",
    expectedCommand: "gitView.showGitHistory",
    coverage: "functional-integration",
  },
  {
    featureId: "DIFF-001",
    feature: "Compare file with revision",
    expectedCommand: "gitView.gitCompareWithRevision",
    coverage: "functional-integration",
  },
  {
    featureId: "DIFF-002",
    feature: "Compare file with branch",
    expectedCommand: "gitView.gitCompareWithBranch",
    coverage: "functional-integration",
  },
  {
    featureId: "DIFF-003",
    feature: "Show working-tree diff",
    expectedCommand: "gitView.gitShowDiff",
    coverage: "functional-integration",
  },
  {
    featureId: "BLAME-001",
    feature: "Annotate with Git Blame",
    expectedCommand: "gitView.gitAnnotateBlame",
    coverage: "functional-integration",
  },
  {
    featureId: "UNDO-001",
    feature: "Rollback uncommitted file changes",
    expectedCommand: "gitView.gitRollback",
    coverage: "functional-integration",
  },
  {
    featureId: "STAGE-001",
    feature: "Add selected file/folder to Git",
    expectedCommand: "gitView.gitAdd",
    coverage: "functional-integration",
  },
  {
    featureId: "STAGE-002",
    feature: "Unstage selected file/folder",
    expectedCommand: "gitView.gitUnstage",
    coverage: "functional-integration",
  },
  {
    featureId: "COMMIT-001",
    feature: "Commit changes",
    expectedCommand: "gitView.gitCommit",
    coverage: "functional-integration",
  },
  {
    featureId: "COMMIT-002",
    feature: "Commit and Push changes",
    expectedCommand: "gitView.gitCommitAndPush",
    coverage: "functional-integration",
  },
  {
    featureId: "REMOTE-001",
    feature: "Fetch remote changes",
    expectedCommand: "gitView.gitFetch",
    coverage: "functional-integration",
  },
  {
    featureId: "REMOTE-002",
    feature: "Pull remote changes",
    expectedCommand: "gitView.gitPull",
    coverage: "functional-integration",
  },
  {
    featureId: "REMOTE-003",
    feature: "Push commits",
    expectedCommand: "gitView.gitPush",
    coverage: "functional-integration",
  },
  {
    featureId: "REMOTE-004",
    feature: "Update project / sync with remote",
    expectedCommand: "gitView.gitSync",
    coverage: "functional-integration",
  },
  {
    featureId: "BRANCH-001",
    feature: "Branches popup / checkout branch",
    expectedCommand: "gitView.gitCheckoutBranch",
    coverage: "functional-integration",
  },
  {
    featureId: "BRANCH-002",
    feature: "Create new branch",
    expectedCommand: "gitView.gitCreateBranch",
    coverage: "functional-integration",
  },
  {
    featureId: "STASH-001",
    feature: "Stash changes",
    expectedCommand: "gitView.gitStash",
    coverage: "functional-integration",
  },
  {
    featureId: "STASH-002",
    feature: "Unstash changes",
    expectedCommand: "gitView.gitUnstash",
    coverage: "functional-integration",
  },
  {
    featureId: "STASH-003",
    feature: "Shelve changes",
    expectedCommand: "gitView.gitShelve",
    coverage: "functional-integration",
  },
  {
    featureId: "STASH-004",
    feature: "Unshelve changes",
    expectedCommand: "gitView.gitUnshelve",
    coverage: "functional-integration",
  },
  {
    featureId: "INTEGRATE-001",
    feature: "Merge branch",
    expectedCommand: "gitView.gitMerge",
    coverage: "functional-integration",
  },
  {
    featureId: "INTEGRATE-002",
    feature: "Rebase branch",
    expectedCommand: "gitView.gitRebase",
    coverage: "functional-integration",
  },
  {
    featureId: "CONFLICT-001",
    feature: "Open conflicts resolver when merge conflicts exist",
    expectedCommand: "gitView.open",
    coverage: "functional-integration",
  },
] as const satisfies readonly ExplorerGitSubmenuFeatureSpec[];

export const FILE_ONLY_COMMANDS = GIT_SUBMENU_COMMAND_SPECS.filter(
  (spec) => spec.scope === "file",
).map((spec) => spec.command);

function packageJsonPath(): string {
  // Stable in vitest (src/commands) and integration host (out/commands).
  return path.resolve(__dirname, "../../package.json");
}

function loadPackageJson(): PackageJson {
  return JSON.parse(fs.readFileSync(packageJsonPath(), "utf8")) as PackageJson;
}

/** Every command entry declared under contributes.menus["gitView.git"]. */
export function getGitSubmenuCommands(): string[] {
  return getGitSubmenuEntries().map((entry) => entry.command!);
}

/** Context-only Git commands hidden from the command palette. */
export function getPaletteHiddenGitCommands(): string[] {
  return getGitSubmenuCommands().filter(
    (id) => id !== "gitView.open" && id !== "gitView.showGitHistory",
  );
}

export function getPackageMenus(): Record<string, MenuEntry[]> {
  return loadPackageJson().contributes?.menus ?? {};
}

export function getPackageSubmenus(): Array<{ id: string; label: string }> {
  return loadPackageJson().contributes?.submenus ?? [];
}

export function getPackageCommands(): Array<{
  command: string;
  title: string;
  enablement?: string;
}> {
  return loadPackageJson().contributes?.commands ?? [];
}

export function getPackageKeybindings(): KeybindingEntry[] {
  return loadPackageJson().contributes?.keybindings ?? [];
}

export function getGitSubmenuEntries(): MenuEntry[] {
  return loadPackageJson().contributes?.menus?.[GIT_SUBMENU_ID] ?? [];
}

export function expectedGitSubmenuMenuEntries(): MenuEntry[] {
  return GIT_SUBMENU_MENU_ENTRIES;
}
