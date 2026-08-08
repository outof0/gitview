/**
 * E2E: Annotate with Git Blame — UI action through host request to visible rows.
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
  getPostedMessages,
  installMergeHost,
  openMergeResolver,
  setupMergeFixtures,
} from "./helpers/merge";

let fixtures: HostFixtures;

test.beforeAll(async () => {
  const baseDoc = await loadRealMergeDocument();
  fixtures = {
    mergeDocument: buildSimpleConflictDoc({
      repoRoot: baseDoc.repoRoot,
      relativePath: "src/app.ts",
    }),
    blameOurs: await loadRealBlame("ours"),
    blameTheirs: await loadRealBlame("theirs"),
    fileLog: await loadRealFileLog(),
    changesFromSide: await loadRealChangesFromSide(),
  };
  await setupMergeFixtures(fixtures);
});

test("annotate from context menu posts blame.query and shows blame rows", async ({
  page,
}) => {
  await installMergeHost(page, fixtures);
  await openMergeResolver(page, "src/app.ts");
  await clearPostedMessages(page);

  const leftPane = page.locator('[data-testid="pane-left"]');
  await leftPane.click({ button: "right" });
  await page.getByTestId("git-menu-annotate").click();

  await expect
    .poll(async () => {
      const posted = await getPostedMessages(page);
      return posted.some(
        (m) =>
          m.type === "blame.query" &&
          (m.payload as { path?: string }).path === "src/app.ts",
      );
    })
    .toBe(true);

  await expect(page.locator(".nx-blame").first()).toBeVisible({
    timeout: 10_000,
  });
  await expect(leftPane).toContainText(fixtures.blameOurs.authorSample);
  await expect(leftPane).toContainText(fixtures.blameOurs.shaSample);
});

test("toggling annotation off removes blame columns", async ({ page }) => {
  await installMergeHost(page, fixtures);
  await openMergeResolver(page, "src/app.ts");

  const leftPane = page.locator('[data-testid="pane-left"]');
  await leftPane.locator(".nx-ln").first().click({ button: "right" });
  await page.getByTestId("editor-context-menu-annotate-gutter").click();
  await expect(page.locator(".nx-blame").first()).toBeVisible({
    timeout: 10_000,
  });

  await leftPane.locator(".nx-ln").first().click({ button: "right" });
  await page.getByTestId("editor-context-menu-annotate-gutter").click();
  await expect(page.locator(".nx-blame")).toHaveCount(0);
});