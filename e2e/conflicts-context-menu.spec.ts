/**
 * E2E: Conflicts dialog — right-click context menu on file and directory rows.
 * Git submenu tests follow Explorer Git coverage: each action must produce
 * a real outcome, not only post git:menuAction.
 */
import { test, expect } from "@playwright/test";
import {
  loadRealBlame,
  loadRealChangesFromSide,
  loadRealFileLog,
  loadRealMergeDocument,
} from "./helpers/real-repo";
import type { HostFixtures } from "./helpers/host";
import { openConflictList } from "./helpers/host";
import {
  buildSimpleConflictDoc,
  installMergeHost,
  installRealGitHost,
  setupMergeFixtures,
} from "./helpers/merge";
import { E2E_REPO_ROOT, git } from "./helpers/git-actions";
import {
  enableConflictsGroupedView,
  expectConflictsFileContextMenu,
  expectConflictsFolderContextMenu,
  expectHostMessagePosted,
  openConflictsFileContextMenu,
  openConflictsFolderContextMenu,
} from "./helpers/menus";
import {
  appendWorktreeLine,
  readHeadBlob,
  removeTestArtifacts,
  restoreTrackedFile,
  runAddParity,
  runAnnotateParity,
  runCompareBranchParity,
  runCompareRevisionParity,
  runRollbackParity,
  runShowDiffParity,
  runShowHistoryParity,
  runUnstageParity,
  writeUntrackedFile,
} from "./helpers/git-submenu-parity";

let fixtures: HostFixtures;
const APP_PATH = "src/app.ts";
const OTHER_PATH = "src/other.ts";
const ROOT_FILE = "README.md";
const FOLDER = "src";
const FOLDER_ONE = `${FOLDER}/e2e-conflicts-one.txt`;
const FOLDER_TWO = `${FOLDER}/e2e-conflicts-two.txt`;
const DIFF_MARKER = "# e2e conflicts submenu diff";

test.beforeAll(async () => {
  const baseDoc = await loadRealMergeDocument();
  const appDoc = buildSimpleConflictDoc({
    repoRoot: baseDoc.repoRoot,
    relativePath: APP_PATH,
  });
  const otherDoc = buildSimpleConflictDoc({
    repoRoot: baseDoc.repoRoot,
    relativePath: OTHER_PATH,
  });
  const rootDoc = buildSimpleConflictDoc({
    repoRoot: baseDoc.repoRoot,
    relativePath: ROOT_FILE,
  });
  fixtures = {
    mergeDocument: appDoc,
    mergeDocumentsByPath: {
      [APP_PATH]: appDoc,
      [OTHER_PATH]: otherDoc,
      [ROOT_FILE]: rootDoc,
    },
    blameOurs: await loadRealBlame("ours"),
    blameTheirs: await loadRealBlame("theirs"),
    fileLog: await loadRealFileLog(),
    changesFromSide: await loadRealChangesFromSide(),
    conflictFiles: [
      { relativePath: APP_PATH, stageCode: "UU" },
      { relativePath: OTHER_PATH, stageCode: "UU" },
      { relativePath: ROOT_FILE, stageCode: "UU" },
      { relativePath: "src/components/Button.tsx", stageCode: "UU" },
    ],
  };
  await setupMergeFixtures(fixtures);
});

test.describe("Flat list — resolve shortcuts", () => {
  test.beforeEach(async ({ page }) => {
    await installMergeHost(page, fixtures);
    await openConflictList(page);
  });

  test("opens full file context menu", async ({ page }) => {
    await openConflictsFileContextMenu(page, APP_PATH);
    await expectConflictsFileContextMenu(page);
  });

  test("Merge... opens the merge resolver", async ({ page }) => {
    await openConflictsFileContextMenu(page, APP_PATH);
    await page.getByTestId("conflicts-context-menu").getByText("Merge...").click();
    await expect(page.getByTestId("pane-left")).toBeVisible();
    await expect(page.getByText(`Resolve Conflicts — ${APP_PATH}`)).toBeVisible();
  });

  test("Accept Yours posts conflicts:acceptYours for the file", async ({
    page,
  }) => {
    await openConflictsFileContextMenu(page, APP_PATH);
    await page.getByTestId("conflicts-menu-accept-yours").click();
    await expectHostMessagePosted(
      page,
      "conflict.acceptLocal",
      (p) =>
        Array.isArray(p.paths) && (p.paths as string[]).includes(APP_PATH),
    );
  });

  test("Accept Theirs posts conflicts:acceptTheirs for the file", async ({
    page,
  }) => {
    await openConflictsFileContextMenu(page, OTHER_PATH);
    await page.getByTestId("conflicts-menu-accept-theirs").click();
    await expectHostMessagePosted(
      page,
      "conflict.acceptIncoming",
      (p) =>
        Array.isArray(p.paths) && (p.paths as string[]).includes(OTHER_PATH),
    );
  });
});

test.describe("Flat list — Git file actions with real outcomes", () => {
  test.beforeEach(async ({ page }) => {
    await removeTestArtifacts(E2E_REPO_ROOT, [FOLDER_ONE, FOLDER_TWO]);
    await git(E2E_REPO_ROOT, ["reset", "HEAD", "--", ROOT_FILE, "file.txt"]).catch(
      () => "",
    );
    await installRealGitHost(page, fixtures, { openHistoryPageOnRequest: true });
    await openConflictList(page);
  });

  test("Show History opens populated history scoped to the file", async ({
    page,
  }) => {
    await openConflictsFileContextMenu(page, ROOT_FILE);
    await runShowHistoryParity(page, ROOT_FILE);
  });

  test("Show Diff surfaces working-tree delta in diff preview", async ({
    page,
  }) => {
    await appendWorktreeLine(E2E_REPO_ROOT, ROOT_FILE, DIFF_MARKER);
    await openConflictsFileContextMenu(page, ROOT_FILE);
    await runShowDiffParity(page, ROOT_FILE, DIFF_MARKER);
  });

  test("Compare with Revision opens revision diff preview", async ({ page }) => {
    await openConflictsFileContextMenu(page, ROOT_FILE);
    await runCompareRevisionParity(page);
  });

  test("Compare with Branch opens branch diff preview", async ({ page }) => {
    await openConflictsFileContextMenu(page, ROOT_FILE);
    await runCompareBranchParity(page);
  });

  test("Annotate loads real blame for the selected file", async ({ page }) => {
    await openConflictsFileContextMenu(page, ROOT_FILE);
    await runAnnotateParity(page, ROOT_FILE, { expectGutter: false });
  });

  test("Add stages only the right-clicked file", async ({ page }) => {
    const decoy = "e2e-conflicts-submenu-decoy.txt";
    const marker = "# conflicts submenu add";
    await appendWorktreeLine(E2E_REPO_ROOT, ROOT_FILE, marker);
    await writeUntrackedFile(E2E_REPO_ROOT, decoy, "decoy\n");
    await openConflictsFileContextMenu(page, ROOT_FILE);
    await runAddParity(page, E2E_REPO_ROOT, ROOT_FILE, decoy);
    await removeTestArtifacts(E2E_REPO_ROOT, [decoy]);
    await restoreTrackedFile(E2E_REPO_ROOT, ROOT_FILE);
  });

  test("Unstage removes only the right-clicked file from the index", async ({
    page,
  }) => {
    const decoy = "e2e-conflicts-submenu-decoy-staged.txt";
    await writeUntrackedFile(E2E_REPO_ROOT, decoy, "decoy staged\n");
    await git(E2E_REPO_ROOT, ["add", "--", ROOT_FILE, decoy]);
    await openConflictsFileContextMenu(page, ROOT_FILE);
    await runUnstageParity(page, E2E_REPO_ROOT, ROOT_FILE, decoy);
    await removeTestArtifacts(E2E_REPO_ROOT, [decoy]);
    await restoreTrackedFile(E2E_REPO_ROOT, ROOT_FILE);
  });

  test("Rollback restores the right-clicked file from HEAD", async ({
    page,
  }) => {
    const head = await readHeadBlob(E2E_REPO_ROOT, ROOT_FILE);
    await appendWorktreeLine(E2E_REPO_ROOT, ROOT_FILE, "# conflicts rollback");
    await openConflictsFileContextMenu(page, ROOT_FILE);
    await runRollbackParity(page, E2E_REPO_ROOT, ROOT_FILE, head);
  });
});

test.describe("Grouped list — folder scope", () => {
  test.beforeEach(async ({ page }) => {
    await removeTestArtifacts(E2E_REPO_ROOT, [FOLDER_ONE, FOLDER_TWO]);
    await installRealGitHost(page, fixtures, { openHistoryPageOnRequest: true });
    await openConflictList(page);
    await enableConflictsGroupedView(page);
  });

  test("opens folder context menu without file-only resolve shortcuts", async ({
    page,
  }) => {
    await openConflictsFolderContextMenu(page, FOLDER);
    await expectConflictsFolderContextMenu(page);
  });

  test("Show History opens folder-scoped history", async ({ page }) => {
    await openConflictsFolderContextMenu(page, FOLDER);
    await runShowHistoryParity(page, FOLDER);
  });

  test("Add on folder row stages contained files", async ({ page }) => {
    await writeUntrackedFile(E2E_REPO_ROOT, FOLDER_ONE, "one\n");
    await writeUntrackedFile(E2E_REPO_ROOT, FOLDER_TWO, "two\n");
    await openConflictsFolderContextMenu(page, FOLDER);
    await page.getByTestId("git-menu-add").click();
    await expect
      .poll(async () => {
        const indexed = await git(E2E_REPO_ROOT, [
          "diff",
          "--cached",
          "--name-only",
        ]);
        const files = new Set(indexed.trim().split("\n").filter(Boolean));
        return files.has(FOLDER_ONE) && files.has(FOLDER_TWO);
      })
      .toBe(true);
  });

  test("Unstage on folder row unstages contained files", async ({ page }) => {
    await writeUntrackedFile(E2E_REPO_ROOT, FOLDER_ONE, "one\n");
    await writeUntrackedFile(E2E_REPO_ROOT, FOLDER_TWO, "two\n");
    await git(E2E_REPO_ROOT, ["add", "--", FOLDER]);
    await openConflictsFolderContextMenu(page, FOLDER);
    await page.getByTestId("git-menu-unstage").click();
    await expect
      .poll(async () => {
        const indexed = await git(E2E_REPO_ROOT, [
          "diff",
          "--cached",
          "--name-only",
        ]);
        return (
          !indexed.includes(FOLDER_ONE) && !indexed.includes(FOLDER_TWO)
        );
      })
      .toBe(true);
  });

  test("file-only inspect actions stay disabled on folder rows", async ({
    page,
  }) => {
    await openConflictsFolderContextMenu(page, FOLDER);
    for (const id of [
      "git-menu-compare-revision",
      "git-menu-compare-branch",
      "git-menu-show-diff",
      "git-menu-annotate",
      "git-menu-rollback",
    ]) {
      await expect(page.getByTestId(id)).toHaveClass(/cursor-not-allowed/);
    }
  });
});

test.describe("Grouped list — file inside directory", () => {
  const BUTTON_PATH = "src/components/Button.tsx";

  test.beforeEach(async ({ page }) => {
    await git(E2E_REPO_ROOT, ["reset", "HEAD", "--", BUTTON_PATH]).catch(
      () => "",
    );
    await restoreTrackedFile(E2E_REPO_ROOT, BUTTON_PATH);
    await installRealGitHost(page, fixtures);
    await openConflictList(page);
    await enableConflictsGroupedView(page);
  });

  test("Git Show Diff still targets the full relative path", async ({
    page,
  }) => {
    await appendWorktreeLine(E2E_REPO_ROOT, BUTTON_PATH, DIFF_MARKER);
    await openConflictsFileContextMenu(page, BUTTON_PATH);
    await runShowDiffParity(page, BUTTON_PATH, DIFF_MARKER);
  });

  test("Merge... from grouped file row opens resolver for that file", async ({
    page,
  }) => {
    await openConflictsFileContextMenu(page, OTHER_PATH);
    await page.getByTestId("conflicts-context-menu").getByText("Merge...").click();
    await expectHostMessagePosted(
      page,
      "merge.openFile",
      (p) => p.path === OTHER_PATH,
    );
    await expect(page.getByTestId("pane-left")).toBeVisible();
    await expect(page.getByText(`Resolve Conflicts — ${OTHER_PATH}`)).toBeVisible();
  });
});