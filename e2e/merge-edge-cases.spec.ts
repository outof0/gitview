/**
 * E2E: merge edge cases E1-E7, E10-E11 from the workflow audit.
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
  buildAddAddDoc,
  buildAdjacentHunksDoc,
  buildDuDoc,
  buildMixedEolDoc,
  buildSimpleConflictDoc,
  buildUdDoc,
  withUnresolvedNonConflicting,
  buildComplexConflictDoc,
  expectApplyFinishes,
  installMergeHost,
  openMergeResolver,
  setupMergeFixtures,
  expandAllCollapsed,
  replaceCenterMonacoLine,
  resolveSimpleConflict,
} from "./helpers/merge";
import { openConflictList } from "./helpers/host";

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
  await setupMergeFixtures(baseFixtures);
});

test.describe("E1 — add/add (AA) conflict", () => {
  test("opens from conflict list, resolves, and Apply finishes", async ({
    page,
  }) => {
    const baseDoc = await loadRealMergeDocument();
    const aaDoc = buildAddAddDoc(baseDoc.repoRoot);
    const fixtures: HostFixtures = {
      ...baseFixtures,
      mergeDocumentsByPath: { "edge/aa-file.ts": aaDoc },
      conflictFiles: [
        { relativePath: "edge/aa-file.ts", stageCode: "AA" },
        { relativePath: "src/app.ts", stageCode: "UU" },
      ],
      settings: { confirmBeforeMarkResolved: false },
    };
    await installMergeHost(page, fixtures);
    await openConflictList(page);
    await page.click("text=edge/aa-file.ts");
    await page.click('button:has-text("Merge...")');
    await expect(page.getByTestId("pane-left")).toBeVisible();
    await expect(
      page.locator('[data-testid="pane-left"]').getByText("master-add", {
        exact: false,
      }),
    ).toBeVisible();

    await page
      .locator('[data-testid="pane-left"]')
      .getByLabel("accept-left")
      .click();
    await page
      .locator('[data-testid="pane-right"]')
      .getByLabel("ignore")
      .click();
    await applyButton(page).click();
    await expectApplyFinishes(page, "edge/aa-file.ts");
  });
});

test.describe("E2 — delete/modify (UD/DU)", () => {
  test("UD file opens and resolves with local content", async ({ page }) => {
    const baseDoc = await loadRealMergeDocument();
    const udDoc = buildUdDoc(baseDoc.repoRoot);
    const fixtures: HostFixtures = {
      ...baseFixtures,
      mergeDocumentsByPath: { "edge/du-file.ts": udDoc },
      conflictFiles: [{ relativePath: "edge/du-file.ts", stageCode: "UD" }],
      settings: { confirmBeforeMarkResolved: false },
    };
    await installMergeHost(page, fixtures);
    await openMergeResolver(page, "edge/du-file.ts");
    await page
      .locator('[data-testid="pane-left"]')
      .getByLabel("accept-left")
      .click();
    await page
      .locator('[data-testid="pane-right"]')
      .getByLabel("ignore")
      .click();
    await applyButton(page).click();
    await expectApplyFinishes(page, "edge/du-file.ts");
  });

  test("DU file opens and resolves with repository content", async ({
    page,
  }) => {
    const baseDoc = await loadRealMergeDocument();
    const duDoc = buildDuDoc(baseDoc.repoRoot);
    const fixtures: HostFixtures = {
      ...baseFixtures,
      mergeDocumentsByPath: { "edge/ud-file.ts": duDoc },
      conflictFiles: [{ relativePath: "edge/ud-file.ts", stageCode: "DU" }],
      settings: { confirmBeforeMarkResolved: false },
    };
    await installMergeHost(page, fixtures);
    await openMergeResolver(page, "edge/ud-file.ts");
    await expect(
      page.locator('[data-testid="pane-right"]').getByText("feature-modified", {
        exact: false,
      }),
    ).toBeVisible();
    await page
      .locator('[data-testid="pane-right"]')
      .getByLabel("accept-right")
      .click();
    await page
      .locator('[data-testid="pane-left"]')
      .getByLabel("ignore")
      .click();
    await applyButton(page).click();
    await expectApplyFinishes(page, "edge/ud-file.ts");
  });
});

test.describe("E3 — rename conflicts blocked", () => {
  test("AU file shows error toast and stays on conflict list", async ({
    page,
  }) => {
    const fixtures: HostFixtures = {
      ...baseFixtures,
      conflictFiles: [{ relativePath: "old-name.ts", stageCode: "AU" }],
      mergeOpenErrors: {
        "old-name.ts": {
          code: "RENAME_CONFLICT",
          message:
            "Rename conflicts must be resolved in Git before using the merge tool.",
        },
      },
    };
    await installMergeHost(page, fixtures);
    await openConflictList(page);
    await page.click("text=old-name.ts");
    await page.click('button:has-text("Merge...")');
    await expect(
      page.locator("#toastContainer [role='alert']").filter({
        hasText: /Rename conflicts/i,
      }),
    ).toBeVisible();
    await expect(page.getByText("Merging branch")).toBeVisible();
    await expect(page.getByTestId("pane-center")).toHaveCount(0);
  });
});

test.describe("E4 — mixed LF/CRLF banner", () => {
  test("shows banner; Fix normalizes; Ignore dismisses", async ({ page }) => {
    const baseDoc = await loadRealMergeDocument();
    const fixtures: HostFixtures = {
      ...baseFixtures,
      mergeDocument: buildMixedEolDoc(baseDoc.repoRoot),
    };
    await installMergeHost(page, fixtures);
    await openMergeResolver(page, "src/mixed-eol.ts");
    const banner = page.getByTestId("crlf-banner");
    await expect(banner).toBeVisible();
    await page.getByTestId("crlf-ignore").click();
    await expect(banner).toHaveCount(0);
    await page.getByTestId("merge-cancel").click();
    await openMergeResolver(page, "src/mixed-eol.ts");
    await expect(banner).toBeVisible();
    await page.getByTestId("crlf-fix").click();
    await expect(banner).toHaveCount(0);
  });
});

test.describe("E5 — DIFF_TOO_LARGE", () => {
  test("shows error and does not open resolver", async ({ page }) => {
    const fixtures: HostFixtures = {
      ...baseFixtures,
      conflictFiles: [
        { relativePath: "src/huge.ts", stageCode: "UU" },
        { relativePath: "src/app.ts", stageCode: "UU" },
      ],
      mergeOpenErrors: {
        "src/huge.ts": {
          code: "DIFF_TOO_LARGE",
          message:
            "Diff is too large (15000×15000 cells). Open a smaller file or split the change.",
        },
      },
    };
    await installMergeHost(page, fixtures);
    await openConflictList(page);
    await page.click("text=src/huge.ts");
    await page.click('button:has-text("Merge...")');
    await expect(
      page.locator("#toastContainer [role='alert']").filter({
        hasText: /too large/i,
      }),
    ).toBeVisible();
    await expect(page.getByText("Merging branch")).toBeVisible();
    await expect(page.getByTestId("pane-center")).toHaveCount(0);
  });
});

test.describe("E6 — Save and Apply errors", () => {
  test("failed Apply shows error and keeps resolver open", async ({ page }) => {
    const fixtures: HostFixtures = {
      ...baseFixtures,
      settings: { confirmBeforeMarkResolved: false },
      resolveShouldFail: true,
      resolveFailMessage: "Disk full",
    };
    await installMergeHost(page, fixtures);
    await openMergeResolver(page, "src/app.ts");
    await page
      .locator('[data-testid="pane-left"]')
      .getByLabel("accept-left")
      .click();
    await page
      .locator('[data-testid="pane-right"]')
      .getByLabel("ignore")
      .click();
    await page.getByTestId("merge-apply").click();
    await expect(
      page.locator("#toastContainer [role='alert']").filter({
        hasText: "Disk full",
      }),
    ).toBeVisible();
    await expect(page.getByTestId("pane-left")).toBeVisible();
    await expect(page.getByTestId("merge-apply")).toBeEnabled();
  });

  test("Apply with conflict markers shows error and keeps resolver open", async ({
    page,
  }) => {
    const fixtures: HostFixtures = {
      ...baseFixtures,
      settings: { confirmBeforeMarkResolved: false },
    };
    await installMergeHost(page, fixtures);
    await openMergeResolver(page, "src/app.ts");
    await resolveSimpleConflict(page);
    await replaceCenterMonacoLine(
      page,
      "ours",
      "<<<<<<< HEAD\nbroken\n=======\ntheirs\n>>>>>>> branch",
    );
    await applyButton(page).click();
    await page.waitForTimeout(200);
    await expect(
      page.locator("#toastContainer [role='alert']").filter({
        hasText: /conflict markers/i,
      }),
    ).toBeVisible();
    await expect(page.getByTestId("pane-left")).toBeVisible();
  });
});

test.describe("E7 — center Revert after bulk apply", () => {
  test("revert one applied hunk re-enables non-conflicting toolbar", async ({
    page,
  }) => {
    const baseDoc = await loadRealMergeDocument();
    const fixtures: HostFixtures = {
      ...baseFixtures,
      mergeDocument: withUnresolvedNonConflicting(
        buildComplexConflictDoc(baseDoc.repoRoot),
      ),
    };
    await installMergeHost(page, fixtures);
    await openMergeResolver(page, "src/complex.ts");
    await page.getByLabel("Apply all non-conflicting").click();
    const center = page.getByTestId("pane-center");
    await expect(center.getByText("value + 2", { exact: false })).toBeVisible();

    // Single Result editor: select the resolved block then use the Revert control.
    await center.locator(".monaco-editor .view-line").filter({
      hasText: "value + 2",
    }).first().click();
    await center.getByLabel("revert-center").click({ force: true });

    await expect(center.getByText("value + 2", { exact: false })).toHaveCount(
      0,
    );
    await expect(
      page.getByLabel("Apply non-conflicting from left"),
    ).toBeVisible();
  });
});

test.describe("E10 — adjacent hunks", () => {
  test("F7 visits both; resolving first leaves one conflict", async ({
    page,
  }) => {
    const baseDoc = await loadRealMergeDocument();
    const fixtures: HostFixtures = {
      ...baseFixtures,
      mergeDocument: buildAdjacentHunksDoc(baseDoc.repoRoot),
    };
    await installMergeHost(page, fixtures);
    await openMergeResolver(page, "src/adjacent.ts");

    const getActiveBlockId = () =>
      page.evaluate(() => {
        const el = document.querySelector(
          '[data-testid="pane-left"] .nx-block.nx-active',
        );
        return el?.getAttribute("data-block") ?? null;
      });

    await page.keyboard.press("F7");
    const first = await getActiveBlockId();
    await page.keyboard.press("F7");
    const second = await getActiveBlockId();
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(second).not.toBe(first);

    await expandAllCollapsed(page);
    await page
      .locator('[data-testid="pane-left"] .nx-block')
      .filter({ hasText: "ours2" })
      .getByLabel("accept-left")
      .click();
    await page
      .locator('[data-testid="pane-right"] .nx-block')
      .filter({ hasText: "theirs2" })
      .getByLabel("ignore")
      .click();

    await expect(page.getByTestId("conflict-counter")).toContainText(
      /1 conflict/i,
    );
    await expect(applyButton(page)).toBeDisabled();
  });
});

test.describe("E11 — binary conflict from list", () => {
  test("shows error toast and stays on conflict list", async ({ page }) => {
    const fixtures: HostFixtures = {
      ...baseFixtures,
      conflictFiles: [{ relativePath: "assets/logo.bin", stageCode: "UU" }],
      mergeOpenErrors: {
        "assets/logo.bin": {
          code: "BINARY_CONFLICT",
          message:
            "Binary files cannot be merged in the text resolver. Resolve this file with Git directly.",
        },
      },
    };
    await installMergeHost(page, fixtures);
    await openConflictList(page);
    await page.click("text=assets/logo.bin");
    await page.click('button:has-text("Merge...")');
    await expect(
      page.locator("#toastContainer [role='alert']").filter({
        hasText: /Binary files cannot be merged/i,
      }),
    ).toBeVisible();
    await expect(page.getByText("Merging branch")).toBeVisible();
    await expect(page.getByTestId("pane-center")).toHaveCount(0);
  });
});
