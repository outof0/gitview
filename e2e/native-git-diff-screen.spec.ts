/**
 * Native E2E — Git Diff / Compare screens from VS Code Explorer (real Electron).
 */
import { test } from "@playwright/test";
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
    } finally {
      await closeNativeVsCode(session);
    }
  });

  test("Compare with Revision opens GitView diff panel after quick pick", async () => {
    const session = await launchNativeVsCode();
    try {
      await openExplorerGitAction(
        session,
        TARGET,
        "Compare with Revision...",
      );
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