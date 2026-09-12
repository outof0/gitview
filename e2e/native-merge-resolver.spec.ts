/**
 * Native E2E — merge resolver behavior in real VS Code webviews.
 * Replaces critical mock-only coverage (resolve/append/F7/folding/folder menu).
 */
import { test, expect } from "@playwright/test";
import * as fs from "fs/promises";
import * as path from "path";
import {
  closeNativeVsCode,
  expectGitSubmenuInFrame,
  git,
  launchNativeVsCode,
  openConflictsDialog,
  prepareMergeRepo,
  TEST_WORKSPACE,
} from "./helpers/native-vscode";
import {
  acceptLocalViaContextMenu,
  appendRepositoryViaContextMenu,
  enableConflictsGroupedView,
  expectApplyEnabled,
  expectCenterLine,
  expectConflictCounter,
  expectResolveMenuItems,
  focusMergePane,
  openConflictsFolderContextMenu,
  openMergeCenterContextMenu,
  openMergeResolverFor,
  pressMergeShortcut,
} from "./helpers/native-merge";
import {
  expectUiSurfaceAccessible,
  expectUiSurfaceLayout,
} from "./helpers/ui-system-contracts";

test.describe.configure({ mode: "serial" });

test.describe("Native merge resolver — Magic Merge", () => {
  test("combines independent word edits, writes the result, and clears unmerged stages", async () => {
    const testInfo = test.info();
    await prepareMergeRepo();
    const session = await launchNativeVsCode();
    try {
      const frame = await openMergeResolverFor(session, "magic-merge.txt");
      await expectUiSurfaceLayout(frame, "merge-app");
      await expectUiSurfaceAccessible(frame, "merge-app");
      const viewOptions = frame.getByTestId("merge-view-options");
      await viewOptions.click();
      await expect(
        frame.getByTestId("merge-view-options-whitespace-doNotIgnore"),
      ).toBeVisible();
      await viewOptions.click();
      const magicMerge = frame.getByLabel(
        /Magic Merge|Resolve simple conflicts/i,
      );
      await expect(magicMerge).toBeVisible();
      await magicMerge.click();

      await expectCenterLine(
        frame,
        "Below is a simple conflict that can be resolved automatically.",
      );
      await expectConflictCounter(frame, /0 conflict/i);
      await expectApplyEnabled(frame, true);
      await session.page.screenshot({
        path: testInfo.outputPath("magic-merge.png"),
        animations: "disabled",
      });

      await frame.getByTestId("merge-apply").click();
      const expected =
        "Below is a simple conflict that can be resolved automatically.\n";
      await expect
        .poll(
          () =>
            fs.readFile(path.join(TEST_WORKSPACE, "magic-merge.txt"), "utf8"),
          { timeout: 15_000 },
        )
        .toBe(expected);
      await expect
        .poll(() => git(["ls-files", "-u", "--", "magic-merge.txt"]))
        .toBe("");
      await expect.poll(() => git(["show", ":magic-merge.txt"])).toBe(expected);
    } finally {
      await closeNativeVsCode(session);
    }
  });
});

test.describe("Native merge resolver — resolve & append", () => {
  test("Accept Local via context menu updates center pane", async () => {
    await prepareMergeRepo();
    const session = await launchNativeVsCode();
    try {
      const frame = await openMergeResolverFor(session, "file.txt");
      await acceptLocalViaContextMenu(frame);
      await expectCenterLine(frame, "theirs change");
      await expectCenterLine(frame, "ours change", { visible: false });
      await expectConflictCounter(frame, /1 conflict/i);
      await expectApplyEnabled(frame, false);
    } finally {
      await closeNativeVsCode(session);
    }
  });

  test("Append Repository after Accept Local resolves both sides", async () => {
    await prepareMergeRepo();
    const session = await launchNativeVsCode();
    try {
      const frame = await openMergeResolverFor(session, "file.txt");
      await acceptLocalViaContextMenu(frame);
      await expectConflictCounter(frame, /1 conflict/i);
      await appendRepositoryViaContextMenu(frame);
      await expectConflictCounter(frame, /0 conflict/i);
      const center = frame.getByTestId("pane-center");
      await expect(center).toContainText("theirs change");
      await expect(center).toContainText("ours change");
      await expectApplyEnabled(frame, true);
    } finally {
      await closeNativeVsCode(session);
    }
  });

  test("center pane context menu exposes resolve actions", async () => {
    await prepareMergeRepo();
    const session = await launchNativeVsCode();
    try {
      const frame = await openMergeResolverFor(session, "file.txt");
      await openMergeCenterContextMenu(frame, "line2");
      await expectResolveMenuItems(frame, [
        "merge-context-accept-local",
        "merge-context-accept-repository",
        "merge-context-ignore-local",
        "merge-context-ignore-repository",
        "merge-context-resolve-local",
        "merge-context-resolve-repository",
        "merge-context-reset",
      ]);
    } finally {
      await closeNativeVsCode(session);
    }
  });
});

test.describe("Native merge resolver — navigation & folding", () => {
  test("F7 moves between differences in a multi-hunk file", async () => {
    await prepareMergeRepo();
    const session = await launchNativeVsCode();
    try {
      const frame = await openMergeResolverFor(session, "services.ts");
      await focusMergePane(session.page, frame, "left");
      const navigableBlocks = frame.locator(
        '[data-testid="pane-left"] .nx-block[data-block]:not([data-type="unchanged"])',
      );
      expect(await navigableBlocks.count()).toBeGreaterThanOrEqual(2);
      const activeBlock = async () => {
        const active = frame
          .locator('[data-testid="pane-left"] .nx-block.nx-active[data-block]')
          .first();
        return (await active.count()) > 0
          ? active.getAttribute("data-block")
          : null;
      };
      const before = await activeBlock();
      await pressMergeShortcut(session.page, frame, "F7");
      await expect.poll(activeBlock, { timeout: 10_000 }).not.toBe(before);
      const afterFirst = await activeBlock();
      await pressMergeShortcut(session.page, frame, "F7");
      await expect.poll(activeBlock, { timeout: 10_000 }).not.toBe(afterFirst);
    } finally {
      await closeNativeVsCode(session);
    }
  });

  test("foldUnchangedRegions collapses long unchanged runs", async () => {
    await prepareMergeRepo();
    const session = await launchNativeVsCode(undefined, {
      settings: {
        "gitView.foldUnchangedRegions": true,
        "gitView.foldThreshold": 5,
      },
    });
    try {
      const frame = await openMergeResolverFor(session, "services.ts");
      const banners = frame.locator('[aria-label="expand-collapsed"]');
      await expect(banners.first()).toBeVisible({ timeout: 30_000 });
      expect(await banners.count()).toBeGreaterThanOrEqual(1);
    } finally {
      await closeNativeVsCode(session);
    }
  });
});

test.describe("Native conflicts dialog — folder scope", () => {
  test("folder row disables file-only Git submenu entries", async () => {
    await prepareMergeRepo();
    const session = await launchNativeVsCode();
    try {
      const frame = await openConflictsDialog(session);
      await enableConflictsGroupedView(frame);
      await openConflictsFolderContextMenu(frame, "edge");
      const menu = frame.getByTestId("conflicts-context-menu");
      await expect(menu).toBeVisible();
      await expect(menu.getByText("Merge...")).toHaveCount(0);
      await expect(menu.getByTestId("conflicts-menu-accept-yours")).toHaveCount(
        0,
      );
      await expect(
        menu.getByTestId("conflicts-menu-accept-theirs"),
      ).toHaveCount(0);
      await expectGitSubmenuInFrame(frame, { isFolder: true });
    } finally {
      await closeNativeVsCode(session);
    }
  });
});
