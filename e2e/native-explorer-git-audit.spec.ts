/**
 * Native audit — every Explorer Git submenu command must be reachable through
 * the real VS Code context menu and produce an observable UI or Git outcome.
 */
import { test, expect } from "@playwright/test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { GIT_SUBMENU_AUDIT } from "../src/types/gitSubmenuAudit";
import {
  acceptQuickPick,
  clickNativeGitMenu,
  closeNativeVsCode,
  commitFile,
  expectMergeResolverWebviewBoot,
  focusExplorer,
  waitForNativeGitMenuItemEnabled,
  git,
  gitAt,
  launchNativeVsCode,
  prepareCleanGitRepo,
  prepareMergeRepo,
  remoteCommit,
  setupRemote,
  TEST_WORKSPACE,
  waitForWebviewFrame,
} from "./helpers/native-vscode";
import {
  expectGitViewBlameScreen,
  expectGitViewScreen,
  expectGitViewHistoryScreen,
  openExplorerGitAction,
  waitForGitViewBlameFrame,
  waitForGitViewFrame,
  waitForGitViewHistoryFrame,
} from "./helpers/git-screen-parity";

const RESOURCE = "README.md";

test.describe.configure({ mode: "serial" });

async function readWorkspaceFile(relativePath: string): Promise<string> {
  return fs.readFile(path.join(TEST_WORKSPACE, relativePath), "utf8");
}

async function writeWorkspaceFile(
  relativePath: string,
  content: string,
): Promise<void> {
  await fs.writeFile(path.join(TEST_WORKSPACE, relativePath), content, "utf8");
}

async function cachedNames(): Promise<string[]> {
  return (await git(["diff", "--cached", "--name-only"]))
    .trim()
    .split("\n")
    .filter(Boolean);
}

test.describe("Native Explorer Git — audit matrix", () => {
  test("audit manifest covers all 23 submenu commands", () => {
    expect(GIT_SUBMENU_AUDIT).toHaveLength(23);
    const commands = GIT_SUBMENU_AUDIT.map((row) => row.command).sort();
    expect(commands).toContain("gitView.showGitHistory");
    expect(commands).toContain("gitView.gitRebase");
    expect(commands).toContain("gitView.open");
  });

  test("Show History opens history for the clicked resource", async () => {
    await prepareCleanGitRepo();
    const session = await launchNativeVsCode();
    try {
      await openExplorerGitAction(session, RESOURCE, "Show History");
      const frame = await waitForGitViewHistoryFrame(session.app);
      await expectGitViewHistoryScreen(frame, RESOURCE);
    } finally {
      await closeNativeVsCode(session);
    }
  });

  test("Compare with Revision opens a real diff for the clicked file", async () => {
    await prepareCleanGitRepo();
    const before = await readWorkspaceFile(RESOURCE);
    const marker = "audit compare revision marker";
    await writeWorkspaceFile(RESOURCE, `${before}\n${marker}\n`);

    const session = await launchNativeVsCode();
    try {
      await openExplorerGitAction(session, RESOURCE, "Compare with Revision...");
      await acceptQuickPick(session.page);
      const frame = await waitForGitViewFrame(session.app);
      await expectGitViewScreen(frame, {
        titlePart: "Working Tree",
        contains: [marker],
      });
    } finally {
      await closeNativeVsCode(session);
      await writeWorkspaceFile(RESOURCE, before);
    }
  });

  test("Compare with Branch opens a real diff against the selected branch", async () => {
    await prepareCleanGitRepo();
    const branchName = "audit-compare-branch";
    const before = await readWorkspaceFile(RESOURCE);
    const marker = "audit branch comparison marker";
    await git(["checkout", "-b", branchName]);
    await commitFile(
      TEST_WORKSPACE,
      RESOURCE,
      `${before}\n${marker}\n`,
      "audit: branch comparison",
    );
    await git(["checkout", "master"]);

    const session = await launchNativeVsCode();
    try {
      await openExplorerGitAction(session, RESOURCE, "Compare with Branch...");
      await acceptQuickPick(session.page, branchName);
      const frame = await waitForGitViewFrame(session.app);
      await expectGitViewScreen(frame, {
        titlePart: branchName,
        contains: [marker],
      });
    } finally {
      await closeNativeVsCode(session);
    }
  });

  test("Show Diff opens a working-tree diff for the clicked file", async () => {
    await prepareCleanGitRepo();
    const before = await readWorkspaceFile(RESOURCE);
    const marker = "audit diff marker";
    await writeWorkspaceFile(RESOURCE, `${before}\n${marker}\n`);

    const session = await launchNativeVsCode();
    try {
      await openExplorerGitAction(session, RESOURCE, "Show Diff");
      const frame = await waitForGitViewFrame(session.app);
      await expectGitViewScreen(frame, {
        titlePart: "HEAD",
        contains: [marker],
      });
    } finally {
      await closeNativeVsCode(session);
      await writeWorkspaceFile(RESOURCE, before);
    }
  });

  test("Annotate with Git Blame opens the GitView blame panel", async () => {
    await prepareCleanGitRepo();
    const session = await launchNativeVsCode();
    try {
      await openExplorerGitAction(session, RESOURCE, "Annotate with Git Blame");
      const frame = await waitForGitViewBlameFrame(session.app);
      await expectGitViewBlameScreen(frame, { relativePath: RESOURCE });
    } finally {
      await closeNativeVsCode(session);
    }
  });

  test("Annotate with Git Blame stays hidden on Explorer folders", async () => {
    await prepareCleanGitRepo();
    const session = await launchNativeVsCode();
    try {
      await session.app.evaluate(() => {
        globalThis.__gitviewNativeMenus = [];
        globalThis.__gitviewNativeMenuTargetLabels = ["Git"];
      });
      await session.page.bringToFront();
      await focusExplorer(session.page);
      const targetRow = session.page
        .locator('.monaco-list-row[aria-label="src"]')
        .first();
      await targetRow.waitFor({ state: "visible", timeout: 15_000 });
      await targetRow.click();
      const box = await targetRow.boundingBox();
      expect(box).not.toBeNull();
      const clickX = box!.x + Math.min(Math.max(80, box!.width * 0.35), box!.width - 8);
      await session.page.mouse.click(clickX, box!.y + box!.height / 2, {
        button: "right",
      });
      await session.page.waitForTimeout(300);
      const gitLabels = await session.app.evaluate(() => {
        const menus = globalThis.__gitviewNativeMenus as Array<{
          targetLabels?: string[];
          items?: Array<{
            label?: string;
            submenu?: Array<{ label?: string }>;
          }>;
        }>;
        const gitItem = menus
          .flatMap((menu) => menu.items ?? [])
          .find((item) => item.label === "Git");
        return (gitItem?.submenu ?? []).map((row) => row.label).filter(Boolean);
      });
      expect(gitLabels).not.toContain("Annotate with Git Blame");
      expect(gitLabels).not.toContain("Show Diff");
      expect(gitLabels).toContain("Show History");
      expect(gitLabels).toContain("Add");
    } finally {
      await closeNativeVsCode(session);
    }
  });

  test("Rollback confirms and discards only the clicked file changes", async () => {
    await prepareCleanGitRepo();
    const targetBefore = await readWorkspaceFile(RESOURCE);
    const decoy = "audit-rollback-decoy.txt";
    await writeWorkspaceFile(RESOURCE, `${targetBefore}\naudit rollback\n`);
    await writeWorkspaceFile(decoy, "decoy stays\n");

    const session = await launchNativeVsCode();
    try {
      await clickNativeGitMenu(session, RESOURCE, "Rollback");
      await session.page
        .getByRole("button", { name: /^Rollback$/ })
        .click({ timeout: 10_000 });
      await expect
        .poll(async () => readWorkspaceFile(RESOURCE), { timeout: 8_000 })
        .toBe(targetBefore);
      await expect
        .poll(async () => readWorkspaceFile(decoy), { timeout: 2_000 })
        .toBe("decoy stays\n");
    } finally {
      await closeNativeVsCode(session);
    }
  });

  test("Add stages only the clicked file", async () => {
    await prepareCleanGitRepo();
    const target = "audit-add-target.txt";
    const decoy = "audit-add-decoy.txt";
    await writeWorkspaceFile(target, "target\n");
    await writeWorkspaceFile(decoy, "decoy\n");

    const session = await launchNativeVsCode();
    try {
      await openExplorerGitAction(session, target, "Add");
      await expect
        .poll(async () => cachedNames(), { timeout: 8_000 })
        .toEqual([target]);
      await expect
        .poll(async () => git(["status", "--porcelain=v1", "--", decoy]), {
          timeout: 2_000,
        })
        .toBe(`?? ${decoy}\n`);
    } finally {
      await closeNativeVsCode(session);
    }
  });

  test("Unstage removes only the clicked file from the index", async () => {
    await prepareCleanGitRepo();
    const target = "audit-unstage-target.txt";
    const decoy = "audit-unstage-decoy.txt";
    await writeWorkspaceFile(target, "target\n");
    await writeWorkspaceFile(decoy, "decoy\n");
    await git(["add", target, decoy]);

    const session = await launchNativeVsCode();
    try {
      await openExplorerGitAction(session, target, "Unstage");
      await expect
        .poll(async () => cachedNames(), { timeout: 8_000 })
        .toEqual([decoy]);
    } finally {
      await closeNativeVsCode(session);
    }
  });

  test("Commit creates a real commit from the typed message", async () => {
    await prepareCleanGitRepo();
    const commitFileName = "audit-commit.txt";
    const beforeHead = (await git(["rev-parse", "HEAD"])).trim();
    const message = "audit: commit from submenu";
    await writeWorkspaceFile(commitFileName, "commit me\n");

    const session = await launchNativeVsCode();
    try {
      await openExplorerGitAction(session, commitFileName, "Add");
      await waitForNativeGitMenuItemEnabled(session, RESOURCE, "Commit...");
      await openExplorerGitAction(session, RESOURCE, "Commit...");
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
    const message = "audit: commit and push from submenu";
    const commitFileName = "audit-commit-push.txt";
    await writeWorkspaceFile(commitFileName, "commit and push me\n");

    const session = await launchNativeVsCode();
    try {
      await openExplorerGitAction(session, commitFileName, "Add");
      await waitForNativeGitMenuItemEnabled(session, RESOURCE, "Commit and Push...");
      await openExplorerGitAction(session, RESOURCE, "Commit and Push...");
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
      "audit-fetch.txt",
      "fetch me\n",
      "audit: fetch",
    );

    const session = await launchNativeVsCode();
    try {
      await waitForNativeGitMenuItemEnabled(session, RESOURCE, "Fetch");
      await openExplorerGitAction(session, RESOURCE, "Fetch");
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
      "audit-pull.txt",
      "pull me\n",
      "audit: pull",
    );
    await git(["fetch", "origin"]);

    const session = await launchNativeVsCode();
    try {
      await waitForNativeGitMenuItemEnabled(session, RESOURCE, "Pull...");
      await openExplorerGitAction(session, RESOURCE, "Pull...");
      await expect
        .poll(
          async () =>
            fs
              .readFile(path.join(TEST_WORKSPACE, "audit-pull.txt"), "utf8")
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
      "audit-push.txt",
      "push me\n",
      "audit: push",
    );

    const session = await launchNativeVsCode();
    try {
      await openExplorerGitAction(session, RESOURCE, "Push...");
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
      "audit-sync.txt",
      "sync me\n",
      "audit: sync",
    );

    const session = await launchNativeVsCode();
    try {
      await openExplorerGitAction(session, RESOURCE, "Sync");
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
    const branchName = "audit-checkout-target";
    await git(["branch", branchName]);

    const session = await launchNativeVsCode();
    try {
      await openExplorerGitAction(session, RESOURCE, "Branches...");
      const frame = await waitForWebviewFrame(session.app, "branches-popup");
      await frame.getByTestId(`branch-${branchName}`).click();
      await expect
        .poll(async () => (await git(["branch", "--show-current"])).trim(), {
          timeout: 10_000,
        })
        .toBe(branchName);
    } finally {
      await closeNativeVsCode(session);
    }
  });

  test("New Branch creates and checks out the typed branch", async () => {
    await prepareCleanGitRepo();
    const branchName = "audit-created-branch";

    const session = await launchNativeVsCode();
    try {
      await openExplorerGitAction(session, RESOURCE, "New Branch...");
      const frame = await waitForWebviewFrame(
        session.app,
        "create-branch-dialog",
      );
      await frame.getByTestId("create-branch-name").fill(branchName);
      await frame.getByTestId("create-branch-confirm").click();
      await expect
        .poll(async () => (await git(["branch", "--show-current"])).trim(), {
          timeout: 10_000,
        })
        .toBe(branchName);
    } finally {
      await closeNativeVsCode(session);
    }
  });

  test("Stash Changes captures worktree edits", async () => {
    await prepareCleanGitRepo();
    await git(["stash", "clear"]).catch(() => "");
    const before = await readWorkspaceFile(RESOURCE);
    const marker = "audit stash marker";
    await writeWorkspaceFile(RESOURCE, `${before}\n${marker}\n`);

    const session = await launchNativeVsCode();
    try {
      await waitForNativeGitMenuItemEnabled(session, RESOURCE, "Stash Changes...");
      await openExplorerGitAction(session, RESOURCE, "Stash Changes...");
      const frame = await waitForWebviewFrame(
        session.app,
        "stash-changes-dialog",
      );
      await frame
        .getByTestId("stash-changes-message")
        .fill("audit stash message");
      await frame.getByTestId("stash-changes-confirm").click();
      await expect(frame.getByTestId("stash-changes-dialog")).toHaveCount(0, {
        timeout: 15_000,
      });
      await expect
        .poll(
          async () => {
            const current = await readWorkspaceFile(RESOURCE);
            const stashList = await git(["stash", "list"]);
            return (
              !current.includes(marker) &&
              stashList.includes("audit stash message")
            );
          },
          { timeout: 10_000 },
        )
        .toBe(true);
    } finally {
      await closeNativeVsCode(session);
      await git(["stash", "clear"]).catch(() => "");
    }
  });

  test("Unstash Changes restores the latest stash", async () => {
    await prepareCleanGitRepo();
    await git(["stash", "clear"]).catch(() => "");
    const before = await readWorkspaceFile(RESOURCE);
    const marker = "audit unstash marker";
    await writeWorkspaceFile(RESOURCE, `${before}\n${marker}\n`);
    await git(["stash", "push", "-m", "audit unstash seed", "--", RESOURCE]);
    expect(await git(["stash", "list"])).toContain("stash@{0}");
    expect(await git(["status", "--porcelain"])).not.toContain(RESOURCE);

    const session = await launchNativeVsCode();
    try {
      await waitForNativeGitMenuItemEnabled(
        session,
        RESOURCE,
        "Unstash Changes...",
      );
      await openExplorerGitAction(session, RESOURCE, "Unstash Changes...");
      const frame = await waitForWebviewFrame(session.app, "unstash-dialog");
      await frame.getByTestId("stash-entry-0").click();
      await frame.getByTestId("unstash-pop").check();
      await frame.getByTestId("unstash-confirm").click();
      await expect
        .poll(async () => (await readWorkspaceFile(RESOURCE)).includes(marker), {
          timeout: 10_000,
        })
        .toBe(true);
    } finally {
      await closeNativeVsCode(session);
      await git(["stash", "clear"]).catch(() => "");
    }
  });

  test("Shelve Changes captures edits without creating a Git stash", async () => {
    await prepareCleanGitRepo();
    await git(["stash", "clear"]).catch(() => "");
    const before = await readWorkspaceFile(RESOURCE);
    const marker = "audit shelve marker";
    await writeWorkspaceFile(RESOURCE, `${before}\n${marker}\n`);

    const session = await launchNativeVsCode();
    try {
      await waitForNativeGitMenuItemEnabled(
        session,
        RESOURCE,
        "Shelve Changes...",
      );
      await openExplorerGitAction(session, RESOURCE, "Shelve Changes...");
      await expect
        .poll(
          async () => {
            const current = await readWorkspaceFile(RESOURCE);
            const stashList = await git(["stash", "list"]);
            return (
              !current.includes(marker) && !stashList.includes("stash@{0}")
            );
          },
          { timeout: 10_000 },
        )
        .toBe(true);
    } finally {
      await closeNativeVsCode(session);
      await git(["stash", "clear"]).catch(() => "");
    }
  });

  test("Unshelve Changes restores the latest shelf", async () => {
    await prepareCleanGitRepo();
    await git(["stash", "clear"]).catch(() => "");
    const before = await readWorkspaceFile(RESOURCE);
    const marker = "audit unshelve marker";
    await writeWorkspaceFile(RESOURCE, `${before}\n${marker}\n`);

    const session = await launchNativeVsCode();
    try {
      await waitForNativeGitMenuItemEnabled(
        session,
        RESOURCE,
        "Shelve Changes...",
      );
      await openExplorerGitAction(session, RESOURCE, "Shelve Changes...");
      await expect
        .poll(async () => !(await readWorkspaceFile(RESOURCE)).includes(marker), {
          timeout: 10_000,
        })
        .toBe(true);
      await waitForNativeGitMenuItemEnabled(
        session,
        RESOURCE,
        "Unshelve Changes...",
      );
      await openExplorerGitAction(session, RESOURCE, "Unshelve Changes...");
      await expect
        .poll(async () => (await readWorkspaceFile(RESOURCE)).includes(marker), {
          timeout: 10_000,
        })
        .toBe(true);
    } finally {
      await closeNativeVsCode(session);
      await git(["stash", "clear"]).catch(() => "");
    }
  });

  test("Merge merges the selected branch into the current branch", async () => {
    await prepareCleanGitRepo();
    const branchName = "audit-merge-target";
    await git(["checkout", "-b", branchName]);
    await commitFile(
      TEST_WORKSPACE,
      "audit-merge.txt",
      "merge me\n",
      "audit: merge target",
    );
    await git(["checkout", "master"]);

    const session = await launchNativeVsCode();
    try {
      await openExplorerGitAction(session, RESOURCE, "Merge...");
      const frame = await waitForWebviewFrame(
        session.app,
        "merge-branch-dialog",
      );
      await frame.getByTestId("merge-branch-ref").selectOption(branchName);
      await frame.getByTestId("merge-branch-confirm").click();
      await expect
        .poll(
          async () =>
            fs
              .readFile(path.join(TEST_WORKSPACE, "audit-merge.txt"), "utf8")
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
    const targetBranch = "audit-rebase-target";
    const workBranch = "audit-rebase-work";
    await git(["checkout", "-b", targetBranch]);
    await commitFile(
      TEST_WORKSPACE,
      "audit-rebase-base.txt",
      "base\n",
      "audit: rebase target",
    );
    await git(["checkout", "-b", workBranch, "master"]);
    await commitFile(
      TEST_WORKSPACE,
      "audit-rebase-work.txt",
      "work\n",
      "audit: rebase work",
    );

    const session = await launchNativeVsCode();
    try {
      await openExplorerGitAction(session, RESOURCE, "Rebase...");
      const frame = await waitForWebviewFrame(
        session.app,
        "rebase-onto-dialog",
      );
      await frame.getByTestId("rebase-onto-ref").selectOption(targetBranch);
      await frame.getByTestId("rebase-onto-confirm").click();
      await expect
        .poll(
          async () =>
            fs
              .readFile(
                path.join(TEST_WORKSPACE, "audit-rebase-base.txt"),
                "utf8",
              )
              .catch(() => ""),
          { timeout: 10_000 },
        )
        .toBe("base\n");
      expect((await git(["branch", "--show-current"])).trim()).toBe(
        workBranch,
      );
    } finally {
      await closeNativeVsCode(session);
    }
  });

  test("Resolve conflict opens the merge resolver", async () => {
    await prepareMergeRepo();

    const session = await launchNativeVsCode();
    try {
      await openExplorerGitAction(
        session,
        "file.txt",
        "Resolve conflict",
      );
      const frame = await waitForWebviewFrame(session.app, "pane-left");
      await expectMergeResolverWebviewBoot(frame, "file.txt");
    } finally {
      await closeNativeVsCode(session);
    }
  });
});
