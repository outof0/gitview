/**
 * E2E integration: merge resolve context menu + Git right-click menus.
 * Covers every resolve action and every GitContextMenuItems entry in the
 * merge resolver and conflicts dialog.
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
  applyButton,
  buildSimpleConflictDoc,
  getPostedMessages,
  installMergeHost,
  openMergeResolver,
  setupMergeFixtures,
} from "./helpers/merge";
import {
  clickContextMenuItem,
  expectApplyEnabled,
  expectCenterLine,
  expectConflictCounter,
  expectResolveMenuItems,
  openConflictBlockContextMenu,
} from "./helpers/menus";

let fixtures: HostFixtures;
const RELATIVE_PATH = "src/app.ts";

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
      { relativePath: "src/other.ts", stageCode: "UU" },
    ],
    settings: { confirmBeforeMarkResolved: false },
  };
  await setupMergeFixtures(fixtures);
});

test.describe("Resolve context menu — full action matrix", () => {
  test.beforeEach(async ({ page }) => {
    await installMergeHost(page, fixtures);
    await openMergeResolver(page, RELATIVE_PATH);
  });

  test("unresolved conflict shows all resolve actions without append", async ({
    page,
  }) => {
    await openConflictBlockContextMenu(page, "left", "ours");
    await expectResolveMenuItems(page, [
      "merge-context-accept-local",
      "merge-context-accept-repository",
      "merge-context-ignore-local",
      "merge-context-ignore-repository",
      "merge-context-resolve-local",
      "merge-context-resolve-repository",
      "merge-context-reset",
    ], [
      "merge-context-append-local",
      "merge-context-append-repository",
    ]);
  });

  test("unchanged line context menu hides resolve actions", async ({ page }) => {
    await page
      .locator('[data-testid="pane-left"]')
      .getByText("a", { exact: true })
      .first()
      .click({ button: "right" });
    await expect(page.getByTestId("git-menu-show-history")).toBeVisible();
    await expect(page.getByTestId("merge-context-accept-local")).toHaveCount(0);
    await expect(page.getByTestId("merge-context-resolve-local")).toHaveCount(0);
  });

  test("Accept Local keeps repository pending", async ({ page }) => {
    await openConflictBlockContextMenu(page, "left", "ours");
    await clickContextMenuItem(page, "merge-context-accept-local");

    await expectCenterLine(page, "ours");
    await expectCenterLine(page, "b", { visible: false });
    await expectConflictCounter(page, /1 conflict/i);
    await expectApplyEnabled(page, false);
    await expect(
      page.locator('[data-testid="pane-right"]').getByLabel("accept-right"),
    ).toHaveAttribute("title", "Append Right Side");
  });

  test("Accept Repository keeps local pending", async ({ page }) => {
    await openConflictBlockContextMenu(page, "right", "theirs");
    await clickContextMenuItem(page, "merge-context-accept-repository");

    await expectCenterLine(page, "theirs");
    await expectCenterLine(page, "ours", { visible: false });
    await expectConflictCounter(page, /1 conflict/i);
    await expectApplyEnabled(page, false);
    await expect(
      page.locator('[data-testid="pane-left"]').getByLabel("accept-left"),
    ).toHaveAttribute("title", "Append Left Side");
  });

  test("Append Repository after Accept Local resolves both sides", async ({
    page,
  }) => {
    await openConflictBlockContextMenu(page, "left", "ours");
    await clickContextMenuItem(page, "merge-context-accept-local");

    await openConflictBlockContextMenu(page, "right", "theirs");
    await expectResolveMenuItems(
      page,
      ["merge-context-append-repository"],
      ["merge-context-append-local"],
    );
    await clickContextMenuItem(page, "merge-context-append-repository");

    await expectCenterLine(page, "ours");
    await expectCenterLine(page, "theirs");
    await expectConflictCounter(page, /0 conflict/i);
    await expectApplyEnabled(page, true);
  });

  test("Append Local after Accept Repository resolves both sides", async ({
    page,
  }) => {
    await openConflictBlockContextMenu(page, "right", "theirs");
    await clickContextMenuItem(page, "merge-context-accept-repository");

    await openConflictBlockContextMenu(page, "left", "ours");
    await expectResolveMenuItems(
      page,
      ["merge-context-append-local"],
      ["merge-context-append-repository"],
    );
    await clickContextMenuItem(page, "merge-context-append-local");

    await expectCenterLine(page, "ours");
    await expectCenterLine(page, "theirs");
    await expectConflictCounter(page, /0 conflict/i);
    await expectApplyEnabled(page, true);
  });

  test("Ignore Local keeps base until repository is handled", async ({
    page,
  }) => {
    await openConflictBlockContextMenu(page, "left", "ours");
    await clickContextMenuItem(page, "merge-context-ignore-local");

    await expectCenterLine(page, "b");
    await expectConflictCounter(page, /1 conflict/i);
    await expectApplyEnabled(page, false);
  });

  test("Ignore Repository keeps base until local is handled", async ({
    page,
  }) => {
    await openConflictBlockContextMenu(page, "right", "theirs");
    await clickContextMenuItem(page, "merge-context-ignore-repository");

    await expectCenterLine(page, "b");
    await expectConflictCounter(page, /1 conflict/i);
    await expectApplyEnabled(page, false);
  });

  test("Ignore both sides via context menu resolves to base", async ({
    page,
  }) => {
    await openConflictBlockContextMenu(page, "left", "ours");
    await clickContextMenuItem(page, "merge-context-ignore-local");
    await openConflictBlockContextMenu(page, "right", "theirs");
    await clickContextMenuItem(page, "merge-context-ignore-repository");

    await expectCenterLine(page, "b");
    await expectConflictCounter(page, /0 conflict/i);
    await expectApplyEnabled(page, true);
  });

  test("Resolve Using Local finishes conflict from left pane", async ({
    page,
  }) => {
    await openConflictBlockContextMenu(page, "left", "ours");
    await clickContextMenuItem(page, "merge-context-resolve-local");

    await expectCenterLine(page, "ours");
    await expectCenterLine(page, "theirs", { visible: false });
    await expectConflictCounter(page, /0 conflict/i);
    await expectApplyEnabled(page, true);
  });

  test("Resolve Using Repository finishes conflict from right pane", async ({
    page,
  }) => {
    await openConflictBlockContextMenu(page, "right", "theirs");
    await clickContextMenuItem(page, "merge-context-resolve-repository");

    await expectCenterLine(page, "theirs");
    await expectCenterLine(page, "ours", { visible: false });
    await expectConflictCounter(page, /0 conflict/i);
    await expectApplyEnabled(page, true);
  });

  test("Reset restores unresolved base after partial accept", async ({
    page,
  }) => {
    await page
      .locator('[data-testid="pane-left"]')
      .getByLabel("accept-left")
      .click();
    await openConflictBlockContextMenu(page, "left", "ours");
    await clickContextMenuItem(page, "merge-context-reset");

    await expectCenterLine(page, "b");
    await expectConflictCounter(page, /1 conflict/i);
    await expectApplyEnabled(page, false);
  });

  test("resolved conflict shows only Reset in context menu", async ({
    page,
  }) => {
    await openConflictBlockContextMenu(page, "left", "ours");
    await clickContextMenuItem(page, "merge-context-resolve-local");
    await openConflictBlockContextMenu(page, "left", "ours");

    await expectResolveMenuItems(page, ["merge-context-reset"], [
      "merge-context-accept-local",
      "merge-context-append-local",
      "merge-context-ignore-local",
      "merge-context-resolve-local",
      "merge-context-resolve-repository",
    ]);
  });
});

test.describe("End-to-end resolve via menus then Apply", () => {
  test("resolve using repository from menu, Apply finishes file", async ({
    page,
  }) => {
    await installMergeHost(page, fixtures);
    await openMergeResolver(page, RELATIVE_PATH);

    await openConflictBlockContextMenu(page, "right", "theirs");
    await clickContextMenuItem(page, "merge-context-resolve-repository");
    await expectApplyEnabled(page, true);

    await applyButton(page).click();
    await expect(page.getByTestId("pane-left")).toHaveCount(0);
    await expect(page.getByText("Merging branch")).toBeVisible();
    await expect(page.getByText(RELATIVE_PATH)).toHaveCount(0);

    const posted = await getPostedMessages(page);
    const resolved = posted.find((m) => m.type === "merge.markResolved");
    expect(resolved).toBeTruthy();
    const content = resolved?.payload?.content as string;
    expect(content).toContain("theirs");
    expect(content).not.toContain("<<<<<<<");
  });
});