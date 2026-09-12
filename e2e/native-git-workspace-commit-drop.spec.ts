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

test.describe("native Git Workspace commit drop safeguard", () => {
  test("revalidates typed evidence before dropping a commit", async ({
    browserName: _browserName,
  }, testInfo) => {
    test.setTimeout(180_000);
    await prepareCleanGitRepo();
    const branch = "native-commit-drop";
    await git(["switch", "-C", branch]);
    const targetSha = await commitFile(
      TEST_WORKSPACE,
      "native-drop-target.txt",
      "drop this commit\n",
      "native commit drop target",
    );
    await commitFile(
      TEST_WORKSPACE,
      "native-drop-later.txt",
      "keep later commit\n",
      "native commit drop later",
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
      await frame.getByTestId("log-drop-commit").click();
      await expect(frame.getByTestId("rewrite-history-dialog")).toBeVisible({
        timeout: 15_000,
      });
      const typedValue = frame.getByTestId("rewrite-history-typed-value");
      await expect(typedValue).toBeVisible();
      await expect(frame.getByTestId("rewrite-history-confirm")).toBeDisabled();
      await session.page.screenshot({
        path: testInfo.outputPath("commit-drop-confirm-native.png"),
        animations: "disabled",
      });

      const advancedHead = await commitFile(
        TEST_WORKSPACE,
        "native-drop-stale-proof.txt",
        "keep stale proof\n",
        "advance head after commit drop preflight",
      );
      await typedValue.fill(targetSha.slice(0, 7));
      await frame.getByTestId("rewrite-history-confirm").click();

      await expect(frame.getByTestId("workspace-error")).toContainText(
        "Repository state changed",
        { timeout: 15_000 },
      );
      await expect(frame.getByTestId("rewrite-history-dialog")).toBeVisible();
      await expect(
        frame.getByTestId("rewrite-history-typed-value"),
      ).toHaveValue("");
      expect((await git(["rev-parse", "HEAD"])).trim()).toBe(advancedHead);

      await frame
        .getByTestId("rewrite-history-typed-value")
        .fill(targetSha.slice(0, 7));
      await frame.getByTestId("rewrite-history-confirm").click();
      await expect(frame.getByTestId("rewrite-history-dialog")).toHaveCount(0, {
        timeout: 15_000,
      });
      await expect
        .poll(async () => await git(["log", "--format=%H"]), {
          timeout: 15_000,
        })
        .not.toContain(targetSha);
      await expect(
        fs.access(path.join(TEST_WORKSPACE, "native-drop-target.txt")),
      ).rejects.toThrow();
      expect(
        await fs.readFile(
          path.join(TEST_WORKSPACE, "native-drop-later.txt"),
          "utf8",
        ),
      ).toBe("keep later commit\n");
      expect(
        await fs.readFile(
          path.join(TEST_WORKSPACE, "native-drop-stale-proof.txt"),
          "utf8",
        ),
      ).toBe("keep stale proof\n");
    } finally {
      await closeNativeVsCode(session);
      await prepareCleanGitRepo();
    }
  });
});
