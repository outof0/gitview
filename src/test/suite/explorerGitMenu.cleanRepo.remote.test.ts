/**
 * VS Code integration: Explorer / Editor / SCM right-click → Git submenu.
 */
import * as assert from "assert";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import {
  gitCommit,
  gitCommitAndPush,
} from "../../commands/gitMenuStagingActions";
import {
  executeGitMenuCommand,
  findExtension,
  workspaceRoot,
  uri,
  git,
  gitAt,
  waitFor,
  vscodeGitRepository,
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

    test("Commit creates a real commit from the Explorer-targeted repository", async function () {
      this.timeout(20_000);
      const relativePath = "local-commit-action.txt";
      const beforeHead = (await git(["rev-parse", "HEAD"])).trim();

      try {
        await fs.writeFile(uri(relativePath).fsPath, "commit me\n", "utf8");
        await git(["add", relativePath]);

        const repository = await vscodeGitRepository();
        repository.inputBox.value = "local: commit action";

        await gitCommit(uri("README.md"));
        await waitFor(async () => {
          const head = (await git(["rev-parse", "HEAD"])).trim();
          return head !== beforeHead;
        }, "gitCommit should create a new commit from the staged Explorer repository");
      } finally {
        const head = (await git(["rev-parse", "HEAD"])).trim();
        if (head !== beforeHead) {
          await git(["reset", "--hard", beforeHead]).catch(() => "");
        } else {
          await git(["reset", "--", relativePath]).catch(() => "");
          await fs.rm(uri(relativePath).fsPath, { force: true });
        }
      }
    });

    test("Commit and Push creates a commit and updates the configured remote", async function () {
      this.timeout(20_000);
      const relativePath = "local-commit-push-action.txt";
      const beforeHead = (await git(["rev-parse", "HEAD"])).trim();

      try {
        await fs.writeFile(uri(relativePath).fsPath, "commit and push me\n", "utf8");
        await git(["add", relativePath]);

        const repository = await vscodeGitRepository();
        repository.inputBox.value = "local: commit and push action";

        await gitCommitAndPush(uri("README.md"));
        await waitFor(async () => {
          const head = (await git(["rev-parse", "HEAD"])).trim();
          await gitAt(remoteClone, ["fetch", "origin", "master"]);
          const remoteHead = (
            await gitAt(remoteClone, ["rev-parse", "origin/master"])
          ).trim();
          return head !== beforeHead && remoteHead === head;
        }, "gitCommitAndPush should commit staged changes and push HEAD to origin/master");
      } finally {
        const head = (await git(["rev-parse", "HEAD"])).trim();
        if (head !== beforeHead) {
          await git(["reset", "--hard", beforeHead]).catch(() => "");
          await git(["push", "--force-with-lease", "origin", "master"]).catch(
            () => "",
          );
        } else {
          await git(["reset", "--", relativePath]).catch(() => "");
          await fs.rm(uri(relativePath).fsPath, { force: true });
        }
      }
    });

    test("Push sends a local commit to the configured remote", async function () {
      this.timeout(15_000);
      const localSha = await commitFile(
        workspaceRoot(),
        "local-push-action.txt",
        "push me\n",
        "local: push action",
      );

      await executeGitMenuCommand("gitView.gitPush", uri("README.md"), {
        timeoutMs: 8_000,
      });
      await waitFor(async () => {
        const remoteSha = (
          await gitAt(remoteClone, ["rev-parse", "origin/master"])
        ).trim();
        await gitAt(remoteClone, ["fetch", "origin", "master"]);
        const fetched = (
          await gitAt(remoteClone, ["rev-parse", "origin/master"])
        ).trim();
        return remoteSha === localSha || fetched === localSha;
      }, "gitPush should send the local commit to origin/master");
    });

    test("Sync pushes a local commit to the configured remote", async function () {
      this.timeout(15_000);
      const localSha = await commitFile(
        workspaceRoot(),
        "local-sync-action.txt",
        "sync me\n",
        "local: sync action",
      );

      await executeGitMenuCommand("gitView.gitSync", uri("README.md"), {
        timeoutMs: 8_000,
      });
      await waitFor(async () => {
        await gitAt(remoteClone, ["fetch", "origin", "master"]);
        const fetched = (
          await gitAt(remoteClone, ["rev-parse", "origin/master"])
        ).trim();
        return fetched === localSha;
      }, "gitSync should push the local commit to origin/master");
    });
  });
});
