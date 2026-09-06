import { expect, test } from "@playwright/test";
import {
  closeNativeVsCode,
  launchNativeVsCode,
  openGitWorkspace,
  prepareCleanGitRepo,
  TEST_WORKSPACE,
} from "./helpers/native-vscode";
import {
  expectUiSurfaceAccessible,
  expectUiSurfaceLayout,
} from "./helpers/ui-system-contracts";

test.describe.configure({ mode: "serial" });

test("Git Bottom Panel opens as the log-only design", async ({
  browserName: _browserName,
}, testInfo) => {
  test.setTimeout(120_000);
  await prepareCleanGitRepo();

  const session = await launchNativeVsCode(TEST_WORKSPACE, {
    settings: {
      "git.autofetch": false,
      "gitView.protectedBranchPatterns": [],
    },
    width: 1400,
    height: 900,
  });
  try {
    const frame = await openGitWorkspace(session);
    await expectUiSurfaceLayout(frame, "git-workspace-app");
    await expectUiSurfaceAccessible(frame, "git-workspace-app");
    const logTab = frame.getByTestId("workspace-tab-log");

    await expect(logTab).toBeVisible({ timeout: 30_000 });
    await expect(logTab).toHaveAttribute("aria-current", "page");
    await expect(frame.getByTestId("log-filters")).toBeVisible();
    await expect(frame.getByTestId("workspace-tab-changes")).toHaveCount(0);
    await expect(frame.getByTestId("gitview-git-widget")).toHaveCount(0);
    await expect(frame.getByTestId("operation-recovery-bar")).toHaveCount(0);

    const commitScroll = frame.getByTestId("workspace-log-commits-scroll");
    await expect(commitScroll).toHaveCSS("overflow-y", "auto");

    const graph = frame.getByTestId("git-log-graph");
    await expect(graph).toBeVisible();
    await expect
      .poll(async () => Number(await graph.getAttribute("width")))
      .toBeGreaterThan(34);

    const search = frame.getByTestId("log-filter-grep");
    await search.focus();
    await expect(search).toBeFocused();
    await expect
      .poll(() =>
        search.evaluate((input) => getComputedStyle(input).outlineStyle),
      )
      .toBe("none");
    await expect
      .poll(() =>
        search.evaluate(
          (input) => getComputedStyle(input.parentElement!).outlineStyle,
        ),
      )
      .toBe("solid");

    await session.page.screenshot({
      path: testInfo.outputPath("git-bottom-panel-native.png"),
      animations: "disabled",
    });
  } finally {
    await closeNativeVsCode(session);
    await prepareCleanGitRepo();
  }
});
