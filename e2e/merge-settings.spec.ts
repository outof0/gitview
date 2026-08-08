/**
 * E2E: settings wiring — confirmBeforeMarkResolved and foldUnchangedRegions.
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
  buildTallConflictDoc,
  expandAllCollapsed,
  wheelScrollPane,
  clearPostedMessages,
  expectApplyFinishes,
  getPostedMessages,
  installMergeHost,
  openMergeResolver,
  pushSettings,
  resolveSimpleConflict,
  replaceCenterMonacoLine,
  getCenterMonacoLines,
  setupMergeFixtures,
} from "./helpers/merge";

let baseFixtures: HostFixtures;

test.beforeAll(async () => {
  const baseDoc = await loadRealMergeDocument();
  baseFixtures = {
    mergeDocument: buildSimpleConflictDoc({
      repoRoot: baseDoc.repoRoot,
      relativePath: "src/app.ts",
    }),
    blameOurs: await loadRealBlame("ours"),
    blameTheirs: await loadRealBlame("theirs"),
    fileLog: await loadRealFileLog(),
    changesFromSide: await loadRealChangesFromSide(),
  };
});

async function withSettings(
  overrides: HostFixtures["settings"],
): Promise<HostFixtures> {
  return { ...baseFixtures, settings: overrides };
}

test.describe("Settings — confirmBeforeMarkResolved", () => {
  test("posts merge.markResolved from webview (confirm runs on extension host)", async ({
    page,
  }) => {
    const fixtures = await withSettings({ confirmBeforeMarkResolved: true });
    await setupMergeFixtures(fixtures);
    await installMergeHost(page, fixtures);
    await openMergeResolver(page, "src/app.ts");
    await resolveSimpleConflict(page);
    await clearPostedMessages(page);

    await applyButton(page).click();
    await page.waitForTimeout(150);

    const posted = await getPostedMessages(page);
    expect(posted.some((m) => m.type === "merge.markResolved")).toBe(true);
    await expectApplyFinishes(page, "src/app.ts");
  });

  test("posts merge.markResolved when confirm setting is disabled", async ({
    page,
  }) => {
    const fixtures = await withSettings({ confirmBeforeMarkResolved: false });
    await setupMergeFixtures(fixtures);
    await installMergeHost(page, fixtures);
    await openMergeResolver(page, "src/app.ts");
    await resolveSimpleConflict(page);
    await clearPostedMessages(page);

    await applyButton(page).click();
    await page.waitForTimeout(150);

    const posted = await getPostedMessages(page);
    const resolved = posted.find((m) => m.type === "merge.markResolved");
    expect(resolved).toBeDefined();
    expect(resolved?.payload?.path).toBe("src/app.ts");
    expect(String(resolved?.payload?.content ?? "")).toContain("ours");
    expect(String(resolved?.payload?.content ?? "")).not.toContain("<<<<<<<");

    await expectApplyFinishes(page, "src/app.ts");
  });

  test("Ctrl+S applies when conflicts are resolved (Workflow rule: no separate Save)", async ({
    page,
  }) => {
    const fixtures = await withSettings({ confirmBeforeMarkResolved: false });
    await setupMergeFixtures(fixtures);
    await installMergeHost(page, fixtures);
    await openMergeResolver(page, "src/app.ts");
    await resolveSimpleConflict(page);
    await clearPostedMessages(page);

    const saveMod =
      process.platform === "darwin" ? "Meta+s" : "Control+s";
    await page.keyboard.press(saveMod);
    await page.waitForTimeout(150);

    const posted = await getPostedMessages(page);
    const resolved = posted.find((m) => m.type === "merge.markResolved");
    expect(resolved).toBeDefined();
    expect(resolved?.payload?.path).toBe("src/app.ts");
    await expectApplyFinishes(page, "src/app.ts");
  });

  test("Apply closes resolver without staging when autoStageOnResolved is false", async ({
    page,
  }) => {
    const fixtures = await withSettings({
      confirmBeforeMarkResolved: false,
      autoStageOnResolved: false,
    });
    await setupMergeFixtures(fixtures);
    await installMergeHost(page, fixtures);
    await openMergeResolver(page, "src/app.ts");
    await resolveSimpleConflict(page);
    await clearPostedMessages(page);

    await applyButton(page).click();
    await page.waitForTimeout(200);

    await expect(page.getByTestId("pane-left")).toHaveCount(0);
    await expect(page.getByText("Merging branch")).toBeVisible();
    await expect(page.locator("text=src/app.ts")).toBeVisible();
  });
});

test.describe("Settings — foldUnchangedRegions", () => {
  test("collapses long unchanged runs when folding is enabled", async ({
    page,
  }) => {
    const baseDoc = await loadRealMergeDocument();
    const fixtures = await withSettings({
      foldUnchangedRegions: true,
      foldThreshold: 5,
    });
    fixtures.mergeDocument = buildTallConflictDoc(baseDoc.repoRoot);
    await setupMergeFixtures(fixtures);
    await installMergeHost(page, fixtures);
    await openMergeResolver(page, "src/long.ts");

    const banners = page.locator('[aria-label="expand-collapsed"]');
    await expect(banners.first()).toBeVisible({ timeout: 10_000 });
    expect(await banners.count()).toBeGreaterThanOrEqual(2);
  });

  test("shows all lines when folding is disabled", async ({ page }) => {
    const baseDoc = await loadRealMergeDocument();
    const fixtures = await withSettings({ foldUnchangedRegions: false });
    fixtures.mergeDocument = buildTallConflictDoc(baseDoc.repoRoot);
    await setupMergeFixtures(fixtures);
    await installMergeHost(page, fixtures);
    await openMergeResolver(page, "src/long.ts");

    await expect(page.locator('[aria-label="expand-collapsed"]')).toHaveCount(
      0,
    );
    await expect(
      page.locator('[data-testid="pane-left"]').getByText("ctx0", {
        exact: true,
      }),
    ).toBeVisible();
  });

  test("applies app:settings mid-session to enable folding", async ({
    page,
  }) => {
    const baseDoc = await loadRealMergeDocument();
    const fixtures = await withSettings({ foldUnchangedRegions: false });
    fixtures.mergeDocument = buildTallConflictDoc(baseDoc.repoRoot);
    await setupMergeFixtures(fixtures);
    await installMergeHost(page, fixtures);
    await openMergeResolver(page, "src/long.ts");

    await expect(page.locator('[aria-label="expand-collapsed"]')).toHaveCount(
      0,
    );

    await pushSettings(page, {
      foldUnchangedRegions: true,
      foldThreshold: 5,
    });

    const banners = page.locator('[aria-label="expand-collapsed"]');
    await expect(banners.first()).toBeVisible({ timeout: 10_000 });
    expect(await banners.count()).toBeGreaterThanOrEqual(2);
  });
});

test.describe("Resolver cancel / close", () => {
  test("Cancel returns to the conflict list even with dirty manual edits", async ({
    page,
  }) => {
    const fixtures = await withSettings({ confirmBeforeMarkResolved: false });
    await setupMergeFixtures(fixtures);
    await installMergeHost(page, fixtures);
    await openMergeResolver(page, "src/app.ts");

    await replaceCenterMonacoLine(page, "b", "manual-edit");
    await page.getByTestId("merge-cancel").click();
    await expect(page.getByText("Merging branch")).toBeVisible();
    await expect(page.getByTestId("pane-left")).toHaveCount(0);
  });

  test("Escape closes search before it attempts to leave the resolver", async ({
    page,
  }) => {
    const fixtures = await withSettings({ confirmBeforeMarkResolved: false });
    await setupMergeFixtures(fixtures);
    await installMergeHost(page, fixtures);
    await openMergeResolver(page, "src/app.ts");

    await replaceCenterMonacoLine(page, "b", "manual-edit");
    await page.keyboard.press("ControlOrMeta+f");
    await expect(page.getByTestId("search-panel")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("search-panel")).toHaveCount(0);
    await expect(page.getByTestId("pane-left")).toBeVisible();
    expect(await getCenterMonacoLines(page)).toContain("manual-edit");
  });
});

test.describe("Settings — enableScrollSync", () => {
  test("disabling scroll sync lets panes scroll independently", async ({
    page,
  }) => {
    const baseDoc = await loadRealMergeDocument();
    const fixtures = await withSettings({ enableScrollSync: false });
    fixtures.mergeDocument = buildTallConflictDoc(baseDoc.repoRoot);
    await setupMergeFixtures(fixtures);
    await installMergeHost(page, fixtures);
    await openMergeResolver(page, "src/long.ts");

    await expandAllCollapsed(page);

    const center = page.locator('[data-testid="pane-center"]');
    const left = page.locator('[data-testid="pane-left"]');

    const leftBefore = await left.evaluate((el) => el.scrollTop);
    await wheelScrollPane(page, center, 800);
    const leftAfter = await left.evaluate((el) => el.scrollTop);

    expect(leftAfter).toBe(leftBefore);
  });
});
