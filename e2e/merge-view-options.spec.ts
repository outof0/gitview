/**
 * E2E: View/compare options, whitespace policy, and highlighting in merge resolver.
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
  buildModifiedLineDoc,
  buildSimpleConflictDoc,
  buildWhitespaceDiffDoc,
  installMergeHost,
  openMergeResolver,
  reopenMergeWithFixtures,
  replaceCenterMonacoLine,
  setCompareMode,
  setHighlightingMode,
  setWhitespacePolicy,
  setupMergeFixtures,
  sideRow,
} from "./helpers/merge";

let repoRoot = "/repo";
let conflictFixtures: HostFixtures;

test.beforeAll(async () => {
  const baseDoc = await loadRealMergeDocument();
  repoRoot = baseDoc.repoRoot;
  conflictFixtures = {
    mergeDocument: buildSimpleConflictDoc({
      repoRoot,
      relativePath: "src/app.ts",
    }),
    blameOurs: await loadRealBlame("ours"),
    blameTheirs: await loadRealBlame("theirs"),
    fileLog: await loadRealFileLog(),
    changesFromSide: await loadRealChangesFromSide(),
  };
  await setupMergeFixtures(conflictFixtures);
});

async function openConflictMerge(page: import("@playwright/test").Page) {
  await setupMergeFixtures(conflictFixtures);
  await installMergeHost(page, conflictFixtures);
  await openMergeResolver(page, "src/app.ts");
  await setHighlightingMode(page, "lines");
}

test.describe("Compare contents", () => {
  test.beforeEach(async ({ page }) => {
    await openConflictMerge(page);
  });

  test("Local vs Base shows base pane and highlights local against base", async ({
    page,
  }) => {
    await setCompareMode(page, "localBase");

    await expect(page.getByTestId("pane-base-wrap")).toBeVisible();
    await expect(page.getByTestId("merge-pane-grid-wrap")).toHaveAttribute(
      "data-compare-mode",
      "localBase",
    );
    await expect(page.getByTestId("pane-base-wrap")).toContainText("b");

    const oursRow = sideRow(page, "left", "ours");
    await expect(oursRow).toHaveClass(/nx-conflict/);
    await expect(oursRow.locator(".nx-stripe")).toBeVisible();

    const theirsRow = sideRow(page, "right", "theirs");
    await expect(theirsRow).not.toHaveClass(/nx-conflict/);
    await expect(theirsRow.locator(".nx-stripe")).toHaveCount(0);

    // GitView behavior this protects: Local vs Base compares only Local and Base — not center.
    const centerConflict = page
      .locator('[data-testid="pane-center"] .monaco-editor .view-line')
      .filter({ hasText: "b" });
    await expect(centerConflict).not.toHaveClass(/nx-monaco-conflict/);
    await expect(
      page.locator('[data-testid="pane-center"] .nx-monaco-stripe-conflict'),
    ).toHaveCount(0);
  });

  test("Local vs Base does not highlight center after result diverges from base", async ({
    page,
  }) => {
    // GitView behavior this protects: center (Middle) is outside Local vs Base pair.
    await replaceCenterMonacoLine(page, "b", "manual-result");
    await setCompareMode(page, "localBase");

    await expect(sideRow(page, "left", "ours").locator(".nx-stripe")).toBeVisible();
    await expect(
      page
        .locator('[data-testid="pane-center"] .monaco-editor .view-line')
        .filter({ hasText: "manual-result" }),
    ).not.toHaveClass(/nx-monaco-conflict/);
    await expect(
      page.locator('[data-testid="pane-center"] .nx-monaco-stripe-conflict'),
    ).toHaveCount(0);
  });

  test("Repository vs Base highlights repository against base", async ({
    page,
  }) => {
    await setCompareMode(page, "repoBase");

    await expect(page.getByTestId("pane-base-wrap")).toBeVisible();
    const theirsRow = sideRow(page, "right", "theirs");
    await expect(theirsRow.locator(".nx-stripe.nx-conflict")).toBeVisible();
    await expect(sideRow(page, "left", "ours")).not.toHaveClass(/nx-conflict/);
    await expect(sideRow(page, "left", "ours").locator(".nx-stripe")).toHaveCount(
      0,
    );

    // GitView behavior this protects: Repository vs Base compares only Repository and Base.
    const centerConflict = page
      .locator('[data-testid="pane-center"] .monaco-editor .view-line')
      .filter({ hasText: "b" });
    await expect(centerConflict).not.toHaveClass(/nx-monaco-conflict/);
    await expect(
      page.locator('[data-testid="pane-center"] .nx-monaco-stripe-conflict'),
    ).toHaveCount(0);
  });

  test("Local vs Repository highlights both sides without center stripe", async ({
    page,
  }) => {
    await setCompareMode(page, "localRepo");

    await expect(page.getByTestId("merge-pane-grid-wrap")).toHaveAttribute(
      "data-compare-mode",
      "localRepo",
    );
    await expect(sideRow(page, "left", "ours").locator(".nx-stripe")).toBeVisible();
    await expect(
      sideRow(page, "right", "theirs").locator(".nx-stripe"),
    ).toBeVisible();

    const centerConflict = page
      .locator('[data-testid="pane-center"] .monaco-editor .view-line')
      .filter({ hasText: "b" });
    await expect(centerConflict).not.toHaveClass(/nx-monaco-conflict/);
  });

  test("Local vs Middle highlights local against center result", async ({
    page,
  }) => {
    await setCompareMode(page, "localMiddle");

    await expect(sideRow(page, "left", "ours").locator(".nx-stripe")).toBeVisible();
    await expect(
      sideRow(page, "right", "theirs").locator(".nx-stripe"),
    ).toHaveCount(0);
  });

  test("Repository vs Middle highlights repository against center result", async ({
    page,
  }) => {
    await setCompareMode(page, "repoMiddle");

    await expect(
      sideRow(page, "right", "theirs").locator(".nx-stripe"),
    ).toBeVisible();
    await expect(sideRow(page, "left", "ours").locator(".nx-stripe")).toHaveCount(
      0,
    );
  });

  test("manual Monaco edit updates Local vs Middle comparison", async ({
    page,
  }) => {
    await setCompareMode(page, "localMiddle");
    await replaceCenterMonacoLine(page, "b", "manual-result");

    await expect(sideRow(page, "left", "ours").locator(".nx-stripe")).toBeVisible();
    await expect(
      page
        .locator('[data-testid="pane-center"] .monaco-editor .view-line')
        .filter({ hasText: "manual-result" }),
    ).toBeVisible();
  });

  test("reset to default restores normal merge highlighting", async ({
    page,
  }) => {
    await setCompareMode(page, "localRepo");
    await setCompareMode(page, "default");
    await setHighlightingMode(page, "none");
    await setHighlightingMode(page, "lines");

    await expect(page.getByTestId("merge-pane-grid-wrap")).toHaveAttribute(
      "data-compare-mode",
      "default",
    );
    await expect(sideRow(page, "left", "ours")).toHaveClass(/nx-conflict/);
    await expect(
      page.locator('[data-testid="pane-center"] .nx-monaco-stripe-conflict').first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Whitespace policy", () => {
  test.beforeEach(async ({ page }) => {
    const wsFixtures: HostFixtures = {
      ...conflictFixtures,
      mergeDocument: buildWhitespaceDiffDoc(repoRoot, "trailing"),
    };
    await setupMergeFixtures(wsFixtures);
    await installMergeHost(page, wsFixtures);
    await openMergeResolver(page, "src/whitespace.ts");
    await setHighlightingMode(page, "lines");
  });

  test("Do not ignore highlights trailing whitespace differences", async ({
    page,
  }) => {
    await setWhitespacePolicy(page, "doNotIgnore");
    const row = sideRow(page, "left", /line2/);
    await expect(row).toHaveClass(/nx-modified/);
  });

  test("Ignore whitespaces treats whitespace-only lines as equal", async ({
    page,
  }) => {
    await setWhitespacePolicy(page, "ignoreWhitespaces");
    const row = sideRow(page, "left", "line2");
    await expect(row).not.toHaveClass(/nx-modified/);
    await expect(row).not.toHaveClass(/nx-conflict/);
  });

  test("Trim whitespaces ignores leading/trailing-only changes", async ({
    page,
  }) => {
    const indentFixtures: HostFixtures = {
      ...conflictFixtures,
      mergeDocument: buildWhitespaceDiffDoc(repoRoot, "indent"),
    };
    await reopenMergeWithFixtures(page, indentFixtures, "src/whitespace.ts");
    await setHighlightingMode(page, "lines");
    await setWhitespacePolicy(page, "trimWhitespaces");

    const row = sideRow(page, "left", "line2");
    await expect(row).not.toHaveClass(/nx-modified/);
  });
});

test.describe("Highlighting modes", () => {
  test.beforeEach(async ({ page }) => {
    const wordFixtures: HostFixtures = {
      ...conflictFixtures,
      mergeDocument: buildModifiedLineDoc(repoRoot),
    };
    await setupMergeFixtures(wordFixtures);
    await installMergeHost(page, wordFixtures);
    await openMergeResolver(page, "src/words.ts");
  });

  test("Highlight lines colors whole changed rows", async ({ page }) => {
    await setHighlightingMode(page, "lines");
    const row = sideRow(page, "left", "const value = 1");
    await expect(row).toHaveClass(/nx-modified/);
    await expect(
      page.locator('[data-testid="pane-center"] .nx-monaco-stripe-modified').first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Highlight words shows word spans with neutral row background", async ({
    page,
  }) => {
    await setHighlightingMode(page, "words");
    const row = sideRow(page, "left", "const value = 1");
    await expect(row).not.toHaveClass(/nx-modified/);
    await expect(row.locator(".nx-word")).toContainText("value");
    await expect(row.locator(".nx-stripe.nx-modified")).toBeVisible();
  });

  test("Do not highlight removes stripes while content stays visible", async ({
    page,
  }) => {
    await setHighlightingMode(page, "none");
    const row = sideRow(page, "left", "const value = 1");
    await expect(row).not.toHaveClass(/nx-modified/);
    await expect(row.locator(".nx-stripe")).toHaveCount(0);
    await expect(row).toContainText("const value = 1");
  });
});

async function expectPanesNonOverlapping(
  page: import("@playwright/test").Page,
): Promise<void> {
  const left = page.locator('[data-testid="pane-left"]');
  const center = page.locator('[data-testid="pane-center"]');
  const right = page.locator('[data-testid="pane-right"]');

  await expect(left).toBeVisible();
  await expect(center).toBeVisible();
  await expect(right).toBeVisible();

  const boxes = await Promise.all([
    left.boundingBox(),
    center.boundingBox(),
    right.boundingBox(),
  ]);
  for (const box of boxes) {
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThan(50);
    expect(box!.height).toBeGreaterThan(50);
  }

  const [l, c, r] = boxes as NonNullable<
    Awaited<ReturnType<typeof left.boundingBox>>
  >[];
  expect(l.x + l.width).toBeLessThanOrEqual(c.x + 2);
  expect(c.x + c.width).toBeLessThanOrEqual(r.x + 2);
}

test("three merge panes stay visible and non-overlapping at desktop width", async ({
  page,
}) => {
  await openConflictMerge(page);
  await expectPanesNonOverlapping(page);
});

test("three merge panes stay visible and non-overlapping at narrow width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 720, height: 800 });
  await openConflictMerge(page);
  await expectPanesNonOverlapping(page);
});

test("gutter accept action appears on conflict row hover", async ({ page }) => {
  await openConflictMerge(page);
  const row = sideRow(page, "left", "ours");
  await row.hover();
  await expect(
    page.locator('[data-testid="pane-left"]').getByLabel("accept-left"),
  ).toBeVisible();
});