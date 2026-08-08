/**
 * E2E: Merge resolver Git submenu — Explorer Git coverage (spec §7).
 *
 * Structure tests only verify menu visibility rules. Every Git action test
 * asserts a real outcome (diff content, blame rows, git index, disk) against
 * test-conflict-repo — not merely that git:menuAction was posted.
 */
import { test, expect } from "@playwright/test";
import {
  loadRealBlame,
  loadRealChangesFromSide,
  loadRealFileLog,
  loadRealMergeDocument,
} from "./helpers/real-repo";
import type { HostFixtures } from "./helpers/host";
import {
  buildSimpleConflictDoc,
  clearPostedMessages,
  installMergeHost,
  installRealGitHost,
  openMergeResolver,
  setupMergeFixtures,
} from "./helpers/merge";
import { E2E_REPO_ROOT, git } from "./helpers/git-actions";
import {
  expectGitBlamePosted,
  expectMergeGitSubmenu,
  openMergeConflictGitMenu,
  openMergePaneGitMenu,
} from "./helpers/menus";
import {
  appendWorktreeLine as appendLine,
  expectBlameGutterRendered as expectBlameRendered,
  readHeadBlob as headBlob,
  removeTestArtifacts as removeArtifacts,
  restoreTrackedFile,
  runAddParity as addParity,

  runCompareBranchParity as compareBranchParity,
  runCompareRevisionParity as compareRevisionParity,
  runRollbackParity as rollbackParity,
  runShowDiffParity as showDiffParity,
  runShowHistoryParity as showHistoryParity,
  runUnstageParity as unstageParity,
  writeUntrackedFile as writeUntracked,
} from "./helpers/git-submenu-parity";

let fixtures: HostFixtures;
const RELATIVE_PATH = "src/app.ts";
const STAGE_FILE = "e2e-merge-submenu-stage.txt";
const ROLLBACK_FILE = "types.ts";
const DIFF_FILE = "file.txt";
const DIFF_MARKER = "# e2e merge submenu show diff";
const ROLLBACK_MARKER = "# e2e merge submenu rollback";

test.beforeAll(async () => {
  const baseDoc = await loadRealMergeDocument();
  fixtures = {
    mergeDocument: buildSimpleConflictDoc({
      repoRoot: baseDoc.repoRoot,
      relativePath: RELATIVE_PATH,
    }),
    blameOurs: await loadRealBlame("ours"),
    blameTheirs: await loadRealBlame("theirs"),
    fileLog: await loadRealFileLog(),
    changesFromSide: await loadRealChangesFromSide(),
    conflictFiles: [
      { relativePath: RELATIVE_PATH, stageCode: "UU" },
      { relativePath: DIFF_FILE, stageCode: "UU" },
    ],
  };
  await setupMergeFixtures(fixtures);
});

test.describe("Git submenu — menu structure (visibility only)", () => {
  test.beforeEach(async ({ page }) => {
    await installMergeHost(page, fixtures);
    await openMergeResolver(page, RELATIVE_PATH);
  });

  test("left pane conflict shows resolve actions and full Git submenu", async ({
    page,
  }) => {
    await openMergeConflictGitMenu(page, "left", "ours");
    await expect(page.getByTestId("merge-context-accept-local")).toBeVisible();
    await expectMergeGitSubmenu(page, { annotate: true });
  });

  test("center pane hides Annotate but keeps inspect actions", async ({
    page,
  }) => {
    await openMergePaneGitMenu(page, "center");
    await expectMergeGitSubmenu(page, { annotate: false });
    await expect(page.getByTestId("merge-context-accept-local")).toHaveCount(0);
  });

  test("left gutter exposes dedicated Annotate toggle outside Git section", async ({
    page,
  }) => {
    await openMergePaneGitMenu(page, "left", { gutter: true });
    await expectMergeGitSubmenu(page, {
      annotate: false,
      gutterAnnotate: true,
    });
  });
});

test.describe("Git submenu — Git file actions with real outcomes", () => {
  test.beforeEach(async () => {
    await removeArtifacts(E2E_REPO_ROOT, [STAGE_FILE]);
    await restoreTrackedFile(E2E_REPO_ROOT, ROLLBACK_FILE);
    await restoreTrackedFile(E2E_REPO_ROOT, DIFF_FILE);
  });

  test("Show History opens populated history for the merge file", async ({
    page,
  }) => {
    const historyDoc = buildSimpleConflictDoc({
      repoRoot: fixtures.mergeDocument.repoRoot,
      relativePath: DIFF_FILE,
    });
    await installRealGitHost(page, {
      ...fixtures,
      mergeDocument: historyDoc,
      mergeDocumentsByPath: { [DIFF_FILE]: historyDoc },
    }, { openHistoryPageOnRequest: true });
    await openMergeResolver(page, DIFF_FILE);
    await openMergePaneGitMenu(page, "left");
    await showHistoryParity(page, DIFF_FILE);
  });

  test("Show Diff surfaces HEAD ↔ working tree delta in diff preview", async ({
    page,
  }) => {
    await appendLine(E2E_REPO_ROOT, DIFF_FILE, DIFF_MARKER);
    const diffDoc = buildSimpleConflictDoc({
      repoRoot: fixtures.mergeDocument.repoRoot,
      relativePath: DIFF_FILE,
    });
    const diffFixtures: HostFixtures = {
      ...fixtures,
      mergeDocument: diffDoc,
      mergeDocumentsByPath: {
        ...fixtures.mergeDocumentsByPath,
        [DIFF_FILE]: diffDoc,
      },
    };

    await installRealGitHost(page, diffFixtures);
    await openMergeResolver(page, DIFF_FILE);
    await openMergePaneGitMenu(page, "left");
    await showDiffParity(page, DIFF_FILE, DIFF_MARKER);
  });

  test("Compare with Revision opens a revision diff preview", async ({
    page,
  }) => {
    const diffDoc = buildSimpleConflictDoc({
      repoRoot: fixtures.mergeDocument.repoRoot,
      relativePath: DIFF_FILE,
    });
    await installRealGitHost(page, {
      ...fixtures,
      mergeDocument: diffDoc,
      mergeDocumentsByPath: { [DIFF_FILE]: diffDoc },
    });
    await openMergeResolver(page, DIFF_FILE);
    await openMergePaneGitMenu(page, "left");
    await compareRevisionParity(page);
  });

  test("Compare with Branch opens a branch comparison diff preview", async ({
    page,
  }) => {
    const diffDoc = buildSimpleConflictDoc({
      repoRoot: fixtures.mergeDocument.repoRoot,
      relativePath: DIFF_FILE,
    });
    await installRealGitHost(page, {
      ...fixtures,
      mergeDocument: diffDoc,
      mergeDocumentsByPath: { [DIFF_FILE]: diffDoc },
    });
    await openMergeResolver(page, DIFF_FILE);
    await openMergePaneGitMenu(page, "left");
    await compareBranchParity(page);
  });

  test("Annotate from left conflict shows ours blame for the merge file", async ({
    page,
  }) => {
    await installRealGitHost(page, fixtures);
    await openMergeResolver(page, RELATIVE_PATH);
    await openMergeConflictGitMenu(page, "left", "ours");
    await page.getByTestId("git-menu-annotate").click();
    await expectGitBlamePosted(page, "ours", RELATIVE_PATH);
    await expectBlameRendered(page, {
      authorSample: fixtures.blameOurs.authorSample,
      shaSample: fixtures.blameOurs.shaSample,
      pane: "left",
    });
  });

  test("Annotate from right conflict shows theirs blame for the merge file", async ({
    page,
  }) => {
    await installRealGitHost(page, fixtures);
    await openMergeResolver(page, RELATIVE_PATH);
    await openMergeConflictGitMenu(page, "right", "theirs");
    await page.getByTestId("git-menu-annotate").click();
    await expectGitBlamePosted(page, "theirs", RELATIVE_PATH);
    await expectBlameRendered(page, {
      authorSample: fixtures.blameTheirs.authorSample,
      shaSample: fixtures.blameTheirs.shaSample,
      pane: "right",
    });
  });

  test("Add stages only the active merge file", async ({ page }) => {
    const decoy = "e2e-merge-submenu-decoy.txt";
    await writeUntracked(E2E_REPO_ROOT, STAGE_FILE, "merge submenu add\n");
    await writeUntracked(E2E_REPO_ROOT, decoy, "decoy\n");

    const stageDoc = buildSimpleConflictDoc({
      repoRoot: fixtures.mergeDocument.repoRoot,
      relativePath: STAGE_FILE,
    });
    const stageFixtures: HostFixtures = {
      ...fixtures,
      mergeDocument: stageDoc,
      mergeDocumentsByPath: { [STAGE_FILE]: stageDoc },
      conflictFiles: [
        ...(fixtures.conflictFiles ?? []),
        { relativePath: STAGE_FILE, stageCode: "UU" },
      ],
    };

    await installRealGitHost(page, stageFixtures);
    await openMergeResolver(page, STAGE_FILE);
    await openMergePaneGitMenu(page, "left");
    await addParity(page, E2E_REPO_ROOT, STAGE_FILE, decoy);
    await removeArtifacts(E2E_REPO_ROOT, [decoy]);
  });

  test("Unstage removes only the active merge file from the index", async ({
    page,
  }) => {
    const decoy = "e2e-merge-submenu-decoy-staged.txt";
    await writeUntracked(E2E_REPO_ROOT, STAGE_FILE, "merge submenu unstage\n");
    await writeUntracked(E2E_REPO_ROOT, decoy, "decoy staged\n");
    await git(E2E_REPO_ROOT, ["add", "--", STAGE_FILE, decoy]);

    const stageDoc = buildSimpleConflictDoc({
      repoRoot: fixtures.mergeDocument.repoRoot,
      relativePath: STAGE_FILE,
    });
    await installRealGitHost(page, {
      ...fixtures,
      mergeDocument: stageDoc,
      mergeDocumentsByPath: { [STAGE_FILE]: stageDoc },
      conflictFiles: [
        ...(fixtures.conflictFiles ?? []),
        { relativePath: STAGE_FILE, stageCode: "UU" },
      ],
    });
    await openMergeResolver(page, STAGE_FILE);
    await openMergePaneGitMenu(page, "left");
    await unstageParity(page, E2E_REPO_ROOT, STAGE_FILE, decoy);
    await removeArtifacts(E2E_REPO_ROOT, [decoy]);
  });

  test("Rollback restores the active file from HEAD", async ({ page }) => {
    const head = await headBlob(E2E_REPO_ROOT, ROLLBACK_FILE);
    await appendLine(E2E_REPO_ROOT, ROLLBACK_FILE, ROLLBACK_MARKER);

    const rollbackDoc = buildSimpleConflictDoc({
      repoRoot: fixtures.mergeDocument.repoRoot,
      relativePath: ROLLBACK_FILE,
    });
    await installRealGitHost(page, {
      ...fixtures,
      mergeDocument: rollbackDoc,
      mergeDocumentsByPath: { [ROLLBACK_FILE]: rollbackDoc },
      conflictFiles: [
        ...(fixtures.conflictFiles ?? []),
        { relativePath: ROLLBACK_FILE, stageCode: "UU" },
      ],
    });
    await openMergeResolver(page, ROLLBACK_FILE);
    await openMergePaneGitMenu(page, "left");
    await rollbackParity(page, E2E_REPO_ROOT, ROLLBACK_FILE, head);
  });

  test("gutter Annotate toggle still loads blame without duplicating Git submenu item", async ({
    page,
  }) => {
    await installRealGitHost(page, fixtures);
    await openMergeResolver(page, RELATIVE_PATH);
    await clearPostedMessages(page);
    await openMergePaneGitMenu(page, "left", { gutter: true });
    await page.getByTestId("editor-context-menu-annotate-gutter").click();
    await expectGitBlamePosted(page, "ours", RELATIVE_PATH);
    await expectBlameRendered(page, {
      authorSample: fixtures.blameOurs.authorSample,
      shaSample: fixtures.blameOurs.shaSample,
      pane: "left",
    });
  });
});