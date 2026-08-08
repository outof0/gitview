/**
 * VS Code integration: Explorer / Editor / SCM right-click → Git submenu.
 */
import * as assert from "assert";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
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
    let remoteRoot = "";
    let remoteClone = "";

    suiteSetup(async function () {
      this.timeout(60_000);

      await git(["merge", "--abort"]).catch(() => "");
      await git(["reset", "--hard", "HEAD"]);
      await git(["clean", "-fd"]);

      remoteParent = await fs.mkdtemp(
        path.join(os.tmpdir(), "gitview-explorer-remote-"),
      );
      remoteRoot = path.join(remoteParent, "origin.git");
      remoteClone = path.join(remoteParent, "clone");

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

    async function commitFile(
      cwd: string,
      relativePath: string,
      content: string,
      message: string,
    ): Promise<string> {
      const absolutePath = path.join(cwd, relativePath);
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, content, "utf8");
      await gitAt(cwd, ["add", relativePath]);
      await gitAt(cwd, ["commit", "-m", message]);
      return (await gitAt(cwd, ["rev-parse", "HEAD"])).trim();
    }

    async function remoteCommit(
      relativePath: string,
      content: string,
      message: string,
    ): Promise<string> {
      const sha = await commitFile(remoteClone, relativePath, content, message);
      await gitAt(remoteClone, ["push", "origin", "master"]);
      return sha;
    }
    test("Add and Unstage folder URI mutate the Git index for contained files", async function () {
      this.timeout(20_000);
      const directory = "explorer-folder-action";
      const first = `${directory}/one.txt`;
      const second = `${directory}/two.txt`;

      try {
        await fs.mkdir(uri(directory).fsPath, { recursive: true });
        await fs.writeFile(uri(first).fsPath, "one\n", "utf8");
        await fs.writeFile(uri(second).fsPath, "two\n", "utf8");

        await vscode.commands.executeCommand("gitView.gitAdd", uri(directory));
        await waitFor(async () => {
          const indexed = await git(["diff", "--cached", "--name-only"]);
          const files = new Set(indexed.trim().split("\n").filter(Boolean));
          return files.has(first) && files.has(second);
        }, "gitAdd should stage files under the right-clicked Explorer folder");

        await vscode.commands.executeCommand(
          "gitView.gitUnstage",
          uri(directory),
        );
        await waitFor(async () => {
          const indexed = await git(["diff", "--cached", "--name-only"]);
          return !indexed.includes(first) && !indexed.includes(second);
        }, "gitUnstage should unstage files under the right-clicked Explorer folder");
      } finally {
        await git(["reset", "--", directory]).catch(() => "");
        await fs.rm(uri(directory).fsPath, { recursive: true, force: true });
      }
    });

    test("Fetch updates origin/master from the configured remote", async function () {
      this.timeout(30_000);
      const remoteSha = await remoteCommit(
        "remote-fetch-action.txt",
        "fetch me\n",
        "remote: fetch action",
      );

      await vscode.commands.executeCommand("gitView.gitFetch", uri("README.md"));
      await waitFor(async () => {
        const fetched = (await git(["rev-parse", "origin/master"])).trim();
        return fetched === remoteSha;
      }, "gitFetch should update origin/master for the Explorer-targeted repository");
    });

    test("Pull fast-forwards the current branch from the configured remote", async function () {
      this.timeout(30_000);
      const relativePath = "remote-pull-action.txt";
      await remoteCommit(relativePath, "pull me\n", "remote: pull action");

      await vscode.commands.executeCommand("gitView.gitPull", uri("README.md"));
      await waitFor(async () => {
        try {
          return (await fs.readFile(uri(relativePath).fsPath, "utf8")) === "pull me\n";
        } catch {
          return false;
        }
      }, "gitPull should fast-forward and materialize the remote file");
    });

    test("Branches workflow can be cancelled without changing the current branch", async function () {
      this.timeout(12_000);
      await git(["branch", "explorer-checkout-target"]).catch(() => "");
      const beforeBranch = (await git(["branch", "--show-current"])).trim();

      await executeGitMenuCommand(
        "gitView.gitCheckoutBranch",
        uri("README.md"),
        { timeoutMs: 8_000 },
      );

      const afterBranch = (await git(["branch", "--show-current"])).trim();
      assert.strictEqual(
        afterBranch,
        beforeBranch,
        "cancelling Branches must not checkout another branch",
      );
    });

    test("New Branch workflow can be cancelled without creating a branch", async function () {
      this.timeout(12_000);
      const beforeBranches = await git(["branch", "--format=%(refname:short)"]);

      await executeGitMenuCommand(
        "gitView.gitCreateBranch",
        uri("README.md"),
        { timeoutMs: 8_000 },
      );

      const afterBranches = await git(["branch", "--format=%(refname:short)"]);
      assert.strictEqual(
        afterBranches,
        beforeBranches,
        "cancelling New Branch must not create a branch",
      );
    });

    test("Merge workflow can be cancelled without changing HEAD", async function () {
      this.timeout(12_000);
      await git(["branch", "explorer-merge-target"]).catch(() => "");
      const beforeHead = (await git(["rev-parse", "HEAD"])).trim();

      await executeGitMenuCommand("gitView.gitMerge", uri("README.md"), {
        timeoutMs: 8_000,
      });

      const afterHead = (await git(["rev-parse", "HEAD"])).trim();
      assert.strictEqual(
        afterHead,
        beforeHead,
        "cancelling Merge must not change HEAD",
      );
    });

    test("Rebase workflow can be cancelled without changing HEAD", async function () {
      this.timeout(12_000);
      await git(["branch", "explorer-rebase-target"]).catch(() => "");
      const beforeHead = (await git(["rev-parse", "HEAD"])).trim();

      await executeGitMenuCommand("gitView.gitRebase", uri("README.md"), {
        timeoutMs: 8_000,
      });

      const afterHead = (await git(["rev-parse", "HEAD"])).trim();
      assert.strictEqual(
        afterHead,
        beforeHead,
        "cancelling Rebase must not change HEAD",
      );
    });
  });
});
