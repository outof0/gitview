import { expect, test } from "@playwright/test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  closeNativeVsCode,
  commitFile,
  git,
  launchNativeVsCode,
  openGitWorkspace,
  prepareCleanGitRepo,
  TEST_WORKSPACE,
} from "./helpers/native-vscode";
import { dispatchContextMenu } from "./helpers/native-merge";

test.describe.configure({ mode: "serial" });

test.describe("native Git Workspace hard reset safeguard", () => {
  test("revalidates typed evidence before hard reset", async ({
    browserName: _browserName,
  }, testInfo) => {
    test.setTimeout(180_000);
    await prepareCleanGitRepo();
    const branch = "native-hard-reset";
    await git(["switch", "-C", branch]);
    const targetSha = await commitFile(
      TEST_WORKSPACE,
      "native-hard-reset.txt",
      "target content\n",
      "native hard reset target",
    );
    await commitFile(
      TEST_WORKSPACE,
      "native-hard-reset-later.txt",
      "later commit\n",
      "native hard reset later",
    );
    await fs.writeFile(
      path.join(TEST_WORKSPACE, "native-hard-reset.txt"),
      "dirty content\n",
      "utf8",
    );

    const session = await launchNativeVsCode(TEST_WORKSPACE, {
      settings: {
        "git.autofetch": false,
        "gitView.protectedBranchPatterns": [],
      },
    });
    try {
      const frame = await openGitWorkspace(session);
      const targetRow = frame.getByTestId(
        `git-commit-${targetSha.slice(0, 7)}`,
      );
      await expect(targetRow).toBeVisible({ timeout: 30_000 });
      await dispatchContextMenu(targetRow);
      await expect(
        frame.getByTestId("workspace-log-commit-menu"),
      ).toBeVisible();
      await frame.getByTestId("log-reset").click();
      await expect(frame.getByTestId("reset-confirm-dialog")).toBeVisible({
        timeout: 15_000,
      });
      await frame.getByTestId("reset-mode-select").selectOption("hard");
      const typedValue = frame.getByTestId("reset-typed-value");
      await expect(typedValue).toBeVisible({ timeout: 15_000 });
      await expect(frame.getByTestId("reset-confirm")).toBeDisabled();
      await session.page.screenshot({
        path: testInfo.outputPath("hard-reset-confirm-native.png"),
        animations: "disabled",
      });

      const advancedHead = await commitFile(
        TEST_WORKSPACE,
        "native-hard-reset-stale-proof.txt",
        "new head\n",
        "advance head after reset preflight",
      );
      await typedValue.fill(branch);
      await frame.getByTestId("reset-confirm").click();

      await expect(frame.getByTestId("workspace-error")).toContainText(
        "Repository state changed",
        { timeout: 15_000 },
      );
      await expect(frame.getByTestId("reset-confirm-dialog")).toBeVisible();
      await expect(frame.getByTestId("reset-typed-value")).toHaveValue("");
      expect((await git(["rev-parse", "HEAD"])).trim()).toBe(advancedHead);

      await frame.getByTestId("reset-typed-value").fill(branch);
      await frame.getByTestId("reset-confirm").click();
      await expect(frame.getByTestId("reset-confirm-dialog")).toHaveCount(0, {
        timeout: 15_000,
      });
      await expect
        .poll(async () => (await git(["rev-parse", "HEAD"])).trim(), {
          timeout: 15_000,
        })
        .toBe(targetSha);
      expect(
        await fs.readFile(
          path.join(TEST_WORKSPACE, "native-hard-reset.txt"),
          "utf8",
        ),
      ).toBe("target content\n");
      await expect(
        fs.access(path.join(TEST_WORKSPACE, "native-hard-reset-later.txt")),
      ).rejects.toThrow();
      await expect(
        fs.access(
          path.join(TEST_WORKSPACE, "native-hard-reset-stale-proof.txt"),
        ),
      ).rejects.toThrow();
    } finally {
      await closeNativeVsCode(session);
      await prepareCleanGitRepo();
    }
  });
});
