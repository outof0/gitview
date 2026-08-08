/**
 * E2E: Conflicts dialog — close/reopen and bulk refresh after host list changes.
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
  installMergeHost,
  setupMergeFixtures,
} from "./helpers/merge";
import { openConflictList } from "./helpers/host";

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
    conflictFiles: [
      { relativePath: "src/app.ts", stageCode: "UU" },
      { relativePath: "src/other.ts", stageCode: "UU" },
    ],
  };
  await setupMergeFixtures(fixtures);
});

test.describe("Conflicts dialog workflow", () => {
  test.beforeEach(async ({ page }) => {
    await installMergeHost(page, fixtures);
    await openConflictList(page);
  });

  test("merge resolver close returns to the conflicts dialog", async ({
    page,
  }) => {
    await expect(page.getByText("Merging branch")).toBeVisible();
    await page.click("text=src/app.ts");
    await page.click('button:has-text("Merge...")');
    await expect(page.getByTestId("pane-left")).toBeVisible();

    await page.getByTestId("merge-cancel").click();
    await expect(page.getByText("Merging branch")).toBeVisible();
    await expect(page.getByText("src/app.ts")).toBeVisible();
    await expect(page.getByText("src/other.ts")).toBeVisible();
  });

  test("close attempt with unresolved conflicts shows confirm and can cancel", async ({
    page,
  }) => {
    await page.getByTitle("Close").first().click();
    await expect(
      page.getByText("Unresolved Conflicts", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("src/app.ts")).toBeVisible();
  });

  test("shows per-file actions matching GitView conflicts dialog", async ({
    page,
  }) => {
    await expect(page.getByRole("button", { name: "Accept Yours" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Accept Theirs" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Merge..." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Git History" })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Apply Non-Conflicting" }),
    ).toHaveCount(0);
  });

});