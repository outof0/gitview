/**
 * E2E: per-block resolve + scroll (no blocking dialogs).
 */
import { test, expect } from "@playwright/test";
import {
  loadRealBlame,
  loadRealFileLog,
  loadRealChangesFromSide,
  loadRealMergeDocument,
} from "./helpers/real-repo";
import type { HostFixtures } from "./helpers/host";
import {
  applyButton,
  buildComplexConflictDoc,
  buildMixedNonConflictingDoc,
  buildSimpleConflictDoc,
  buildTallConflictDoc,
  withUnresolvedNonConflicting,
  clearPostedMessages,
  expectApplyFinishes,
  installMergeHost,
  openMergeResolver,
  setupMergeFixtures,
  expandAllCollapsed,
  getPostedMessages,
  wheelScrollPane,
  expectNoBlockingAlerts,
} from "./helpers/merge";
import { expectCenterLine } from "./helpers/menus";

let fixtures: HostFixtures;

function sideBlock(
  page: import("@playwright/test").Page,
  side: "left" | "right",
  text: string,
) {
  return page
    .locator(`[data-testid="pane-${side}"] .nx-block`)
    .filter({ hasText: text });
}

function centerLine(page: import("@playwright/test").Page, text: string) {
  return page
    .locator('[data-testid="pane-center"] .monaco-editor .view-line')
    .filter({ hasText: text });
}

async function expectMonacoSyntaxTokens(
  page: import("@playwright/test").Page,
): Promise<void> {
  await expect(page.locator('[data-testid="pane-center"]')).toHaveClass(
    /nx-monaco-center/,
  );
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
    .toBeGreaterThan(1);
}

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

test.describe("Merge resolve", () => {
  test.beforeEach(async ({ page }) => {
    await installMergeHost(page, fixtures);
    await openMergeResolver(page, "src/app.ts");
  });

  test("unresolved conflict shows base in center, not side texts", async ({
    page,
  }) => {
    const center = page.locator('[data-testid="pane-center"]');
    await expect(center.getByText("b", { exact: true })).toBeVisible();
    await expect(center.getByText("ours", { exact: true })).toHaveCount(0);
    await expect(center.getByText("theirs", { exact: true })).toHaveCount(0);
    await expect(
      page.locator('[data-testid="conflict-counter"]'),
    ).toContainText(/1 conflict\./i);
    await expect(applyButton(page)).toBeDisabled();
  });

  test("accept-left keeps repository available to append or ignore", async ({
    page,
  }) => {
    const left = page.locator('[data-testid="pane-left"]');
    const right = page.locator('[data-testid="pane-right"]');
    await left.getByLabel("accept-left").click();

    const center = page.locator('[data-testid="pane-center"]');
    await expect(center.getByText("ours", { exact: true })).toBeVisible();
    await expect(center.getByText("b", { exact: true })).toHaveCount(0);

    await expect(
      page.locator('[data-testid="conflict-counter"]'),
    ).toContainText(/1 conflict\./i);
    await expect(applyButton(page)).toBeDisabled();
    await expect(left.getByLabel("accept-left")).toHaveCount(0);
    await expect(right.getByLabel("accept-right")).toHaveAttribute(
      "title",
      "Append Right Side",
    );
    await expect(right.getByLabel("ignore")).toBeVisible();

    await right.getByLabel("ignore").click();
    await expect(
      page.locator('[data-testid="conflict-counter"]'),
    ).toContainText(/0 conflict/i);
    await expect(applyButton(page)).toBeEnabled();
    await expect(
      page.locator('[data-testid="merge-status-message"]'),
    ).toHaveCount(0);
    await expectNoBlockingAlerts(page);
  });

  test("context menu Accept Local keeps repository side pending", async ({
    page,
  }) => {
    const left = page.locator('[data-testid="pane-left"]');
    await page
      .locator('[data-testid="pane-center"]')
      .getByText("b", { exact: true })
      .click({ button: "right" });
    await page.getByTestId("merge-context-accept-local").click();

    const center = page.locator('[data-testid="pane-center"]');
    await expect(center.getByText("ours", { exact: true })).toBeVisible();
    await expect(
      page.locator('[data-testid="conflict-counter"]'),
    ).toContainText(/1 conflict\./i);
    await expect(applyButton(page)).toBeDisabled();
    await expect(left.getByLabel("accept-left")).toHaveCount(0);
    await expect(
      page.locator('[data-testid="pane-right"]').getByLabel("accept-right"),
    ).toHaveAttribute("title", "Append Right Side");
  });

  test("context menu Resolve Using Local finishes the active conflict", async ({
    page,
  }) => {
    await page
      .locator('[data-testid="pane-center"]')
      .getByText("b", { exact: true })
      .click({ button: "right" });
    await page.getByTestId("merge-context-resolve-local").click();

    const center = page.locator('[data-testid="pane-center"]');
    await expect(center.getByText("ours", { exact: true })).toBeVisible();
    await expect(center.getByText("theirs", { exact: true })).toHaveCount(0);
    await expect(
      page.locator('[data-testid="conflict-counter"]'),
    ).toContainText(/0 conflict/i);
    await expect(applyButton(page)).toBeEnabled();

    page.once("dialog", async (dialog) => {
      await dialog.accept();
    });
    await applyButton(page).click();
    await expectApplyFinishes(page, "src/app.ts");
  });

  test("resolved conflict context menu shows only Reset", async ({ page }) => {
    await page
      .locator('[data-testid="pane-center"]')
      .getByText("b", { exact: true })
      .click({ button: "right" });
    await page.getByTestId("merge-context-resolve-local").click();

    await page
      .locator('[data-testid="pane-center"]')
      .getByText("ours", { exact: true })
      .click({ button: "right" });

    await expect(page.getByTestId("merge-context-reset")).toBeVisible();
    await expect(page.getByTestId("merge-context-accept-local")).toHaveCount(0);
    await expect(page.getByTestId("merge-context-append-local")).toHaveCount(0);
    await expect(page.getByTestId("merge-context-ignore-local")).toHaveCount(0);
    await expect(page.getByTestId("merge-context-resolve-local")).toHaveCount(0);
  });

  test("context menu Reset restores the unresolved base result", async ({
    page,
  }) => {
    const left = page.locator('[data-testid="pane-left"]');
    await left.getByLabel("accept-left").click();
    await page
      .locator('[data-testid="pane-center"]')
      .getByText("ours", { exact: true })
      .click({ button: "right" });
    await page.getByTestId("merge-context-reset").click();

    const center = page.locator('[data-testid="pane-center"]');
    await expect(center.getByText("b", { exact: true })).toBeVisible();
    await expect(
      page.locator('[data-testid="conflict-counter"]'),
    ).toContainText(/1 conflict\./i);
    await expect(applyButton(page)).toBeDisabled();
  });

  test("accept-right keeps local available to append or ignore", async ({
    page,
  }) => {
    const left = page.locator('[data-testid="pane-left"]');
    const right = page.locator('[data-testid="pane-right"]');

    await right.getByLabel("accept-right").click();

    const center = page.locator('[data-testid="pane-center"]');
    await expect(center.getByText("theirs", { exact: true })).toBeVisible();
    await expect(center.getByText("ours", { exact: true })).toHaveCount(0);

    await expect(
      page.locator('[data-testid="conflict-counter"]'),
    ).toContainText(/1 conflict\./i);
    await expect(applyButton(page)).toBeDisabled();
    await expect(left.getByLabel("accept-left")).toHaveAttribute(
      "title",
      "Append Left Side",
    );
    await expect(left.getByLabel("ignore")).toBeVisible();

    await left.getByLabel("ignore").click();
    await expect(
      page.locator('[data-testid="conflict-counter"]'),
    ).toContainText(/0 conflict/i);
    await expect(applyButton(page)).toBeEnabled();
    await expectNoBlockingAlerts(page);
  });

  test("ignore-left keeps base in center until other side is handled", async ({
    page,
  }) => {
    const left = page.locator('[data-testid="pane-left"]');
    await left.getByLabel("ignore").click();

    const center = page.locator('[data-testid="pane-center"]');
    await expect(center.getByText("b", { exact: true })).toBeVisible();
    await expect(
      page.locator('[data-testid="conflict-counter"]'),
    ).toContainText(/1 conflict\./i);
    await expectNoBlockingAlerts(page);
  });

  test("ignore both sides resolves to base with zero conflicts", async ({
    page,
  }) => {
    const left = page.locator('[data-testid="pane-left"]');
    const right = page.locator('[data-testid="pane-right"]');

    await left.getByLabel("ignore").click();
    await right.getByLabel("ignore").click();

    const center = page.locator('[data-testid="pane-center"]');
    await expect(center.getByText("b", { exact: true })).toBeVisible();
    await expect(
      page.locator('[data-testid="conflict-counter"]'),
    ).toContainText(/0 conflict/i);
    await expect(applyButton(page)).toBeEnabled();
    await expectNoBlockingAlerts(page);
  });

  test("keyboard accept-both keeps both sides and resolves", async ({
    page,
  }) => {
    await sideBlock(page, "left", "ours").click();
    await page.keyboard.press("Alt+3");

    const center = page.locator('[data-testid="pane-center"]');
    await expect(center.getByText("ours", { exact: true })).toBeVisible();
    await expect(center.getByText("theirs", { exact: true })).toBeVisible();

    await expect(
      page.locator('[data-testid="conflict-counter"]'),
    ).toContainText(/0 conflict/i);
    await expect(applyButton(page)).toBeEnabled();
  });

});

test.describe("Complex merge resolve", () => {
  test("multi-change file resolves each block once and keeps Monaco formatting", async ({
    page,
  }) => {
    const baseDoc = await loadRealMergeDocument();
    const complexFixtures: HostFixtures = {
      ...fixtures,
      mergeDocument: buildComplexConflictDoc(baseDoc.repoRoot),
      settings: { confirmBeforeMarkResolved: false },
    };
    await installMergeHost(page, complexFixtures);
    await openMergeResolver(page, "src/complex.ts");
    await clearPostedMessages(page);
    await expectMonacoSyntaxTokens(page);

    await expect(
      page.locator('[data-testid="conflict-counter"]'),
    ).toContainText(/4 conflict/i);
    await expect(applyButton(page)).toBeDisabled();

    const serverLeft = sideBlock(page, "left", 'host: "localhost"');
    const serverRight = sideBlock(page, "right", 'host: "0.0.0.0"');
    await serverLeft
      .locator(".nx-txt", { hasText: 'host: "localhost"' })
      .first()
      .click();
    await serverLeft.getByLabel("accept-left").click();
    await expect(
      page.locator('[data-testid="conflict-counter"]'),
    ).toContainText(/4 conflict/i);
    await expect(serverLeft.getByLabel("accept-left")).toHaveCount(0);
    await expect(serverRight.getByLabel("accept-right")).toHaveAttribute(
      "title",
      "Append Right Side",
    );
    await expectMonacoSyntaxTokens(page);

    await serverRight.getByLabel("ignore").click();
    await expect(
      page.locator('[data-testid="conflict-counter"]'),
    ).toContainText(/3 conflict/i);
    await page.keyboard.press("Alt+2");
    await expect(
      page.locator('[data-testid="conflict-counter"]'),
    ).toContainText(/3 conflict/i);
    await expect(centerLine(page, 'host: "localhost"')).toHaveCount(1);
    await expect(centerLine(page, 'host: "0.0.0.0"')).toHaveCount(0);
    await expect(serverLeft.getByLabel("accept-left")).toHaveCount(0);
    await expect(serverRight.getByLabel("accept-right")).toHaveCount(0);
    await expectMonacoSyntaxTokens(page);

    const alphaRight = sideBlock(page, "right", "alpha-remote");
    const alphaLeft = sideBlock(page, "left", "alpha-local");
    await alphaRight.getByLabel("accept-right").click();
    await expect(
      page.locator('[data-testid="conflict-counter"]'),
    ).toContainText(/3 conflict/i);
    await expect(alphaLeft.getByLabel("accept-left")).toHaveAttribute(
      "title",
      "Append Left Side",
    );
    await alphaLeft.getByLabel("ignore").click();
    await expect(
      page.locator('[data-testid="conflict-counter"]'),
    ).toContainText(/2 conflict/i);
    await expectMonacoSyntaxTokens(page);

    const betaLeft = sideBlock(page, "left", "local-on");
    const betaRight = sideBlock(page, "right", "remote-on");
    await betaLeft.getByLabel("accept-left").click();
    await expect(
      page.locator('[data-testid="conflict-counter"]'),
    ).toContainText(/2 conflict/i);
    await expect(betaRight.getByLabel("accept-right")).toHaveAttribute(
      "title",
      "Append Right Side",
    );
    await betaRight.getByLabel("accept-right").click();
    await expect(
      page.locator('[data-testid="conflict-counter"]'),
    ).toContainText(/1 conflict/i);
    await expectMonacoSyntaxTokens(page);

    const gammaRight = sideBlock(page, "right", "remote-gamma");
    const gammaLeft = sideBlock(page, "left", "local-gamma");
    await gammaRight.getByLabel("accept-right").click();
    await expect(
      page.locator('[data-testid="conflict-counter"]'),
    ).toContainText(/1 conflict/i);
    await gammaLeft.getByLabel("ignore").click();
    await expect(
      page.locator('[data-testid="conflict-counter"]'),
    ).toContainText(/0 conflict/i);
    await expect(applyButton(page)).toBeEnabled();
    await expectMonacoSyntaxTokens(page);

    await applyButton(page).click();
    const posted = await getPostedMessages(page);
    const resolved = posted.find((msg) => msg.type === "merge.markResolved");
    expect(resolved).toBeTruthy();
    const content = resolved?.payload?.content as string;
    expect(content).toContain('host: "localhost"');
    expect(content).toContain("port: 5173");
    expect(content).toContain("alpha-remote");
    expect(content).toContain("value + 2");
    expect(content).toContain("local-on");
    expect(content).toContain("remote-on");
    expect(content).toContain("value - 2");
    expect(content).toContain("remote-gamma");
    expect(content).not.toContain("<<<<<<<");
    expect(content).not.toContain('host: "0.0.0.0"');
    expect(content).not.toContain("alpha-local");

    // GitView behavior this protects: Apply finishes — resolver closes, file leaves list.
    await expectApplyFinishes(page, "src/complex.ts");
  });
});

test.describe("Non-conflicting and simple-conflict workflows", () => {
  test("apply non-conflicting from left resolves only local-side blocks", async ({
    page,
  }) => {
    const baseDoc = await loadRealMergeDocument();
    const complexFixtures: HostFixtures = {
      ...fixtures,
      mergeDocument: withUnresolvedNonConflicting(
        buildComplexConflictDoc(baseDoc.repoRoot),
      ),
    };
    await installMergeHost(page, complexFixtures);
    await openMergeResolver(page, "src/complex.ts");

    await expect(
      page.getByLabel("Apply non-conflicting from left"),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="conflict-counter"]'),
    ).toContainText(/4 conflict/i);

    await page.getByLabel("Apply non-conflicting from left").click();

    await expect(
      page.locator('[data-testid="pane-center"]').getByText("value + 2", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="conflict-counter"]'),
    ).toContainText(/4 conflict/i);
    await expect(applyButton(page)).toBeDisabled();
  });

  test("apply non-conflicting from right resolves only repository-side blocks", async ({
    page,
  }) => {
    const baseDoc = await loadRealMergeDocument();
    const complexFixtures: HostFixtures = {
      ...fixtures,
      mergeDocument: withUnresolvedNonConflicting(
        buildComplexConflictDoc(baseDoc.repoRoot),
      ),
    };
    await installMergeHost(page, complexFixtures);
    await openMergeResolver(page, "src/complex.ts");

    await page.getByLabel("Apply non-conflicting from right").click();

    const center = page.locator('[data-testid="pane-center"]');
    const left = page.locator('[data-testid="pane-left"]');
    await expect(center.getByText("value - 2", { exact: false })).toBeVisible();
    await expect(left.getByText("value + 2", { exact: false })).toBeVisible();
    await expect(
      page.getByLabel("Apply non-conflicting from left"),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="conflict-counter"]'),
    ).toContainText(/4 conflict/i);
    await expect(applyButton(page)).toBeDisabled();
  });

  test("apply all non-conflicting resolves local and repository-side blocks", async ({
    page,
  }) => {
    const baseDoc = await loadRealMergeDocument();
    const complexFixtures: HostFixtures = {
      ...fixtures,
      mergeDocument: withUnresolvedNonConflicting(
        buildComplexConflictDoc(baseDoc.repoRoot),
      ),
    };
    await installMergeHost(page, complexFixtures);
    await openMergeResolver(page, "src/complex.ts");

    await page.getByLabel("Apply all non-conflicting").click();

    const center = page.locator('[data-testid="pane-center"]');
    await expect(center.getByText("value + 2", { exact: false })).toBeVisible();
    await expect(center.getByText("value - 2", { exact: false })).toBeVisible();
    await expect(
      page.locator('[data-testid="conflict-counter"]'),
    ).toContainText(/4 conflict/i);
    await expect(applyButton(page)).toBeDisabled();
  });

  test("resolve simple conflicts leaves real conflicts untouched", async ({
    page,
  }) => {
    const baseDoc = await loadRealMergeDocument();
    const mixedFixtures: HostFixtures = {
      ...fixtures,
      mergeDocument: buildMixedNonConflictingDoc(baseDoc.repoRoot),
    };
    await installMergeHost(page, mixedFixtures);
    await openMergeResolver(page, "src/mixed.ts");

    await expect(
      page.getByLabel("Resolve simple conflicts"),
    ).toBeVisible();
    await page.getByLabel("Resolve simple conflicts").click();

    await expect(
      page.locator('[data-testid="conflict-counter"]'),
    ).toContainText(/1 conflict/i);
    await expect(
      page.locator('[data-testid="pane-center"]').getByText("both", {
        exact: true,
      }),
    ).toBeVisible();
  });
});

test.describe("Merge keyboard navigation", () => {
  test.describe("simple conflict", () => {
    test.beforeEach(async ({ page }) => {
      await installMergeHost(page, fixtures);
      await openMergeResolver(page, "src/app.ts");
    });

  test("Ctrl+click accept-left on fresh conflict does not resolve both sides", async ({
    page,
  }) => {
    const mod = process.platform === "darwin" ? "Meta" : "Control";
    await page
      .locator('[data-testid="pane-left"]')
      .getByLabel("accept-left")
      .click({ modifiers: [mod] });

    await expect(
      page.locator('[data-testid="conflict-counter"]'),
    ).toContainText(/1 conflict/i);
    await expectCenterLine(page, "ours");
    await expectCenterLine(page, "theirs", { visible: false });
  });

  test("Alt+Shift+1 appends local after repository partial accept", async ({
    page,
  }) => {
    await sideBlock(page, "right", "theirs").click();
    await page.keyboard.press("Alt+2");
    await page.keyboard.press("Alt+Shift+1");
    await expect(
      page.locator('[data-testid="conflict-counter"]'),
    ).toContainText(/0 conflict/i);
    const center = page.locator('[data-testid="pane-center"]');
    await expect(center.getByText("ours", { exact: true })).toBeVisible();
    await expect(center.getByText("theirs", { exact: true })).toBeVisible();
  });

  test("Alt+1 accepts the local side of the active conflict (partial)", async ({
    page,
  }) => {
    await sideBlock(page, "left", "ours").click();
    await page.keyboard.press("Alt+1");
    await expect(centerLine(page, "ours")).toBeVisible();
    await expect(
      page.locator('[data-testid="conflict-counter"]'),
    ).toContainText(/1 conflict/i);
  });

  test("Alt+2 accepts the repository side of the active conflict (partial)", async ({
    page,
  }) => {
    await sideBlock(page, "right", "theirs").click();
    await page.keyboard.press("Alt+2");
    await expect(centerLine(page, "theirs")).toBeVisible();
    await expect(
      page.locator('[data-testid="conflict-counter"]'),
    ).toContainText(/1 conflict/i);
  });

  test("Ctrl+F opens the search panel", async ({ page }) => {
    await page.evaluate(() => {
      const mac = navigator.platform.includes("Mac");
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "f",
          ctrlKey: !mac,
          metaKey: mac,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    await expect(page.getByTestId("search-panel")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "find" })).toBeVisible();
  });
  });

  test.describe("complex file", () => {
    test.beforeEach(async ({ page }) => {
      const baseDoc = await loadRealMergeDocument();
      const complexFixtures: HostFixtures = {
        ...fixtures,
        mergeDocument: buildComplexConflictDoc(baseDoc.repoRoot),
      };
      await installMergeHost(page, complexFixtures);
      await openMergeResolver(page, "src/complex.ts");
    });

    test("F7 and Shift+F7 move between differences", async ({ page }) => {
      await expandAllCollapsed(page);

      const getActiveBlockId = () =>
        page.evaluate(() => {
          const el = document.querySelector(
            '[data-testid="pane-left"] .nx-block.nx-active',
          );
          return el?.getAttribute("data-block") ?? null;
        });

      await page.keyboard.press("F7");
      const firstActive = await getActiveBlockId();
      expect(firstActive).toBeTruthy();

      await page.keyboard.press("F7");
      const secondActive = await getActiveBlockId();
      expect(secondActive).toBeTruthy();
      expect(secondActive).not.toBe(firstActive);

      await page.keyboard.press("Shift+F7");
      const backActive = await getActiveBlockId();
      expect(backActive).toBe(firstActive);
    });

    test("toolbar prev/next buttons change the active difference", async ({
      page,
    }) => {
      await expandAllCollapsed(page);

      const getActiveBlockId = () =>
        page.evaluate(() => {
          const el = document.querySelector(
            '[data-testid="pane-left"] .nx-block.nx-active',
          );
          return el?.getAttribute("data-block") ?? null;
        });

      await page.getByLabel("Next difference").click();
      const first = await getActiveBlockId();
      expect(first).toBeTruthy();

      await page.getByLabel("Next difference").click();
      const second = await getActiveBlockId();
      expect(second).toBeTruthy();
      expect(second).not.toBe(first);

      await page.getByLabel("Previous difference").click();
      expect(await getActiveBlockId()).toBe(first);
    });

    test("Alt+ArrowDown and Alt+ArrowUp jump between unresolved conflicts", async ({
      page,
    }) => {
      await expandAllCollapsed(page);

      const getActiveBlockId = () =>
        page.evaluate(() => {
          const el = document.querySelector(
            '[data-testid="pane-left"] .nx-block.nx-active',
          );
          return el?.getAttribute("data-block") ?? null;
        });

      await page.keyboard.press("Alt+ArrowDown");
      const first = await getActiveBlockId();
      expect(first).toBeTruthy();

      await page.keyboard.press("Alt+ArrowDown");
      const second = await getActiveBlockId();
      expect(second).toBeTruthy();
      expect(second).not.toBe(first);

      await page.keyboard.press("Alt+ArrowUp");
      expect(await getActiveBlockId()).toBe(first);
    });
  });

  test.describe("next conflict file", () => {
    test("F7 at last difference opens the next conflict file when setting is enabled", async ({
      page,
    }) => {
      const baseDoc = await loadRealMergeDocument();
      const fileA = buildSimpleConflictDoc({
        repoRoot: baseDoc.repoRoot,
        relativePath: "src/nav-a.ts",
      });
      const fileB = buildSimpleConflictDoc({
        repoRoot: baseDoc.repoRoot,
        relativePath: "src/nav-b.ts",
      });
      const navFixtures: HostFixtures = {
        ...fixtures,
        mergeDocument: fileA,
        mergeDocumentsByPath: {
          "src/nav-a.ts": fileA,
          "src/nav-b.ts": fileB,
        },
        conflictFiles: [
          { relativePath: "src/nav-a.ts", stageCode: "UU" },
          { relativePath: "src/nav-b.ts", stageCode: "UU" },
        ],
        settings: { goToNextFileAfterLastChange: true },
      };
      await installMergeHost(page, navFixtures);
      await openMergeResolver(page, "src/nav-a.ts");
      await expandAllCollapsed(page);

      await page.keyboard.press("F7");
      await page.keyboard.press("F7");

      await expect(
        page.getByText("Resolve Conflicts — src/nav-b.ts"),
      ).toBeVisible();
    });

    test("F7 at last difference wraps within file when next-file setting is off", async ({
      page,
    }) => {
      const baseDoc = await loadRealMergeDocument();
      const fileA = buildSimpleConflictDoc({
        repoRoot: baseDoc.repoRoot,
        relativePath: "src/wrap-a.ts",
      });
      const fileB = buildSimpleConflictDoc({
        repoRoot: baseDoc.repoRoot,
        relativePath: "src/wrap-b.ts",
      });
      const navFixtures: HostFixtures = {
        ...fixtures,
        mergeDocument: fileA,
        mergeDocumentsByPath: {
          "src/wrap-a.ts": fileA,
          "src/wrap-b.ts": fileB,
        },
        conflictFiles: [
          { relativePath: "src/wrap-a.ts", stageCode: "UU" },
          { relativePath: "src/wrap-b.ts", stageCode: "UU" },
        ],
        settings: { goToNextFileAfterLastChange: false },
      };
      await installMergeHost(page, navFixtures);
      await openMergeResolver(page, "src/wrap-a.ts");
      await expandAllCollapsed(page);

      const getActiveBlockId = () =>
        page.evaluate(() => {
          const el = document.querySelector(
            '[data-testid="pane-left"] .nx-block.nx-active',
          );
          return el?.getAttribute("data-block") ?? null;
        });

      await page.keyboard.press("F7");
      const first = await getActiveBlockId();
      expect(first).toBeTruthy();

      await page.keyboard.press("F7");
      expect(await getActiveBlockId()).toBe(first);
      await expect(
        page.getByText("Resolve Conflicts — src/wrap-a.ts"),
      ).toBeVisible();
    });
  });
});

test.describe("Merge scroll", () => {
  test("center pane scrolls when wheeling over Monaco on a tall file", async ({
    page,
  }) => {
    const baseDoc = await loadRealMergeDocument();
    const tallFixtures: HostFixtures = {
      ...fixtures,
      mergeDocument: buildTallConflictDoc(baseDoc.repoRoot),
    };
    await installMergeHost(page, tallFixtures);
    await openMergeResolver(page, "src/long.ts");
    await expandAllCollapsed(page);

    const center = page.locator('[data-testid="pane-center"]');
    const metrics = await center.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);

    const { before, after } = await wheelScrollPane(page, center, 600);
    expect(after).toBeGreaterThan(before);
  });

  test("F7 scrolls the active difference into view on a tall file", async ({
    page,
  }) => {
    const baseDoc = await loadRealMergeDocument();
    const tallFixtures: HostFixtures = {
      ...fixtures,
      mergeDocument: buildTallConflictDoc(baseDoc.repoRoot),
    };
    await installMergeHost(page, tallFixtures);
    await openMergeResolver(page, "src/long.ts");
    await expandAllCollapsed(page);

    const leftEditor = page.locator('[data-testid="pane-left"]');

    const isActivePartiallyVisible = () =>
      page.evaluate(() => {
        const active = document.querySelector(
          '[data-testid="pane-left"] .nx-block.nx-active',
        );
        const scroll = document.querySelector('[data-testid="pane-left"]');
        if (!active || !scroll) {
          return false;
        }
        const a = active.getBoundingClientRect();
        const s = scroll.getBoundingClientRect();
        return a.bottom > s.top + 4 && a.top < s.bottom - 4;
      });

    // Pin to top — conflict sits below the prefix and should be off-screen.
    await leftEditor.evaluate((el) => {
      el.scrollTop = 0;
    });
    const scrollAtTop = await leftEditor.evaluate((el) => el.scrollTop);
    expect(scrollAtTop).toBe(0);
    await expect
      .poll(isActivePartiallyVisible, { timeout: 2000 })
      .toBe(false);

    await page.keyboard.press("F7");
    await expect
      .poll(isActivePartiallyVisible, { timeout: 8000 })
      .toBe(true);

    await expect
      .poll(
        async () =>
          leftEditor.evaluate((el) => el.scrollTop),
        { timeout: 8000 },
      )
      .toBeGreaterThan(scrollAtTop);
  });

  test("center scroll syncs left pane", async ({ page }) => {
    const baseDoc = await loadRealMergeDocument();
    const tallFixtures: HostFixtures = {
      ...fixtures,
      mergeDocument: buildTallConflictDoc(baseDoc.repoRoot),
    };
    await installMergeHost(page, tallFixtures);
    await openMergeResolver(page, "src/long.ts");
    await expandAllCollapsed(page);

    const center = page.locator('[data-testid="pane-center"]');
    const left = page.locator('[data-testid="pane-left"]');

    const leftBefore = await left.evaluate((el) => el.scrollTop);
    await wheelScrollPane(page, center, 800);
    const leftAfter = await left.evaluate((el) => el.scrollTop);

    expect(leftAfter).toBeGreaterThan(leftBefore);
  });
});
