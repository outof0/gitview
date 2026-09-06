/**
 * Native E2E — Git Diff / Compare screens from VS Code Explorer (real Electron).
 */
import { expect, test } from "@playwright/test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  acceptQuickPick,
  closeNativeVsCode,
  launchNativeVsCode,
  prepareCleanGitRepo,
  TEST_WORKSPACE,
} from "./helpers/native-vscode";
import {
  expectGitViewScreen,
  openExplorerGitAction,
  waitForGitViewFrame,
} from "./helpers/git-screen-parity";
import { expectUiSurfaceAccessible } from "./helpers/ui-system-contracts";

const TARGET = "README.md";
const MARKER = "native diff screen marker";

test.describe.configure({ mode: "serial" });

test.describe("Native — Git Diff screen", () => {
  test.beforeEach(async () => {
    await prepareCleanGitRepo();
    await fs.appendFile(
      path.join(TEST_WORKSPACE, TARGET),
      `\n${MARKER}\n`,
      "utf8",
    );
  });

  test.afterEach(async () => {
    await fs
      .readFile(path.join(TEST_WORKSPACE, TARGET), "utf8")
      .then(async (content) => {
        await fs.writeFile(
          path.join(TEST_WORKSPACE, TARGET),
          content.replace(`\n${MARKER}\n`, "\n"),
          "utf8",
        );
      })
      .catch(() => undefined);
  });

  test("Show Diff opens GitView diff panel with working-tree delta", async () => {
    const session = await launchNativeVsCode();
    try {
      await openExplorerGitAction(session, TARGET, "Show Diff");
      const frame = await waitForGitViewFrame(session.app);
      await expectGitViewScreen(frame, {
        titlePart: "HEAD",
        contains: [MARKER],
      });
      await expect(
        frame.locator(
          ".nx-monaco-diff-host .cmdr.monaco-diff-added, .nx-monaco-diff-host .cdr.monaco-diff-added",
        ).first(),
      ).toBeVisible();
      await expect(
        frame.locator(
          ".nx-monaco-diff-host .cldr.monaco-diff-added-gutter",
        ).first(),
      ).toBeVisible();
      await frame.getByTestId("git-diff-next-difference").click();
      await expect(
        frame.locator(
          ".nx-monaco-diff-host .cmdr.monaco-diff-active, .nx-monaco-diff-host .cdr.monaco-diff-active",
        ).first(),
      ).toBeVisible();
      await expectUiSurfaceAccessible(frame, "git-diff-app");
      await expect(frame.getByTestId("git-diff-whitespace")).toBeHidden();
      await frame.getByTestId("git-diff-view-options").click();
      await expect(
        frame.getByTestId("git-diff-view-options-trimWhitespaces"),
      ).toBeVisible();
      await expect(
        frame.getByTestId("git-diff-view-options-sideBySide"),
      ).toBeVisible();
    } finally {
      await closeNativeVsCode(session);
    }
  });

  test("Compare with Revision opens GitView diff panel after quick pick", async () => {
    const session = await launchNativeVsCode();
    try {
      await openExplorerGitAction(session, TARGET, "Compare with Revision...");
      await session.page.waitForTimeout(600);
      await acceptQuickPick(session.page);
      const frame = await waitForGitViewFrame(session.app);
      await expectGitViewScreen(frame, { titlePart: "Working Tree" });
    } finally {
      await closeNativeVsCode(session);
    }
  });

  test("Compare with Branch opens GitView diff panel after branch pick", async () => {
    const session = await launchNativeVsCode();
    try {
      await openExplorerGitAction(session, TARGET, "Compare with Branch...");
      await session.page.waitForTimeout(600);
      await acceptQuickPick(session.page, "feature");
      const frame = await waitForGitViewFrame(session.app);
      await expectGitViewScreen(frame, { titlePart: "Working Tree" });
    } finally {
      await closeNativeVsCode(session);
    }
  });
});
