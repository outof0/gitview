/**
 * E2E smoke: webview Git host executes real repository mutations.
 *
 * Full GitView workflow coverage lives in:
 * - merge-git-context-menu.spec.ts (merge resolver surfaces)
 * - conflicts-context-menu.spec.ts (conflicts dialog surfaces)
 * - git-*-screen.spec.ts (standalone Diff / Blame Vite screens)
 * - native-git-*-screen.spec.ts (Explorer → GitView panels in real VS Code)
 * - native-vscode-git-submenu.spec.ts (repo-wide Git commands)
 */
import { test } from "@playwright/test";
import {
  loadRealBlame,
  loadRealChangesFromSide,
  loadRealFileLog,
  loadRealMergeDocument,
} from "./helpers/real-repo";
import type { HostFixtures } from "./helpers/host";
import {
  buildSimpleConflictDoc,
  installRealGitHost,
  openMergeResolver,
  setupMergeFixtures,
} from "./helpers/merge";
import { E2E_REPO_ROOT } from "./helpers/git-actions";
import { openMergePaneGitMenu } from "./helpers/menus";
import {
  removeTestArtifacts,
  runAddParity,
  writeUntrackedFile,
} from "./helpers/git-submenu-parity";

const STAGE_FILE = "e2e-host-pipeline-stage.txt";

let fixtures: HostFixtures;

test.beforeAll(async () => {
  const baseDoc = await loadRealMergeDocument();
  const stageDoc = buildSimpleConflictDoc({
    repoRoot: baseDoc.repoRoot,
    relativePath: STAGE_FILE,
  });
  fixtures = {
    mergeDocument: stageDoc,
    mergeDocumentsByPath: { [STAGE_FILE]: stageDoc },
    blameOurs: await loadRealBlame("ours"),
    blameTheirs: await loadRealBlame("theirs"),
    fileLog: await loadRealFileLog(),
    changesFromSide: await loadRealChangesFromSide(),
    conflictFiles: [{ relativePath: STAGE_FILE, stageCode: "UU" }],
  };
  await setupMergeFixtures(fixtures);
});

test("real Git host pipeline stages the scoped file after Git → Add", async ({
  page,
}) => {
  await removeTestArtifacts(E2E_REPO_ROOT, [STAGE_FILE]);
  await writeUntrackedFile(E2E_REPO_ROOT, STAGE_FILE, "host pipeline\n");

  await installRealGitHost(page, fixtures);
  await openMergeResolver(page, STAGE_FILE);
  await openMergePaneGitMenu(page, "left");
  await runAddParity(page, E2E_REPO_ROOT, STAGE_FILE);
});