import { test, expect } from "@playwright/test";
import {
  clickNativeGitMenu,
  closeNativeVsCode,
  git,
  launchNativeVsCode,
  prepareCleanGitRepo,
  waitForNativeGitMenuItemEnabled,
} from "./helpers/native-vscode";

test.describe.configure({ mode: "serial" });

const FAKE_ORIGIN = "https://github.com/test-owner/test-repo.git";

let originalOrigin: string | null = null;

test.beforeAll(async () => {
  await prepareCleanGitRepo();
  originalOrigin = await git(["remote", "get-url", "origin"]).catch(() => "");
  if (!originalOrigin) {
    originalOrigin = null;
  }
});

test.afterAll(async () => {
  await git(["remote", "remove", "origin"]).catch(() => "");
  if (originalOrigin) {
    await git(["remote", "add", "origin", originalOrigin]).catch(() => "");
  }
  await prepareCleanGitRepo();
});

async function useFakeGithubOrigin(): Promise<void> {
  await git(["remote", "remove", "origin"]).catch(() => "");
  await git(["remote", "add", "origin", FAKE_ORIGIN]);
  const branch = (await git(["branch", "--show-current"])).trim();
  await git(["update-ref", `refs/remotes/origin/${branch}`, "HEAD"]);
}

async function currentHead(): Promise<string> {
  return (await git(["rev-parse", "HEAD"])).trim();
}

async function readMainClipboard(session: {
  app: { evaluate: (fn: (e: { clipboard: { readText: () => string } }) => string) => Promise<string> };
}): Promise<string> {
  return session.app.evaluate(({ clipboard }) => clipboard.readText());
}

test.describe("Remote host links", () => {
  test("Copy Remote Link copies a commit-pinned file URL", async () => {
    await useFakeGithubOrigin();
    const head = await currentHead();
    const session = await launchNativeVsCode();
    try {
      await waitForNativeGitMenuItemEnabled(
        session,
        "README.md",
        "Copy Remote Link",
      );
      await clickNativeGitMenu(session, "README.md", "Copy Remote Link");
      // Opening the row focuses line 1, so the link pins the selection.
      await expect
        .poll(() => readMainClipboard(session), { timeout: 8_000 })
        .toBe(
          `https://github.com/test-owner/test-repo/blob/${head}/README.md#L1`,
        );
    } finally {
      await closeNativeVsCode(session);
    }
  });

  test("Copy Remote Link as Markdown copies a Markdown link", async () => {
    await useFakeGithubOrigin();
    const head = await currentHead();
    const session = await launchNativeVsCode();
    try {
      await clickNativeGitMenu(
        session,
        "README.md",
        "Copy Remote Link as Markdown",
      );
      await expect
        .poll(() => readMainClipboard(session), { timeout: 8_000 })
        .toBe(
          `[README.md#L1](https://github.com/test-owner/test-repo/blob/${head}/README.md#L1)`,
        );
    } finally {
      await closeNativeVsCode(session);
    }
  });

  test("Open on Remote is offered in the Git submenu", async () => {
    await useFakeGithubOrigin();
    const session = await launchNativeVsCode();
    try {
      await waitForNativeGitMenuItemEnabled(
        session,
        "README.md",
        "Open on Remote",
      );
    } finally {
      await closeNativeVsCode(session);
    }
  });
});
