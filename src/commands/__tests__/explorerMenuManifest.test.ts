import { describe, it, expect } from "vitest";
import {
  EDITOR_TITLE_CONFLICT_RESOLVE_SPEC,
  FILE_ONLY_COMMANDS,
  FILE_ONLY_WHEN,
  GIT_CONTEXT_SLOT_SPECS,
  getGitSubmenuCommands,
  expectedGitSubmenuMenuEntries,
  getGitSubmenuEntries,
  getPackageCommands,
  getPackageKeybindings,
  getPackageMenus,
  getPackageSubmenus,
  getPaletteHiddenGitCommands,
  GIT_SUBMENU_COMMAND_SPECS,
  GIT_SUBMENU_ID,
  EXPLORER_GIT_SUBMENU_FEATURE_SPECS,
  MERGE_CHANGES_WHEN,
  RESOLVE_CONFLICT_KEYBINDING_SPEC,
} from "../explorerGitMenuManifest";

describe("Explorer Git context menu manifest", () => {
  const gitSubmenuCommands = getGitSubmenuCommands();
  const menus = getPackageMenus();

  it("declares the gitView.git submenu", () => {
    expect(gitSubmenuCommands.length).toBeGreaterThan(0);
    expect(getPackageSubmenus()).toContainEqual({
      id: GIT_SUBMENU_ID,
      label: "Git",
    });
  });

  it("contributes Git submenu on explorer, editor, and SCM trees", () => {
    for (const spec of GIT_CONTEXT_SLOT_SPECS) {
      const entries = menus[spec.slot] ?? [];
      const when = "when" in spec ? spec.when : undefined;
      expect(entries).toContainEqual({
        submenu: GIT_SUBMENU_ID,
        group: spec.group,
        ...(when ? { when } : {}),
      });
    }
  });

  it("lists every Git submenu command in package.json contributes.commands", () => {
    const registered = new Set(getPackageCommands().map((c) => c.command));
    for (const id of gitSubmenuCommands) {
      expect(registered.has(id), `missing command ${id}`).toBe(true);
    }
  });

  it("matches the GitView Explorer Git submenu contract exactly", () => {
    expect(getGitSubmenuEntries()).toEqual(expectedGitSubmenuMenuEntries());
  });

  it("lets VS Code pass native context resources without literal menu args", () => {
    for (const entry of getGitSubmenuEntries()) {
      expect(
        "args" in entry,
        `${entry.command} should not declare literal resource args`,
      ).toBe(false);
    }
  });

  it("keeps command titles in sync with the submenu contract", () => {
    const byCommand = new Map(
      getPackageCommands().map((entry) => [entry.command, entry] as const),
    );

    for (const spec of GIT_SUBMENU_COMMAND_SPECS) {
      expect(byCommand.get(spec.command)?.title).toBe(spec.title);
    }
  });

  it("wires native enablement for temporary-work and integrate commands", () => {
    const byCommand = new Map(
      getPackageCommands().map((entry) => [entry.command, entry] as const),
    );
    const expected: Record<string, string> = {
      "gitView.gitCommit": "gitView.git.canCommit",
      "gitView.gitCommitAndPush": "gitView.git.canCommit",
      "gitView.gitFetch": "gitView.git.canFetch",
      "gitView.gitPull": "gitView.git.canPull",
      "gitView.gitPush": "gitView.git.canPush",
      "gitView.gitSync": "gitView.git.canSync",
      "gitView.gitStash": "gitView.git.canStash",
      "gitView.gitUnstash": "gitView.git.canUnstash",
      "gitView.gitShelve": "gitView.git.canShelve",
      "gitView.gitUnshelve": "gitView.git.canUnshelve",
      "gitView.gitMerge": "gitView.git.canIntegrate",
      "gitView.gitRebase": "gitView.git.canIntegrate",
    };
    for (const [command, enablement] of Object.entries(expected)) {
      expect(byCommand.get(command)?.enablement, `${command} enablement`).toBe(
        enablement,
      );
    }
  });

  it("uses file-only and merge-only guards only where the feature requires them", () => {
    for (const spec of GIT_SUBMENU_COMMAND_SPECS) {
      const when = "when" in spec ? spec.when : undefined;
      if (spec.scope === "file") {
        expect(when, `${spec.command} should be file-only`).toBe(
          FILE_ONLY_WHEN,
        );
      } else if (spec.scope === "merge") {
        expect(when, `${spec.command} should require merge changes`).toBe(
          MERGE_CHANGES_WHEN,
        );
      } else {
        expect(when, `${spec.command} should support folder/repo scope`)
          .toBeUndefined();
      }
    }

    expect(FILE_ONLY_COMMANDS).toEqual([
      "gitView.gitCompareWithRevision",
      "gitView.gitCompareWithBranch",
      "gitView.gitShowDiff",
      "gitView.gitAnnotateBlame",
      "gitView.gitRollback",
    ]);
  });

  it("hides context-only Git commands from the command palette", () => {
    const palette = menus["commandPalette"] ?? [];
    for (const id of getPaletteHiddenGitCommands()) {
      const entry = palette.find((e) => e.command === id);
      expect(entry?.when, `${id} should not be palette-visible`).toBe("false");
    }
  });

  it("includes merge resolver entry when merge changes exist", () => {
    const gitMenu = menus[GIT_SUBMENU_ID] ?? [];
    const openEntry = gitMenu.find((e) => e.command === "gitView.open");
    expect(openEntry?.when).toBe(MERGE_CHANGES_WHEN);
  });

  it("contributes Resolve conflict on the editor title bar for conflicted files", () => {
    const entries = menus[EDITOR_TITLE_CONFLICT_RESOLVE_SPEC.slot] ?? [];
    expect(entries).toContainEqual({
      command: EDITOR_TITLE_CONFLICT_RESOLVE_SPEC.command,
      group: EDITOR_TITLE_CONFLICT_RESOLVE_SPEC.group,
      when: EDITOR_TITLE_CONFLICT_RESOLVE_SPEC.when,
    });
  });

  it("binds Resolve conflict to Alt/Cmd+Shift+M when the active file has merge conflicts", () => {
    expect(getPackageKeybindings()).toContainEqual(
      RESOLVE_CONFLICT_KEYBINDING_SPEC,
    );
  });

  describe("Explorer Git feature specs", () => {
    const contributed = new Set(gitSubmenuCommands);

    it.each(EXPLORER_GIT_SUBMENU_FEATURE_SPECS)(
      "$featureId contributes command for $feature",
      (spec) => {
        expect(
          spec.expectedCommand,
          `${spec.featureId}: ${spec.feature} is missing a submenu command.`,
        ).not.toBeNull();
        if (spec.expectedCommand === null) {
          return;
        }
        expect(
          contributed.has(spec.expectedCommand),
          `${spec.featureId}: ${spec.expectedCommand} must be contributed under ${GIT_SUBMENU_ID}`,
        ).toBe(true);
      },
    );

    it.each(EXPLORER_GIT_SUBMENU_FEATURE_SPECS)(
      "$featureId has executable coverage for $feature",
      (spec) => {
        expect(
          spec.coverage,
          `${spec.featureId}: ${spec.feature} needs a functional integration or delegate test.`,
        ).not.toBe("missing");
      },
    );
  });
});
