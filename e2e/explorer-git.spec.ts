/**
 * Explorer Git — strict UI + outcome parity (Vite harness).
 * Every file action must open the correct surface with real content,
 * syntax highlighting, and layout constraints — not just testIds.
 */
import { test, expect } from "@playwright/test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { E2E_REPO_ROOT } from "./helpers/git-actions";
import {
  loadBlameScreenBootstrap,
  loadDiffScreenBootstrap,
  loadHistoryScreenBootstrap,
  openGitBlameScreen,
  openGitDiffScreen,
} from "./helpers/git-screen-bootstrap";
import {
  expectBlameCommitHistoryPanel,
  expectBlameCompactBlockLayout,
  expectGitViewBlameScreen,
  expectGitViewScreen,
} from "./helpers/git-screen-parity";

const TARGET = "services.ts";
const DIFF_MARKER = "explorer diff marker";

test.describe("Explorer Git — file actions", () => {
  test.beforeAll(async () => {
    const absolute = path.join(E2E_REPO_ROOT, TARGET);
    const before = await fs.readFile(absolute, "utf8").catch(() => "");
    if (!before.includes(DIFF_MARKER)) {
      await fs.writeFile(absolute, `${before}\n${DIFF_MARKER}\n`, "utf8");
    }
  });

  test("Annotate — editor gutter + Git Log below", async ({ page }) => {
    const bootstrap = await loadBlameScreenBootstrap(TARGET);
    await openGitBlameScreen(page, bootstrap);

    await expectGitViewBlameScreen(page, {
      relativePath: TARGET,
      contentSample: "class",
    });
    await expectBlameCompactBlockLayout(page, bootstrap.lines);
    await expect(page.getByTestId("git-history-tool-window")).toBeVisible();
  });

  test("Show Diff — compare toolbar, split panes, highlighted delta", async ({
    page,
  }) => {
    const bootstrap = await loadDiffScreenBootstrap(TARGET, DIFF_MARKER);
    await openGitDiffScreen(page, bootstrap);

    await expectGitViewScreen(page, {
      titlePart: "HEAD",
      contains: [DIFF_MARKER, "Working Tree"],
      requireSyntax: true,
    });
  });

  test("Annotate → commit — Git Log pane below", async ({ page }) => {
    const bootstrap = await loadBlameScreenBootstrap(TARGET);
    const history = await loadHistoryScreenBootstrap(TARGET);
    await openGitBlameScreen(page, bootstrap, history);

    await page.getByTestId(/^blame-sha-/).first().click();
    await expectBlameCommitHistoryPanel(page);
  });
});