/**
 * Opt-in native smoke against an existing real Git repository.
 *
 * Usage:
 *   E2E_NATIVE=1 E2E_REAL_REPO=/path/to/repo E2E_REAL_FILE=README.md \
 *     playwright test e2e/native-real-repo-git-submenu.spec.ts
 *
 * To test the packaged artifact instead of extensionDevelopmentPath:
 *   E2E_REAL_VSIX=/path/to/gitview-0.1.0.vsix
 */
import { test, expect } from "@playwright/test";
import { execFile } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { promisify } from "node:util";
import { closeNativeVsCode, gitAt, launchNativeVsCode } from "./helpers/native-vscode";
import {
  expectGitViewBlameScreen,
  openExplorerGitAction,
  waitForGitViewBlameFrame,
} from "./helpers/git-screen-parity";

const exec = promisify(execFile);
const REAL_REPO = process.env.E2E_REAL_REPO;
const REAL_FILE = process.env.E2E_REAL_FILE;
const REAL_VSIX = process.env.E2E_REAL_VSIX;

async function pickRootTextFile(repoRoot: string): Promise<string> {
  const { stdout } = await exec("git", ["ls-files"], { cwd: repoRoot });
  const candidates = stdout
    .split("\n")
    .filter(Boolean)
    .filter((file) => !file.includes("/"))
    .filter((file) =>
      /\.(?:cjs|css|html|js|json|jsx|md|mjs|ts|tsx|txt|yaml|yml)$/i.test(file),
    );
  const preferred = candidates.find((file) => /^readme\.md$/i.test(file));
  const picked = preferred ?? candidates[0];
  if (!picked) {
    throw new Error(
      "E2E_REAL_REPO has no tracked root-level text file. Set E2E_REAL_FILE to a root-level tracked file.",
    );
  }
  return picked;
}

test.describe("Native Explorer Git submenu on a real repository", () => {
  test.skip(!REAL_REPO, "Set E2E_REAL_REPO to run this real-repo native test.");

  test("Annotate with Git Blame opens and loads blame for a real repo file", async () => {
    const repoRoot = REAL_REPO!;
    await expect(
      fs.stat(path.join(repoRoot, ".git")).then((stat) => stat.isDirectory()),
    ).resolves.toBe(true);

    const relativePath = REAL_FILE ?? (await pickRootTextFile(repoRoot));
    expect(
      relativePath.includes("/"),
      "E2E_REAL_FILE must be a root-level file so the native Explorer row is directly clickable.",
    ).toBe(false);

    const blame = await gitAt(repoRoot, [
      "blame",
      "--line-porcelain",
      "--",
      relativePath,
    ]);
    expect(blame).toContain(`filename ${relativePath}`);

    const session = await launchNativeVsCode(
      repoRoot,
      REAL_VSIX ? { vsixPath: REAL_VSIX } : undefined,
    );
    try {
      await openExplorerGitAction(
        session,
        path.basename(relativePath),
        "Annotate with Git Blame",
      );
      const frame = await waitForGitViewBlameFrame(session.app, 60_000);
      await expectGitViewBlameScreen(frame, { relativePath });
      await expect(frame.getByTestId(/^blame-line-/).first()).toBeVisible({
        timeout: 15_000,
      });
      await expect(frame.getByTestId("blame-monaco")).toBeVisible();
      await expect(frame.getByTestId("blame-editor")).toHaveAttribute(
        "data-monaco",
        "ready",
      );
      await expect(frame.getByTestId("git-history-tool-window")).toBeVisible();
      await frame.getByTestId(/^blame-sha-/).first().click();
      await expect(frame.getByTestId("git-commit-list")).toBeVisible({
        timeout: 15_000,
      });
    } finally {
      await closeNativeVsCode(session);
    }
  });
});
