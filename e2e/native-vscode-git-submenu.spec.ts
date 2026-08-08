import { test, expect } from "@playwright/test";
import * as fs from "fs/promises";
import * as path from "path";
import {
  clickNativeGitMenu,
  closeNativeVsCode,
  commitFile,
  expectTextInAnyWindow,
  git,
  gitAt,
  launchNativeVsCode,
  prepareCleanGitRepo,
  prepareMergeRepo,
  remoteCommit,
  setupRemote,
  TEST_WORKSPACE,
  waitForNativeGitMenuItemDisabled,
  waitForNativeGitMenuItemEnabled,
  waitForWebviewFrame,
} from "./helpers/native-vscode";
test.describe.configure({ mode: "serial" });

test.describe("VS Code native Explorer Git submenu", () => {
  test("Rollback confirms and discards only the clicked file changes", async () => {
    await prepareCleanGitRepo();
    const readmePath = path.join(TEST_WORKSPACE, "README.md");
    const before = await fs.readFile(readmePath, "utf8");
    await fs.writeFile(readmePath, `${before}\nnative rollback\n`, "utf8");

    const session = await launchNativeVsCode();
    try {
      await clickNativeGitMenu(session, "README.md", "Rollback");
      await session.page
        .getByRole("button", { name: /^Rollback$/ })
        .click({ timeout: 10_000 });
      await expect
        .poll(async () => fs.readFile(readmePath, "utf8"), { timeout: 8_000 })
        .toBe(before);
    } finally {
      await closeNativeVsCode(session);
    }
  });

  test("Add and Unstage mutate only the right-clicked file", async () => {
    await prepareCleanGitRepo();
    const targetFile = "native-target-add.txt";
    const decoyFile = "native-decoy-add.txt";
    await fs.writeFile(
      path.join(TEST_WORKSPACE, targetFile),
      "target\n",
      "utf8",
    );
    await fs.writeFile(path.join(TEST_WORKSPACE, decoyFile), "decoy\n", "utf8");

    const session = await launchNativeVsCode();
    try {
      await clickNativeGitMenu(session, targetFile, "Add");
      await expect
        .poll(async () => git(["diff", "--cached", "--name-only"]), {
          timeout: 8_000,
        })
        .toBe(`${targetFile}\n`);
      await expect
        .poll(async () => git(["status", "--porcelain=v1", "--", decoyFile]), {
          timeout: 2_000,
        })
        .toBe(`?? ${decoyFile}\n`);

      await git(["add", decoyFile]);
      await clickNativeGitMenu(session, targetFile, "Unstage");
      await expect
        .poll(async () => git(["diff", "--cached", "--name-only"]), {
          timeout: 8_000,
        })
        .toBe(`${decoyFile}\n`);
    } finally {
      await closeNativeVsCode(session);
    }
  });

  test("Commit creates a real commit from the typed message", async () => {
    await prepareCleanGitRepo();
    const beforeHead = (await git(["rev-parse", "HEAD"])).trim();
    const message = "native: commit from submenu";
    const commitFileName = "native-commit.txt";
    await fs.writeFile(
      path.join(TEST_WORKSPACE, commitFileName),
      "commit me\n",
      "utf8",
    );

    const session = await launchNativeVsCode();
    try {
      await clickNativeGitMenu(session, commitFileName, "Add");
      await waitForNativeGitMenuItemEnabled(session, "README.md", "Commit...");
      await clickNativeGitMenu(session, "README.md", "Commit...");
      const frame = await waitForWebviewFrame(session.app, "commit-dialog");
      await frame.getByTestId("commit-dialog-message").fill(message);
      await frame.getByTestId("commit-dialog-commit").click();
      await expect
        .poll(async () => (await git(["rev-parse", "HEAD"])).trim(), {
          timeout: 10_000,
        })
        .not.toBe(beforeHead);
      await expect
        .poll(async () => (await git(["log", "-1", "--pretty=%s"])).trim(), {
          timeout: 2_000,
        })
        .toBe(message);
    } finally {
      await closeNativeVsCode(session);
    }
  });

  test("Commit and Push creates a commit and updates origin", async () => {
    await prepareCleanGitRepo();
    const { remoteParent, remoteClone } = await setupRemote();
    const beforeHead = (await git(["rev-parse", "HEAD"])).trim();
    const message = "native: commit and push from submenu";
    const commitFileName = "native-commit-push.txt";
    await fs.writeFile(
      path.join(TEST_WORKSPACE, commitFileName),
      "commit and push me\n",
      "utf8",
    );

    const session = await launchNativeVsCode();
    try {
      await clickNativeGitMenu(session, commitFileName, "Add");
      await waitForNativeGitMenuItemEnabled(session, "README.md", "Commit and Push...");
      await clickNativeGitMenu(session, "README.md", "Commit and Push...");
      const frame = await waitForWebviewFrame(session.app, "commit-dialog");
      await frame.getByTestId("commit-dialog-message").fill(message);
      await frame.getByTestId("commit-dialog-commit-and-push").click();
      await expect
        .poll(
          async () => {
            const head = (await git(["rev-parse", "HEAD"])).trim();
            await gitAt(remoteClone, ["fetch", "origin", "master"]);
            const remoteHead = (
              await gitAt(remoteClone, ["rev-parse", "origin/master"])
            ).trim();
            return head !== beforeHead && remoteHead === head;
          },
          { timeout: 15_000 },
        )
        .toBe(true);
    } finally {
      await closeNativeVsCode(session);
      await fs.rm(remoteParent, { recursive: true, force: true });
    }
  });

  test("Fetch updates origin/master from the configured remote", async () => {
    await prepareCleanGitRepo();
    const { remoteParent, remoteClone } = await setupRemote();
    const remoteSha = await remoteCommit(
      remoteClone,
      "native-fetch.txt",
      "fetch me\n",
      "native: fetch",
    );

    const session = await launchNativeVsCode();
    try {
      await waitForNativeGitMenuItemEnabled(session, "README.md", "Fetch");
      await clickNativeGitMenu(session, "README.md", "Fetch");
      await expect
        .poll(async () => (await git(["rev-parse", "origin/master"])).trim(), {
          timeout: 20_000,
        })
        .toBe(remoteSha);
    } finally {
      await closeNativeVsCode(session);
      await fs.rm(remoteParent, { recursive: true, force: true });
    }
  });

  test("Pull fast-forwards and materializes remote files", async () => {
    await prepareCleanGitRepo();
    const { remoteParent, remoteClone } = await setupRemote();
    await remoteCommit(
      remoteClone,
      "native-pull.txt",
      "pull me\n",
      "native: pull",
    );
    await git(["fetch", "origin"]);

    const session = await launchNativeVsCode();
    try {
      await waitForNativeGitMenuItemEnabled(session, "README.md", "Pull...");
      await clickNativeGitMenu(session, "README.md", "Pull...");
      await expect
        .poll(
          async () =>
            fs
              .readFile(path.join(TEST_WORKSPACE, "native-pull.txt"), "utf8")
              .catch(() => ""),
          { timeout: 10_000 },
        )
        .toBe("pull me\n");
    } finally {
      await closeNativeVsCode(session);
      await fs.rm(remoteParent, { recursive: true, force: true });
    }
  });

  test("Push sends a local commit to origin", async () => {
    await prepareCleanGitRepo();
    const { remoteParent, remoteClone } = await setupRemote();
    const localSha = await commitFile(
      TEST_WORKSPACE,
      "native-push.txt",
      "push me\n",
      "native: push",
    );

    const session = await launchNativeVsCode();
    try {
      await clickNativeGitMenu(session, "README.md", "Push...");
      await expect
        .poll(
          async () => {
            await gitAt(remoteClone, ["fetch", "origin", "master"]);
            return (
              await gitAt(remoteClone, ["rev-parse", "origin/master"])
            ).trim();
          },
          { timeout: 10_000 },
        )
        .toBe(localSha);
    } finally {
      await closeNativeVsCode(session);
      await fs.rm(remoteParent, { recursive: true, force: true });
    }
  });

  test("Sync pushes a local commit to origin", async () => {
    await prepareCleanGitRepo();
    const { remoteParent, remoteClone } = await setupRemote();
    const localSha = await commitFile(
      TEST_WORKSPACE,
      "native-sync.txt",
      "sync me\n",
      "native: sync",
    );

    const session = await launchNativeVsCode();
    try {
      await clickNativeGitMenu(session, "README.md", "Sync");
      await expect
        .poll(
          async () => {
            await gitAt(remoteClone, ["fetch", "origin", "master"]);
            return (
              await gitAt(remoteClone, ["rev-parse", "origin/master"])
            ).trim();
          },
          { timeout: 10_000 },
        )
        .toBe(localSha);
    } finally {
      await closeNativeVsCode(session);
      await fs.rm(remoteParent, { recursive: true, force: true });
    }
  });

  test("Branches checks out the selected branch", async () => {
    await prepareCleanGitRepo();
    await git(["branch", "native-checkout-target"]);

    const session = await launchNativeVsCode();
    try {
      await clickNativeGitMenu(session, "README.md", "Branches...");
      const frame = await waitForWebviewFrame(session.app, "branches-popup");
      await frame.getByTestId("branch-native-checkout-target").click();
      await expect
        .poll(async () => (await git(["branch", "--show-current"])).trim(), {
          timeout: 10_000,
        })
        .toBe("native-checkout-target");
    } finally {
      await closeNativeVsCode(session);
    }
  });

  test("New Branch opens the panel dialog and creates the typed branch", async () => {
    await prepareCleanGitRepo();
    const branchName = "native-created-branch";

    const session = await launchNativeVsCode();
    try {
      await clickNativeGitMenu(session, "README.md", "New Branch...");
      const frame = await waitForWebviewFrame(session.app, "create-branch-dialog");
      await frame.getByTestId("create-branch-name").fill(branchName);
      await frame.getByTestId("create-branch-confirm").click();
      await expect
        .poll(async () => (await git(["branch", "--show-current"])).trim(), {
          timeout: 15_000,
        })
        .toBe(branchName);
    } finally {
      await closeNativeVsCode(session);
    }
  });

  test("Stash and Unstash round-trip working-tree changes", async () => {
    await prepareCleanGitRepo();
    const readmePath = path.join(TEST_WORKSPACE, "README.md");
    const before = await fs.readFile(readmePath, "utf8");
    const marker = "native stash marker";
    await fs.writeFile(readmePath, `${before}\n${marker}\n`, "utf8");

    const session = await launchNativeVsCode();
    try {
      await clickNativeGitMenu(session, "README.md", "Stash Changes...");
      const stashFrame = await waitForWebviewFrame(
        session.app,
        "stash-changes-dialog",
      );
      await stashFrame
        .getByTestId("stash-changes-message")
        .fill("native stash message");
      await stashFrame.getByTestId("stash-changes-confirm").click();
      await expect(stashFrame.getByTestId("stash-changes-dialog")).toHaveCount(
        0,
        { timeout: 15_000 },
      );
      await expect
        .poll(
          async () => {
            const current = await fs.readFile(readmePath, "utf8");
            const stashList = await git(["stash", "list"]);
            return (
              !current.includes(marker) &&
              stashList.includes("native stash message")
            );
          },
          { timeout: 10_000 },
        )
        .toBe(true);

      await clickNativeGitMenu(session, "README.md", "Unstash Changes...");
      const unstashFrame = await waitForWebviewFrame(
        session.app,
        "unstash-dialog",
      );
      await unstashFrame.getByTestId("stash-entry-0").click();
      await unstashFrame.getByTestId("unstash-pop").check();
      await unstashFrame.getByTestId("unstash-confirm").click();
      await expect
        .poll(
          async () => (await fs.readFile(readmePath, "utf8")).includes(marker),
          { timeout: 10_000 },
        )
        .toBe(true);
    } finally {
      await closeNativeVsCode(session);
    }
  });

  test("Shelve and Unshelve round-trip without using Git stash", async () => {
    await prepareCleanGitRepo();
    await git(["stash", "clear"]).catch(() => "");
    const readmePath = path.join(TEST_WORKSPACE, "README.md");
    const before = await fs.readFile(readmePath, "utf8");
    const marker = "native shelve marker";
    await fs.writeFile(readmePath, `${before}\n${marker}\n`, "utf8");

    const session = await launchNativeVsCode();
    try {
      await clickNativeGitMenu(session, "README.md", "Shelve Changes...");
      await expect
        .poll(
          async () => {
            const current = await fs.readFile(readmePath, "utf8");
            const stashList = await git(["stash", "list"]);
            return (
              !current.includes(marker) && !stashList.includes("stash@{0}")
            );
          },
          { timeout: 10_000 },
        )
        .toBe(true);

      await clickNativeGitMenu(session, "README.md", "Unshelve Changes...");
      await expect
        .poll(
          async () => (await fs.readFile(readmePath, "utf8")).includes(marker),
          { timeout: 10_000 },
        )
        .toBe(true);
    } finally {
      await closeNativeVsCode(session);
    }
  });

  test("Merge merges the selected branch into the current branch", async () => {
    await prepareCleanGitRepo();
    await git(["checkout", "-b", "native-merge-target"]);
    await commitFile(
      TEST_WORKSPACE,
      "native-merge.txt",
      "merge me\n",
      "native: merge target",
    );
    await git(["checkout", "master"]);

    const session = await launchNativeVsCode();
    try {
      await clickNativeGitMenu(session, "README.md", "Merge...");
      const frame = await waitForWebviewFrame(session.app, "merge-branch-dialog");
      await frame
        .getByTestId("merge-branch-ref")
        .selectOption("native-merge-target");
      await frame.getByTestId("merge-branch-confirm").click();
      await expect
        .poll(
          async () =>
            fs
              .readFile(path.join(TEST_WORKSPACE, "native-merge.txt"), "utf8")
              .catch(() => ""),
          { timeout: 10_000 },
        )
        .toBe("merge me\n");
    } finally {
      await closeNativeVsCode(session);
    }
  });

  test("Rebase rebases the current branch onto the selected branch", async () => {
    await prepareCleanGitRepo();
    await git(["checkout", "-b", "native-rebase-target"]);
    await commitFile(
      TEST_WORKSPACE,
      "native-rebase-base.txt",
      "base\n",
      "native: rebase target",
    );
    await git(["checkout", "-b", "native-rebase-work", "master"]);
    await commitFile(
      TEST_WORKSPACE,
      "native-rebase-work.txt",
      "work\n",
      "native: rebase work",
    );

    const session = await launchNativeVsCode();
    try {
      await clickNativeGitMenu(session, "README.md", "Rebase...");
      const frame = await waitForWebviewFrame(session.app, "rebase-onto-dialog");
      await frame
        .getByTestId("rebase-onto-ref")
        .selectOption("native-rebase-target");
      await frame.getByTestId("rebase-onto-confirm").click();
      await expect
        .poll(
          async () =>
            fs
              .readFile(
                path.join(TEST_WORKSPACE, "native-rebase-base.txt"),
                "utf8",
              )
              .catch(() => ""),
          { timeout: 10_000 },
        )
        .toBe("base\n");
      expect((await git(["branch", "--show-current"])).trim()).toBe(
        "native-rebase-work",
      );
    } finally {
      await closeNativeVsCode(session);
    }
  });

  test("Resolve conflict opens the merge resolver", async () => {
    await prepareMergeRepo();

    const session = await launchNativeVsCode();
    try {
      await clickNativeGitMenu(
        session,
        "file.txt",
        "Resolve conflict",
      );
      await expectTextInAnyWindow(
        session.app,
        /Resolve Conflicts\s+—\s+file\.txt/,
      );
    } finally {
      await closeNativeVsCode(session);
    }
  });

  test("Mid-merge disables Stash, Shelve, Unstash, Merge, and Commit", async () => {
    await prepareMergeRepo();
    // Ensure no leftover stash from prior tests so Unstash stays disabled.
    await git(["stash", "clear"]).catch(() => "");

    const session = await launchNativeVsCode();
    try {
      // Dirty + conflicted: stash must still be disabled (Git cannot rewrite the index).
      await waitForNativeGitMenuItemDisabled(
        session,
        "README.md",
        "Stash Changes...",
      );
      await waitForNativeGitMenuItemDisabled(
        session,
        "README.md",
        "Shelve Changes...",
      );
      await waitForNativeGitMenuItemDisabled(
        session,
        "README.md",
        "Unstash Changes...",
      );
      await waitForNativeGitMenuItemDisabled(session, "README.md", "Merge...");
      await waitForNativeGitMenuItemDisabled(session, "README.md", "Commit...");
      // Resolve remains available during merge conflicts.
      await waitForNativeGitMenuItemEnabled(
        session,
        "file.txt",
        "Resolve conflict",
      );
    } finally {
      await closeNativeVsCode(session);
    }
  });
});
