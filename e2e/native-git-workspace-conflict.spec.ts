/**
 * Native E2E — the GitView Git Changes tab must preview a conflicted file with the
 * three-way resolver, not a HEAD↔worktree diff that leaks Git's markers.
 */
import { test, expect } from "@playwright/test";
import {
  closeNativeVsCode,
  launchNativeVsCode,
  openGitWorkspace,
  prepareMergeRepo,
} from "./helpers/native-vscode";

test("Changes tab previews a conflicted file with the three-way resolver", async () => {
  await prepareMergeRepo();
  const session = await launchNativeVsCode();
  try {
    const frame = await openGitWorkspace(session);
    await frame.getByTestId("change-row-file.txt").waitFor({ timeout: 30_000 });
    await frame.getByTestId("change-row-file.txt").click();
    await frame.getByTestId("conflict-merge-view").waitFor({ timeout: 30_000 });

    await expect(frame.getByTestId("pane-left-wrap")).toBeVisible();
    await expect(frame.getByTestId("pane-center-wrap")).toBeVisible();
    await expect(frame.getByTestId("pane-right-wrap")).toBeVisible();

    const grid = frame.getByTestId("merge-pane-grid-wrap");
    await expect(grid).not.toContainText("<<<<<<<");
    await expect(grid).not.toContainText(">>>>>>>");

    // Non-conflicted files keep the ordinary two-column diff.
    await frame.getByTestId("change-row-src/components/Modal.tsx").click();
    await frame.getByTestId("workspace-diff-panel").waitFor({ timeout: 15_000 });
    await expect(frame.getByTestId("conflict-merge-view")).toHaveCount(0);
  } finally {
    await closeNativeVsCode(session);
  }
});
