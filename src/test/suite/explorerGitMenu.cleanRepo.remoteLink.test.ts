/**
 * VS Code integration: Explorer / Editor / SCM right-click → Git submenu.
 *
 * Remote-host links (GitLink parity) against a fake GitHub origin. The
 * origin is swapped for the suite and restored afterwards so other suites
 * keep the local test remote they expect.
 */
import * as assert from "assert";
import * as vscode from "vscode";
import {
  executeGitMenuCommand,
  findExtension,
  uri,
  git,
} from "./explorerGitMenu.helpers";

const FAKE_ORIGIN = "https://github.com/test-owner/test-repo.git";

suite("Explorer Git context menu (integration)", () => {
  suiteSetup(async function () {
    this.timeout(60_000);
    const ext = findExtension();
    assert.ok(ext, "gitview extension should be loaded");
    await ext!.activate();
  });

  suite("clean repo remote-link submenu actions", () => {
    let originalOrigin: string | null = null;

    suiteSetup(async function () {
      this.timeout(60_000);
      await git(["merge", "--abort"]).catch(() => "");
      await git(["reset", "--hard", "HEAD"]);
      await git(["clean", "-fd"]);
      originalOrigin = await git(["remote", "get-url", "origin"]).catch(
        () => "",
      );
      if (!originalOrigin.trim()) {
        originalOrigin = null;
      }
      await git(["remote", "remove", "origin"]).catch(() => "");
      await git(["remote", "add", "origin", FAKE_ORIGIN]);
      const branch = (await git(["branch", "--show-current"])).trim();
      await git(["update-ref", `refs/remotes/origin/${branch}`, "HEAD"]);
    });

    suiteTeardown(async () => {
      await git(["remote", "remove", "origin"]).catch(() => "");
      if (originalOrigin) {
        await git(["remote", "add", "origin", originalOrigin]).catch(
          () => "",
        );
      }
    });

    async function currentHead(): Promise<string> {
      return (await git(["rev-parse", "HEAD"])).trim();
    }

    test("Copy Remote Link copies a commit-pinned file URL", async function () {
      this.timeout(20_000);
      const head = await currentHead();

      await executeGitMenuCommand(
        "gitView.gitCopyRemoteLink",
        uri("README.md"),
        { timeoutMs: 8_000 },
      );
      const text = await vscode.env.clipboard.readText();
      assert.match(
        text,
        new RegExp(
          `^https://github\\.com/test-owner/test-repo/blob/${head}/README\\.md(#L\\d+(-L\\d+)?)?$`,
        ),
      );
    });

    test("Copy Remote Link as Markdown copies a Markdown link", async function () {
      this.timeout(20_000);
      const head = await currentHead();

      await executeGitMenuCommand(
        "gitView.gitCopyRemoteLinkMarkdown",
        uri("README.md"),
        { timeoutMs: 8_000 },
      );
      const text = await vscode.env.clipboard.readText();
      assert.match(
        text,
        new RegExp(
          `^\\[README\\.md(#L\\d+(-L\\d+)?)?\\]\\(https://github\\.com/test-owner/test-repo/blob/${head}/README\\.md(#L\\d+(-L\\d+)?)?\\)$`,
        ),
      );
    });

    test("Open on Remote completes without error", async function () {
      this.timeout(20_000);
      await executeGitMenuCommand(
        "gitView.gitOpenOnRemote",
        uri("README.md"),
        { timeoutMs: 8_000 },
      );
    });
  });
});
