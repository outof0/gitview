/**
 * Native E2E — clicking the GitView activity-bar icon while the worktree is
 * dirty keeps a Commit sidebar open next to the log-only bottom panel. Opening
 * a diff tab must not cover that sidebar.
 */
import { expect, test } from "@playwright/test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  closeNativeVsCode,
  findWebviewFrame,
  launchNativeVsCode,
  openGitViewActivityBar,
  openGitWorkspace,
  prepareCleanGitRepo,
  prepareMergeRepo,
  TEST_WORKSPACE,
  waitForWebviewFrame,
} from "./helpers/native-vscode";
import { expectGitViewScreen } from "./helpers/git-screen-parity";

const TARGET = "README.md";
const MARKER = "native commit sidebar marker";

test.describe.configure({ mode: "serial" });

test("Cmd+D from the first selected sidebar change opens its diff", async ({
  browserName: _browserName,
}, testInfo) => {
  test.setTimeout(120_000);
  await prepareCleanGitRepo();
  await fs.appendFile(
    path.join(TEST_WORKSPACE, TARGET),
    `\n${MARKER} first shortcut\n`,
    "utf8",
  );

  const session = await launchNativeVsCode(TEST_WORKSPACE, {
    settings: {
      "git.autofetch": false,
      "gitView.protectedBranchPatterns": [],
    },
    width: 1400,
    height: 900,
  });
  try {
    await openGitViewActivityBar(session.page);
    const sidebar = await waitForWebviewFrame(
      session.app,
      "commit-sidebar-header",
    );
    const row = sidebar.getByTestId(`change-row-${TARGET}`);
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.click();
    await session.page.keyboard.press("ControlOrMeta+d");

    const diff = await waitForWebviewFrame(session.app, "git-diff-app");
    await expectGitViewScreen(diff, {
      titlePart: "HEAD",
      contains: [`${MARKER} first shortcut`],
    });
    await session.page.screenshot({
      path: testInfo.outputPath("git-commit-sidebar-cmd-d-first.png"),
      animations: "disabled",
    });
  } finally {
    await closeNativeVsCode(session);
    await prepareCleanGitRepo();
  }
});

test("Cmd+D from a conflicted sidebar change opens diff, not the resolver", async ({
  browserName: _browserName,
}, testInfo) => {
  test.setTimeout(120_000);
  await prepareMergeRepo();

  const session = await launchNativeVsCode(TEST_WORKSPACE, {
    settings: {
      "git.autofetch": false,
      "gitView.protectedBranchPatterns": [],
    },
    width: 1400,
    height: 900,
  });
  try {
    await openGitViewActivityBar(session.page);
    const sidebar = await waitForWebviewFrame(
      session.app,
      "commit-sidebar-header",
    );
    const row = sidebar.getByTestId("change-row-file.txt");
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.click();
    await session.page.keyboard.press("ControlOrMeta+d");

    const diff = await waitForWebviewFrame(session.app, "git-diff-app");
    await expectGitViewScreen(diff, {
      titlePart: "HEAD",
      contains: ["line1"],
    });
    expect(await findWebviewFrame(session.app, "pane-left")).toBeNull();
    await session.page.screenshot({
      path: testInfo.outputPath("git-commit-sidebar-conflict-cmd-d.png"),
      animations: "disabled",
    });
  } finally {
    await closeNativeVsCode(session);
  }
});

test("GitView icon shows the Commit sidebar when there are local changes", async ({
  browserName: _browserName,
}, testInfo) => {
  test.setTimeout(120_000);
  await prepareCleanGitRepo();
  await fs.appendFile(
    path.join(TEST_WORKSPACE, TARGET),
    `\n${MARKER}\n`,
    "utf8",
  );

  const session = await launchNativeVsCode(TEST_WORKSPACE, {
    settings: {
      "git.autofetch": false,
      "gitView.protectedBranchPatterns": [],
    },
    width: 1400,
    height: 900,
  });
  try {
    await openGitViewActivityBar(session.page);

    const sidebarPart = session.page.locator(".part.sidebar");
    await expect(sidebarPart).toBeVisible({ timeout: 20_000 });
    await expect
      .poll(async () => (await sidebarPart.boundingBox())?.width ?? 0)
      .toBeGreaterThan(200);

    let sidebar = await waitForWebviewFrame(
      session.app,
      "commit-sidebar-header",
    );
    await expect(sidebar.getByTestId("commit-sidebar-tab-commit")).toBeVisible({
      timeout: 15_000,
    });
    await expect(sidebar.getByTestId("commit-toolbar")).toBeVisible();
    await expect(sidebar.getByTestId("workspace-changes")).toBeVisible();
    await expect(sidebar.getByTestId(`change-row-${TARGET}`)).toBeVisible();
    await expect(sidebar.getByTestId("gitview-commit-panel")).toBeVisible();
    await expect(sidebar.getByTestId("workspace-tab-log")).toHaveCount(0);

    await sidebar.getByTestId("commit-toolbar-collapse-all").click();
    await expect(sidebar.getByTestId(`change-row-${TARGET}`)).toHaveCount(0);
    await sidebar.getByTestId("commit-toolbar-expand-all").click();
    await expect(sidebar.getByTestId(`change-row-${TARGET}`)).toBeVisible();

    await sidebar.getByTestId("commit-options").click();
    await expect(sidebar.getByTestId("commit-options-dialog")).toBeVisible();
    const hooks = sidebar.getByTestId("commit-options-hooks");
    await expect(hooks).toBeChecked();
    await hooks.uncheck();
    await expect(hooks).not.toBeChecked();
    await sidebar.getByRole("button", { name: "Close" }).click();
    await expect(sidebar.getByTestId("commit-options-dialog")).toHaveCount(0);

    await sidebar.getByTestId(`change-row-${TARGET}`).click();
    await sidebar.getByTestId("commit-toolbar-rollback").click();
    const rollbackDialog = (
      await waitForWebviewFrame(session.app, "rollback-changes-dialog")
    ).getByTestId("rollback-changes-dialog");
    await expect(rollbackDialog).toBeVisible();
    await expect(rollbackDialog.getByTestId("rollback-file-README.md")).toBeVisible();
    await expect(rollbackDialog.getByTestId("rollback-changes-confirm")).toBeVisible();
    await rollbackDialog.getByTestId("rollback-changes-close").click();
    await expect
      .poll(async () => (await findWebviewFrame(session.app, "rollback-changes-dialog")) === null)
      .toBe(true);

    const metrics = await sidebar.evaluate(() => {
      const toolbar = document.querySelector(
        '[data-testid="commit-toolbar"]',
      );
      const app = document.querySelector('[data-testid="git-workspace-app"]');
      if (!(toolbar instanceof HTMLElement) || !(app instanceof HTMLElement)) {
        return null;
      }
      return {
        toolbarWidth: toolbar.getBoundingClientRect().width,
        appWidth: app.getBoundingClientRect().width,
      };
    });
    expect(metrics).not.toBeNull();
    expect(
      Math.abs((metrics?.toolbarWidth ?? 0) - (metrics?.appWidth ?? 0)),
    ).toBeLessThan(2);

    const log = await waitForWebviewFrame(session.app, "workspace-tab-log");
    await expect(log.getByTestId("workspace-tab-log")).toHaveAttribute(
      "aria-current",
      "page",
    );

    await sidebar.getByTestId(`change-row-${TARGET}`).click();
    await session.page.keyboard.press("ControlOrMeta+d");

    const diff = await waitForWebviewFrame(session.app, "git-diff-app");
    await expectGitViewScreen(diff, {
      titlePart: "HEAD",
      contains: [MARKER],
    });

    await expect(sidebarPart).toBeVisible();
    await expect
      .poll(async () => (await sidebarPart.boundingBox())?.width ?? 0)
      .toBeGreaterThan(200);
    await expect(sidebar.getByTestId("commit-sidebar-header")).toBeVisible();
    await expect(sidebar.getByTestId(`change-row-${TARGET}`)).toBeVisible();

    await session.page.screenshot({
      path: testInfo.outputPath("git-commit-sidebar-native.png"),
      animations: "disabled",
    });
  } finally {
    await closeNativeVsCode(session);
    await prepareCleanGitRepo();
  }
});

test("Commit sidebar can be hidden and reopened", async ({
  browserName: _browserName,
}) => {
  test.setTimeout(120_000);
  await prepareCleanGitRepo();
  await fs.appendFile(
    path.join(TEST_WORKSPACE, TARGET),
    `\n${MARKER} hide sidebar\n`,
    "utf8",
  );

  const session = await launchNativeVsCode(TEST_WORKSPACE, {
    settings: {
      "git.autofetch": false,
      "gitView.protectedBranchPatterns": [],
    },
    width: 1400,
    height: 900,
  });
  try {
    await openGitViewActivityBar(session.page);
    const sidebar = await waitForWebviewFrame(
      session.app,
      "commit-sidebar-header",
    );
    await expect(sidebar.getByTestId("commit-sidebar-hide")).toBeVisible({
      timeout: 15_000,
    });

    const sidebarPart = session.page.locator(".part.sidebar");
    await expect
      .poll(async () => (await sidebarPart.boundingBox())?.width ?? 0)
      .toBeGreaterThan(200);
    await sidebar.getByTestId("commit-sidebar-hide").click();
    await expect
      .poll(async () => (await sidebarPart.boundingBox())?.width ?? 0)
      .toBeLessThan(80);

    await openGitWorkspace(session);
    const gitPanel = await waitForWebviewFrame(
      session.app,
      "git-panel-toggle-commit-sidebar",
    );
    await expect(
      gitPanel.getByTestId("git-panel-toggle-commit-sidebar"),
    ).toBeVisible({ timeout: 15_000 });
    await gitPanel.getByTestId("git-panel-toggle-commit-sidebar").click();
    await expect
      .poll(async () => (await sidebarPart.boundingBox())?.width ?? 0)
      .toBeGreaterThan(200);

    const reopened = await waitForWebviewFrame(
      session.app,
      "commit-sidebar-header",
    );
    await expect(reopened.getByTestId("commit-sidebar-hide")).toBeVisible({
      timeout: 15_000,
    });
  } finally {
    await closeNativeVsCode(session);
    await prepareCleanGitRepo();
  }
});

test("Rollback from the sidebar opens the confirmation in the content surface", async ({
  browserName: _browserName,
}) => {
  test.setTimeout(120_000);
  await prepareCleanGitRepo();
  await fs.appendFile(
    path.join(TEST_WORKSPACE, TARGET),
    `\n${MARKER} sidebar rollback\n`,
    "utf8",
  );

  const session = await launchNativeVsCode(TEST_WORKSPACE, {
    settings: {
      "git.autofetch": false,
      "gitView.protectedBranchPatterns": [],
    },
    width: 1400,
    height: 900,
  });
  try {
    await openGitViewActivityBar(session.page);
    const sidebar = await waitForWebviewFrame(
      session.app,
      "commit-sidebar-header",
    );
    const row = sidebar.getByTestId(`change-row-${TARGET}`);
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.click({ button: "right" });
    await expect(sidebar.getByTestId("git-menu-rollback")).toBeVisible();
    await sidebar.getByTestId("git-menu-rollback").click();

    const content = await waitForWebviewFrame(
      session.app,
      "rollback-changes-dialog",
    );
    await expect(content.getByTestId("git-workspace-app")).toHaveAttribute(
      "data-surface",
      "content",
    );
    await expect(content.getByTestId("workspace-tab-bar")).toHaveCount(0);
    await expect(content.getByTestId("commit-sidebar-header")).toHaveCount(0);
    const dialog = content.getByTestId("rollback-changes-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId("rollback-file-README.md")).toBeVisible();
    await dialog.getByTestId("rollback-changes-close").click();
  } finally {
    await closeNativeVsCode(session);
    await prepareCleanGitRepo();
  }
});

test("Rollback dialog scrolls and confirms from the content surface", async ({
  browserName: _browserName,
}) => {
  test.setTimeout(120_000);
  await prepareCleanGitRepo();
  for (let index = 0; index < 45; index += 1) {
    await fs.writeFile(
      path.join(TEST_WORKSPACE, `rollback-${index}.txt`),
      `rollback ${index}\n`,
      "utf8",
    );
  }

  const session = await launchNativeVsCode(TEST_WORKSPACE, {
    settings: {
      "git.autofetch": false,
      "gitView.protectedBranchPatterns": [],
    },
    width: 1400,
    height: 900,
  });
  try {
    await openGitViewActivityBar(session.page);
    const sidebar = await waitForWebviewFrame(
      session.app,
      "commit-sidebar-header",
    );
    const row = sidebar.getByTestId("change-row-rollback-0.txt");
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.click();
    await sidebar.getByTestId("commit-toolbar-rollback").click();

    const content = await waitForWebviewFrame(
      session.app,
      "rollback-changes-dialog",
    );
    const scroll = content.locator(
      '[data-testid="rollback-file-tree"] [data-scroll-owner="vertical"]',
    );
    await expect(scroll).toBeVisible();
    const dimensions = await scroll.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      overflowY: getComputedStyle(element).overflowY,
    }));
    expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight);
    expect(dimensions.overflowY).toBe("auto");

    await content.getByTestId("rollback-changes-confirm").click();
    await expect
      .poll(async () =>
        (await findWebviewFrame(session.app, "rollback-changes-dialog")) ===
        null,
      )
      .toBe(true);
    await expect
      .poll(
        async () => {
          try {
            await fs.access(path.join(TEST_WORKSPACE, "rollback-0.txt"));
            return true;
          } catch {
            return false;
          }
        },
        { timeout: 15_000 },
      )
      .toBe(false);
  } finally {
    await closeNativeVsCode(session);
    await prepareCleanGitRepo();
  }
});
