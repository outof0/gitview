/**
 * Native E2E — merge conflicts stay out of the log-only Git Bottom Panel and
 * open in the dedicated three-way resolver.
 */
import { expect, test } from "@playwright/test";
import {
  closeNativeVsCode,
  launchNativeVsCode,
  openGitWorkspace,
  openMergeResolver,
  prepareMergeRepo,
} from "./helpers/native-vscode";

test("Git Bottom Panel stays log-only while conflicts open in the resolver", async () => {
  await prepareMergeRepo();
  const session = await launchNativeVsCode();
  try {
    const workspace = await openGitWorkspace(session);
    await expect(workspace.getByTestId("workspace-tab-log")).toBeVisible({
      timeout: 30_000,
    });
    await expect(workspace.getByTestId("workspace-tab-changes")).toHaveCount(0);
    await expect(workspace.getByTestId("change-row-file.txt")).toHaveCount(0);

    const resolver = await openMergeResolver(session, "file.txt");
    await expect(resolver.getByTestId("pane-left-wrap")).toBeVisible();
    await expect(resolver.getByTestId("pane-center-wrap")).toBeVisible();
    await expect(resolver.getByTestId("pane-right-wrap")).toBeVisible();

    const grid = resolver.getByTestId("merge-pane-grid-wrap");
    await expect(grid).not.toContainText("<<<<<<<");
    await expect(grid).not.toContainText(">>>>>>>");
  } finally {
    await closeNativeVsCode(session);
  }
});

test("dedicated resolver offers Magic Merge for an inline simple conflict", async () => {
  await prepareMergeRepo();
  const session = await launchNativeVsCode();
  try {
    const resolver = await openMergeResolver(session, "magic-merge.txt");
    const magicMerge = resolver.getByRole("button", {
      name: "Magic Merge: Resolve simple conflicts",
    });
    await expect(magicMerge).toBeVisible({ timeout: 30_000 });
    await expect(magicMerge).toHaveAccessibleName(
      "Magic Merge: Resolve simple conflicts",
    );
    await magicMerge.click();

    const expected =
      "Below is a simple conflict that can be resolved automatically.";
    const centerLine = resolver
      .locator('[data-testid="pane-center"] .monaco-editor .view-line')
      .filter({ hasText: expected });
    await expect(centerLine).toHaveCount(1);
    await expect(centerLine).toHaveText(expected);
    await expect(
      resolver.getByRole("status", { name: "1 change, 0 conflicts" }),
    ).toBeVisible();
    await expect(resolver.getByRole("button", { name: "Apply" })).toBeEnabled();
  } finally {
    await closeNativeVsCode(session);
  }
});
