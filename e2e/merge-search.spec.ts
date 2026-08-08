/**
 * E2E: merge resolver search and replace in the result pane.
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
  buildSearchReplaceDoc,
  buildSearchReplaceSingleDoc,
  buildSimpleConflictDoc,
  clearPostedMessages,
  getCenterMonacoLines,
  getPostedMessages,
  installMergeHost,
  openMergeResolver,
  setupMergeFixtures,
} from "./helpers/merge";

let fixtures: HostFixtures;

function searchPanel(page: import("@playwright/test").Page) {
  return page.getByTestId("search-panel");
}

test.beforeAll(async () => {
  const baseDoc = await loadRealMergeDocument();
  fixtures = {
    mergeDocument: buildSearchReplaceDoc(baseDoc.repoRoot),
    blameOurs: await loadRealBlame("ours"),
    blameTheirs: await loadRealBlame("theirs"),
    fileLog: await loadRealFileLog(),
    changesFromSide: await loadRealChangesFromSide(),
    settings: { confirmBeforeMarkResolved: false },
  };
  await setupMergeFixtures(fixtures);
});

test.describe("Merge search and replace", () => {
  test.beforeEach(async ({ page }) => {
    await installMergeHost(page, fixtures);
    await openMergeResolver(page, "src/search.ts");
  });

  test("Ctrl+H opens search panel with replace field", async ({ page }) => {
    await page.keyboard.press("ControlOrMeta+h");
    const panel = searchPanel(page);
    await expect(panel).toBeVisible();
    await expect(
      panel.getByRole("textbox", { name: "replace-input" }),
    ).toBeVisible();
  });

  test("search panel opens from keyboard and counts matches", async ({
    page,
  }) => {
    await page.keyboard.press("ControlOrMeta+f");
    const panel = searchPanel(page);
    await expect(panel).toBeVisible();

    await panel.getByRole("textbox", { name: "find", exact: true }).fill("findme");
    await expect(page.getByTestId("search-count")).toHaveText("1/2");
  });

  test("Replace current updates only the active match block", async ({
    page,
  }) => {
    await page.keyboard.press("ControlOrMeta+f");
    const panel = searchPanel(page);
    await panel.getByRole("textbox", { name: "find", exact: true }).fill("findme");
    await expect(page.getByTestId("search-count")).toHaveText("1/2");

    await panel.getByRole("textbox", { name: "replace-input" }).fill("replaced-one");
    await panel.getByRole("button", { name: "replace", exact: true }).click();

    const lines = await getCenterMonacoLines(page);
    expect(lines.filter((line) => line === "replaced-one")).toHaveLength(1);
    expect(lines.filter((line) => line === "findme")).toHaveLength(1);
  });

  test("Replace All rewrites every matching result block", async ({
    page,
  }) => {
    await page.keyboard.press("ControlOrMeta+f");
    const panel = searchPanel(page);
    await panel.getByRole("textbox", { name: "find", exact: true }).fill("findme");
    await expect(page.getByTestId("search-count")).toHaveText("1/2");

    await panel.getByRole("textbox", { name: "replace-input" }).fill("replaced-all");
    await panel.getByRole("button", { name: "replace-all" }).click();

    const lines = await getCenterMonacoLines(page);
    expect(lines.filter((line) => line === "replaced-all")).toHaveLength(2);
    expect(lines.some((line) => line.includes("findme"))).toBe(false);
  });

});

test.describe("Merge search apply payload", () => {
  test("Apply payload includes replaced text after Replace All", async ({
    page,
  }) => {
    const baseDoc = await loadRealMergeDocument();
    const singleFixtures: HostFixtures = {
      ...fixtures,
      mergeDocument: buildSearchReplaceSingleDoc(baseDoc.repoRoot),
      settings: { confirmBeforeMarkResolved: false },
    };
    await setupMergeFixtures(singleFixtures);
    await installMergeHost(page, singleFixtures);
    await openMergeResolver(page, "src/search-single.ts");

    await page.keyboard.press("ControlOrMeta+f");
    const panel = searchPanel(page);
    await panel.getByRole("textbox", { name: "find", exact: true }).fill("findme");
    await panel.getByRole("textbox", { name: "replace-input" }).fill("final-text");
    await panel.getByRole("button", { name: "replace-all" }).click();
    await expect(applyButton(page)).toBeEnabled();

    await clearPostedMessages(page);
    await applyButton(page).click();
    await page.waitForTimeout(150);

    const posted = await getPostedMessages(page);
    const resolved = posted.find((m) => m.type === "merge.markResolved");
    expect(resolved).toBeTruthy();
    const content = String(resolved?.payload?.content ?? "");
    expect(content).toContain("final-text");
    expect(content).not.toContain("findme");
  });
});

test.describe("Merge search open", () => {
  test("Ctrl+F opens search on the default conflict fixture", async ({
    page,
  }) => {
    const baseDoc = await loadRealMergeDocument();
    const simpleFixtures: HostFixtures = {
      ...fixtures,
      mergeDocument: buildSimpleConflictDoc({ repoRoot: baseDoc.repoRoot }),
    };
    await installMergeHost(page, simpleFixtures);
    await openMergeResolver(page, "src/app.ts");
    await page.keyboard.press("ControlOrMeta+f");
    await expect(searchPanel(page)).toBeVisible();
  });
});