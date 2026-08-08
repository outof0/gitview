/**
 * E2E: center (result) pane — Monaco syntax tokens.
 */
import { test, expect } from "@playwright/test";
import {
  loadRealMergeDocument,
  loadRealBlame,
  loadRealFileLog,
  loadRealChangesFromSide,
} from "./helpers/real-repo";
import type { HostFixtures } from "./helpers/host";
import { buildMergeDocument } from "../out/core/mergeDocument";
import {
  applyButton,
  buildSimpleConflictDoc,
  clearPostedMessages,
  expectApplyFinishes,
  getPostedMessages,
  getCenterMonacoLines,
  installMergeHost,
  openMergeResolver,
  replaceCenterMonacoLine,
  resolveSimpleConflict,
  setupMergeFixtures,
} from "./helpers/merge";

const TS_BASE = `import { foo } from "./bar";\n\nfunction hello() {\n  return "world";\n}\n`;
const TS_OURS = `import { foo } from "./bar";\n\nfunction hello() {\n  return "ours";\n}\n`;
const TS_THEIRS = `import { foo } from "./bar";\n\nfunction hello() {\n  return "theirs";\n}\n`;

test.describe("Merge resolver center pane", () => {
  test.beforeAll(async () => {
    const baseDoc = await loadRealMergeDocument();
    const fixtures: HostFixtures = {
      mergeDocument: buildMergeDocument({
        repoRoot: baseDoc.repoRoot,
        relativePath: "src/app.ts",
        absolutePath: `${baseDoc.repoRoot}/src/app.ts`,
        base: TS_BASE,
        ours: TS_OURS,
        theirs: TS_THEIRS,
        worktree: TS_OURS,
      }),
      blameOurs: await loadRealBlame("ours"),
      blameTheirs: await loadRealBlame("theirs"),
      fileLog: await loadRealFileLog(),
      changesFromSide: await loadRealChangesFromSide(),
    };
    await setupMergeFixtures(fixtures);
  });

  test("Monaco renders multiple syntax token colors", async ({ page }) => {
    const fixtures = (
      globalThis as unknown as { __MERGE_FIXTURES__: HostFixtures }
    ).__MERGE_FIXTURES__;
    await installMergeHost(page, fixtures);
    await openMergeResolver(page, "src/app.ts");

    const center = page.locator('[data-testid="pane-center"]');
    const tokens = center.locator(
      ".monaco-editor .view-line span[class*='mtk']",
    );
    await expect(tokens.first()).toBeVisible({ timeout: 10_000 });

    await expect
      .poll(
        async () =>
          tokens.evaluateAll(
            (els) =>
              new Set(
                els
                  .map((el) =>
                    [...el.classList].find((c) => c.startsWith("mtk")),
                  )
                  .filter(Boolean),
              ).size,
          ),
        { timeout: 10_000 },
      )
      .toBeGreaterThan(1);
  });
});

test.describe("Merge resolver Monaco editing", () => {
  test.beforeAll(async () => {
    const baseDoc = await loadRealMergeDocument();
    const fixtures: HostFixtures = {
      mergeDocument: buildSimpleConflictDoc({
        repoRoot: baseDoc.repoRoot,
        relativePath: "src/app.ts",
      }),
      blameOurs: await loadRealBlame("ours"),
      blameTheirs: await loadRealBlame("theirs"),
      fileLog: await loadRealFileLog(),
      changesFromSide: await loadRealChangesFromSide(),
      settings: { confirmBeforeMarkResolved: false },
    };
    await setupMergeFixtures(fixtures);
  });

  test.beforeEach(async ({ page }) => {
    const fixtures = (
      globalThis as unknown as { __MERGE_FIXTURES__: HostFixtures }
    ).__MERGE_FIXTURES__;
    await installMergeHost(page, fixtures);
    await openMergeResolver(page, "src/app.ts");
    await clearPostedMessages(page);
  });

  test("manual Monaco edit on unresolved conflict resolves and posts edited content", async ({
    page,
  }) => {
    await expect(page.locator('[data-testid="conflict-counter"]')).toContainText(
      /1 conflict/i,
    );
    await replaceCenterMonacoLine(page, "b", "manual-center");
    await expect(page.locator('[data-testid="conflict-counter"]')).toContainText(
      /0 conflict/i,
    );
    await expect(applyButton(page)).toBeEnabled();

    const lines = await getCenterMonacoLines(page);
    expect(lines).toContain("manual-center");

    await applyButton(page).click();
    const posted = await getPostedMessages(page);
    const resolved = posted.find((m) => m.type === "merge.markResolved");
    expect(resolved).toBeTruthy();
    const content = resolved?.payload?.content as string;
    expect(content).toContain("manual-center");
    expect(content).not.toContain("<<<<<<<");

    await expectApplyFinishes(page, "src/app.ts");
  });

  test("manual Monaco edit after partial accept updates Apply payload", async ({
    page,
  }) => {
    await page
      .locator('[data-testid="pane-left"]')
      .getByLabel("accept-left")
      .click();
    await replaceCenterMonacoLine(page, "ours", "edited-ours");
    await expect(applyButton(page)).toBeEnabled();

    await applyButton(page).click();
    const posted = await getPostedMessages(page);
    const resolved = posted.find((m) => m.type === "merge.markResolved");
    expect(resolved?.payload?.content as string).toContain("edited-ours");
  });

  test("undo/redo after accept keeps center text and conflict state in sync", async ({
    page,
  }) => {
    await page
      .locator('[data-testid="pane-left"]')
      .getByLabel("accept-left")
      .click();
    await expect(page.locator('[data-testid="conflict-counter"]')).toContainText(
      /1 conflict/i,
    );
    const linesAfterAccept = await getCenterMonacoLines(page);
    expect(linesAfterAccept).toContain("ours");

    await page.locator('[data-testid="conflict-counter"]').click();
    const undoMod = process.platform === "darwin" ? "Meta+Z" : "Control+Z";
    await page.keyboard.press(undoMod);
    await expect(page.locator('[data-testid="conflict-counter"]')).toContainText(
      /1 conflict/i,
    );
    const linesAfterUndo = await getCenterMonacoLines(page);
    expect(linesAfterUndo).toContain("b");
    expect(linesAfterUndo).not.toContain("ours");

    const redoMod =
      process.platform === "darwin" ? "Meta+Shift+Z" : "Control+Y";
    await page.keyboard.press(redoMod);
    const linesAfterRedo = await getCenterMonacoLines(page);
    expect(linesAfterRedo).toContain("ours");
  });

  test("manual edit undo redo then Apply posts redone text", async ({
    page,
  }) => {
    await resolveSimpleConflict(page);
    await replaceCenterMonacoLine(page, "ours", "edited-line");
    const undoMod = process.platform === "darwin" ? "Meta+Z" : "Control+Z";
    await page.keyboard.press(undoMod);
    const redoMod =
      process.platform === "darwin" ? "Meta+Shift+Z" : "Control+Y";
    await page.keyboard.press(redoMod);
    const lines = await getCenterMonacoLines(page);
    expect(lines).toContain("edited-line");
    await clearPostedMessages(page);
    await applyButton(page).click();
    const posted = await getPostedMessages(page);
    const resolved = posted.find((m) => m.type === "merge.markResolved");
    expect(String(resolved?.payload?.content ?? "")).toContain("edited-line");
  });

  test("Alt+Backspace reset after manual edit restores base conflict text", async ({
    page,
  }) => {
    await resolveSimpleConflict(page);
    await replaceCenterMonacoLine(page, "ours", "temporary");
    await page
      .locator('[data-testid="pane-left"] .nx-row')
      .filter({ hasText: "ours" })
      .first()
      .click();
    await page.keyboard.press("Alt+Backspace");
    const lines = await getCenterMonacoLines(page);
    expect(lines).toContain("b");
    expect(lines).not.toContain("temporary");
  });

  test("Monaco keeps syntax tokens after accept and manual edit", async ({
    page,
  }) => {
    await resolveSimpleConflict(page);
    await replaceCenterMonacoLine(page, "ours", "edited");
    const tokens = page.locator(
      '[data-testid="pane-center"] .monaco-editor .view-line span[class*="mtk"]',
    );
    await expect(tokens.first()).toBeVisible({ timeout: 10_000 });
    await expect
      .poll(
        async () =>
          tokens.evaluateAll(
            (els) =>
              new Set(
                els
                  .map((el) =>
                    [...el.classList].find((c) => c.startsWith("mtk")),
                  )
                  .filter(Boolean),
              ).size,
          ),
        { timeout: 10_000 },
      )
      .toBeGreaterThan(0);
  });
});
