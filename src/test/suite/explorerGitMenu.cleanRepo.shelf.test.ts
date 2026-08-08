/**
 * VS Code integration: Explorer / Editor / SCM right-click → Git submenu.
 */
import * as assert from "assert";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import {
  executeGitMenuCommand,
  findExtension,
  uri,
  git,
  gitAt,
  waitFor,
} from "./explorerGitMenu.helpers";

suite("Explorer Git context menu (integration)", () => {
  suiteSetup(async function () {
    this.timeout(60_000);
    const ext = findExtension();
    assert.ok(ext, "gitview extension should be loaded");
    await ext!.activate();
  });

  suite("clean repo Explorer submenu actions", () => {
    let remoteParent = "";

    suiteSetup(async function () {
      this.timeout(60_000);

      await git(["merge", "--abort"]).catch(() => "");
      await git(["reset", "--hard", "HEAD"]);
      await git(["clean", "-fd"]);

      remoteParent = await fs.mkdtemp(
        path.join(os.tmpdir(), "gitview-explorer-remote-"),
      );
      const remoteRoot = path.join(remoteParent, "origin.git");
      const remoteClone = path.join(remoteParent, "clone");

      await gitAt(remoteParent, ["init", "--bare", remoteRoot]);
      await git(["remote", "remove", "origin"]).catch(() => "");
      await git(["remote", "add", "origin", remoteRoot]);
      await git(["push", "-u", "origin", "master"]);

      await gitAt(remoteParent, ["clone", remoteRoot, remoteClone]);
      await gitAt(remoteClone, ["config", "user.email", "gitview@test.com"]);
      await gitAt(remoteClone, ["config", "user.name", "GitView Diff Test"]);
    });

    suiteTeardown(async () => {
      if (remoteParent) {
        await fs.rm(remoteParent, { recursive: true, force: true });
      }
    });

    test("Stash workflow can be cancelled without touching the worktree", async function () {
      this.timeout(20_000);
      const marker = "explorer stash action";
      const readme = uri("README.md");

      try {
        await git(["stash", "clear"]).catch(() => "");
        await git(["reset", "--hard", "HEAD"]).catch(() => "");
        const before = await fs.readFile(readme.fsPath, "utf8");
        await fs.writeFile(readme.fsPath, `${before}\n${marker}\n`, "utf8");

        await executeGitMenuCommand("gitView.gitStash", readme, {
          timeoutMs: 8_000,
        });

        assert.ok(
          (await fs.readFile(readme.fsPath, "utf8")).includes(marker),
          "cancelling Stash must leave working tree edits in place",
        );
        assert.strictEqual(
          (await git(["stash", "list"])).trim(),
          "",
          "cancelling Stash must not create a stash",
        );
      } finally {
        await git(["reset", "--hard", "HEAD"]).catch(() => "");
        await git(["stash", "clear"]).catch(() => "");
      }
    });

    test("Unstash workflow can be cancelled without restoring the stash", async function () {
      this.timeout(20_000);
      const marker = "explorer unstash action";
      const readme = uri("README.md");

      try {
        await git(["stash", "clear"]).catch(() => "");
        await git(["reset", "--hard", "HEAD"]).catch(() => "");
        const before = await fs.readFile(readme.fsPath, "utf8");
        await fs.writeFile(readme.fsPath, `${before}\n${marker}\n`, "utf8");
        await git(["stash", "push", "-m", "explorer unstash fixture"]);

        await executeGitMenuCommand("gitView.gitUnstash", readme, {
          timeoutMs: 8_000,
        });

        assert.ok(
          !(await fs.readFile(readme.fsPath, "utf8")).includes(marker),
          "cancelling Unstash must not restore the stash into the worktree",
        );
        assert.ok(
          (await git(["stash", "list"])).includes("stash@{0}"),
          "cancelling Unstash must leave the stash in the list",
        );
      } finally {
        await git(["reset", "--hard", "HEAD"]).catch(() => "");
        await git(["stash", "clear"]).catch(() => "");
      }
    });

    test("Shelve removes selected working tree changes without creating a Git stash", async function () {
      this.timeout(20_000);
      const relativePath = "README.md";
      const marker = "explorer shelve action";
      const readme = uri(relativePath);
      const before = await fs.readFile(readme.fsPath, "utf8");

      try {
        await git(["stash", "clear"]).catch(() => "");
        await fs.writeFile(readme.fsPath, `${before}\n${marker}\n`, "utf8");

        await executeGitMenuCommand("gitView.gitShelve", readme, {
          timeoutMs: 8_000,
        });

        await waitFor(async () => {
          const current = await fs.readFile(readme.fsPath, "utf8");
          const stashList = await git(["stash", "list"]);
          return !current.includes(marker) && !stashList.includes("stash@{0}");
        }, "gitShelve should remove selected changes without using Git stash");
      } finally {
        await git(["reset", "--hard", "HEAD"]).catch(() => "");
        await git(["stash", "clear"]).catch(() => "");
      }
    });

    test("Unshelve restores the latest shelved change to the worktree", async function () {
      this.timeout(20_000);
      const relativePath = "README.md";
      const marker = "explorer unshelve action";
      const readme = uri(relativePath);
      const before = await fs.readFile(readme.fsPath, "utf8");

      try {
        await git(["stash", "clear"]).catch(() => "");
        await fs.writeFile(readme.fsPath, `${before}\n${marker}\n`, "utf8");

        await executeGitMenuCommand("gitView.gitShelve", readme, {
          timeoutMs: 8_000,
        });
        await waitFor(async () => {
          const current = await fs.readFile(readme.fsPath, "utf8");
          return !current.includes(marker);
        }, "gitShelve should prepare a restorable shelf");

        await executeGitMenuCommand("gitView.gitUnshelve", readme, {
          timeoutMs: 8_000,
        });
        await waitFor(async () => {
          const current = await fs.readFile(readme.fsPath, "utf8");
          return current.includes(marker);
        }, "gitUnshelve should restore the latest shelf into the worktree");
      } finally {
        await git(["reset", "--hard", "HEAD"]).catch(() => "");
        await git(["stash", "clear"]).catch(() => "");
      }
    });
  });
});
