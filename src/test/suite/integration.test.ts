import * as assert from "assert";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { acceptOurs } from "../../core/resolve";
import { reflowResultRanges, serializeResult } from "../../core/serialize";
import { hasLeftoverMarkers } from "../../core/markers";
import { buildMergeDocument } from "../../core";
import type { MergeDocument } from "../../core/types";
import { createGitService } from "../../services/gitService";

import { DEFAULT_GITVIEW_SETTINGS } from "../../types/settings";
import type { HostToWebview } from "../../shared/protocol";
import { makeHandler } from "../../webview/__tests__/mergeResolveHost.helpers";
import {
  tabLabels,
  waitFor,
} from "./explorerGitMenu.helpers";

// The extension has no `publisher` in package.json, so the resolved id in dev
// mode is non-deterministic. Match by packageJSON.name instead.
function findExtension(): vscode.Extension<unknown> | undefined {
  return vscode.extensions.all.find(
    (e) => (e.packageJSON as { name?: string })?.name === "gitview",
  );
}

function workspaceRoot(): string {
  const folder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(folder, "expected a workspace folder (test-conflict-repo)");
  return folder.uri.fsPath;
}

suite("GitView integration", () => {
  suiteSetup(async function () {
    this.timeout(60_000);
    const ext = findExtension();
    assert.ok(ext, "extension gitview should be discoverable");
    await ext.activate();
  });

  test("extension is present and active", () => {
    const ext = findExtension();
    assert.ok(ext, "extension should be present");
    assert.strictEqual(ext.isActive, true, "extension should be active");
  });

  test("all three commands are registered", async () => {
    const commands = await vscode.commands.getCommands(true);
    for (const id of [
      "gitView.open",
      "gitView.refresh",
      "gitView.resolveCurrentFile",
    ]) {
      assert.ok(commands.includes(id), `command ${id} should be registered`);
    }
  });

  test("executing gitView.open creates a webview panel", async function () {
    this.timeout(30_000);
    await vscode.commands.executeCommand("gitView.open");
    await waitFor(
      () => tabLabels().includes("GitView"),
      "a GitView webview panel should have been created",
    );
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  });

  test("git service resolves the real conflict repo and stages", async function () {
    this.timeout(30_000);
    const git = createGitService();
    const root = workspaceRoot();

    const repoRoot = await git.findRepoRoot(root);
    assert.ok(repoRoot, "findRepoRoot should resolve the git repo");

    const unmerged = await git.listUnmergedFiles(repoRoot);
    const conflict = unmerged.find((u) => u.relativePath === "file.txt");
    assert.ok(conflict, "file.txt should be reported as unmerged");
    assert.strictEqual(
      conflict.stageCode,
      "UU",
      "file.txt should have an unmerged (UU) status code",
    );

    const ours = await git.readStage(repoRoot, "file.txt", 2);
    const theirs = await git.readStage(repoRoot, "file.txt", 3);
    assert.ok(ours && ours.includes("change"), "stage 2 (ours) content");
    assert.ok(theirs && theirs.includes("change"), "stage 3 (theirs) content");
    assert.notStrictEqual(ours, theirs, "ours and theirs differ");
  });

  test("markers merge engine parses worktree markers on real conflict file", async function () {
    this.timeout(30_000);
    const git = createGitService();
    const root = workspaceRoot();
    const repoRoot = await git.findRepoRoot(root);
    assert.ok(repoRoot, "findRepoRoot should resolve the git repo");

    const worktree = await vscode.workspace.fs.readFile(
      vscode.Uri.file(path.join(repoRoot, "file.txt")),
    );
    const worktreeText = Buffer.from(worktree).toString("utf8");
    assert.ok(worktreeText.includes("<<<<<<<"), "worktree should contain markers");

    const markersDoc = buildMergeDocument({
      repoRoot,
      relativePath: "file.txt",
      absolutePath: path.join(repoRoot, "file.txt"),
      base: null,
      ours: null,
      theirs: null,
      worktree: worktreeText,
      mergeEngine: "markers",
    });

    assert.ok(
      markersDoc.blocks.some((b) => b.kind === "conflict"),
      "markers engine should find conflict blocks in worktree markers",
    );
    assert.strictEqual(
      markersDoc.blocks.every((b) => b.kind !== "ours_only"),
      true,
      "markers engine must not emit three-way-only block kinds",
    );
  });

  test("building a MergeDocument from real stages yields a conflict block", async function () {
    this.timeout(30_000);
    const git = createGitService();
    const root = workspaceRoot();
    const repoRoot = await git.findRepoRoot(root);
    assert.ok(repoRoot, "findRepoRoot should resolve the git repo");

    const base = await git.readStage(repoRoot, "file.txt", 1);
    const ours = await git.readStage(repoRoot, "file.txt", 2);
    const theirs = await git.readStage(repoRoot, "file.txt", 3);

    const doc = buildMergeDocument({
      repoRoot,
      relativePath: "file.txt",
      absolutePath: path.join(repoRoot, "file.txt"),
      base,
      ours,
      theirs,
      worktree: ours ?? "",
    });

    const conflictBlocks = doc.blocks.filter((b) => b.kind === "conflict");
    assert.ok(
      conflictBlocks.length > 0,
      "MergeDocument should contain at least one conflict block",
    );
    assert.ok(
      doc.conflictOrder.length > 0,
      "conflictOrder should list the conflict block",
    );
  });

  test("git blame returns lines for ours and theirs during merge", async function () {
    this.timeout(30_000);
    const git = createGitService();
    const root = workspaceRoot();
    const repoRoot = await git.findRepoRoot(root);
    assert.ok(repoRoot, "findRepoRoot should resolve the git repo");

    const ours = await git.blameFileForSide(repoRoot, "file.txt", "ours");
    assert.strictEqual(ours.ok, true, "blame for ours should succeed");
    if (ours.ok) {
      assert.ok(ours.lines.length > 0, "ours blame should contain lines");
      assert.ok(ours.lines[0]!.author, "blame line should have author");
      assert.ok(ours.lines[0]!.sha, "blame line should have sha");
    }

    const theirs = await git.blameFileForSide(repoRoot, "file.txt", "theirs");
    assert.strictEqual(theirs.ok, true, "blame for theirs should succeed");
    if (theirs.ok) {
      assert.ok(theirs.lines.length > 0, "theirs blame should contain lines");
    }
  });

  test("logChangesFromSide returns merge-scoped commits for ours", async function () {
    this.timeout(30_000);
    const git = createGitService();
    const root = workspaceRoot();
    const repoRoot = await git.findRepoRoot(root);
    assert.ok(repoRoot, "findRepoRoot should resolve the git repo");

    const changes = await git.logChangesFromSide(repoRoot, "ours", {
      filterPath: "file.txt",
      limit: 20,
    });
    assert.strictEqual(
      changes.ok,
      true,
      "changes-from-side should succeed during merge",
    );
    if (changes.ok) {
      assert.ok(
        changes.revisionRange.includes(".."),
        "revision range should be merge-base..tip",
      );
      assert.ok(
        Array.isArray(changes.commits),
        "commits list should be present",
      );
      assert.ok(
        Array.isArray(changes.allChangedPaths),
        "changed paths should be present",
      );
    }
  });

  test("git log returns commit history for conflicted file", async function () {
    this.timeout(30_000);
    const git = createGitService();
    const root = workspaceRoot();
    const repoRoot = await git.findRepoRoot(root);
    assert.ok(repoRoot, "findRepoRoot should resolve the git repo");

    const log = await git.logFile(repoRoot, "file.txt", { limit: 20 });
    assert.strictEqual(log.ok, true, "log for file.txt should succeed");
    if (log.ok) {
      assert.ok(log.commits.length > 0, "file history should contain commits");
      assert.ok(log.commits[0]!.subject, "commit should have subject");
    }
  });

  test("merge.markResolved resolves file.txt on disk and stages (TQ-1)", async function () {
    this.timeout(60_000);
    const fixture = workspaceRoot();
    const tempParent = await fs.mkdtemp(
      path.join(os.tmpdir(), "gitview-merge-int-"),
    );
    const repoRoot = path.join(tempParent, "repo");
    await fs.cp(fixture, repoRoot, { recursive: true });

    try {
      const sent: HostToWebview[] = [];
      const handler = makeHandler(repoRoot, sent, {
        ...DEFAULT_GITVIEW_SETTINGS,
        autoStageOnResolved: true,
      });

      await handler({
        type: "merge.openFile", path: "file.txt",
      });

      const docMsg = sent.find((m) => m.type === "merge.document");
      assert.strictEqual(docMsg?.type, "merge.document");
      const doc = (docMsg as { payload: MergeDocument }).payload;

      let blocks = doc.blocks.map((b) =>
        b.kind === "conflict" ? acceptOurs(b) : b,
      );
      blocks = reflowResultRanges(blocks);
      const resolved = serializeResult(
        blocks,
        doc.eol,
        doc.hasFinalNewline,
      );

      assert.strictEqual(hasLeftoverMarkers(resolved), false);
      assert.strictEqual(resolved, "line1\ntheirs change\nline3\n");

      sent.length = 0;
      await handler({
        type: "merge.markResolved",
        path: "file.txt",
        content: resolved,
      });

      const onDisk = await fs.readFile(
        path.join(repoRoot, "file.txt"),
        "utf8",
      );
      assert.strictEqual(onDisk, resolved);
      assert.ok(!/<<<<<<<|=======|>>>>>>>/.test(onDisk));

      const { execFile } = await import("child_process");
      const { promisify } = await import("util");
      const exec = promisify(execFile);
      const { stdout: unmerged } = await exec(
        "git",
        ["ls-files", "-u", "file.txt"],
        { cwd: repoRoot },
      );
      assert.strictEqual(
        unmerged.trim(),
        "",
        "file.txt should have no unmerged index stages",
      );

      const { stdout: indexed } = await exec(
        "git",
        ["ls-files", "-s", "file.txt"],
        { cwd: repoRoot },
      );
      assert.ok(/\s0\t/.test(indexed), "file.txt should be resolved in the index");
    } finally {
      await fs.rm(tempParent, { recursive: true, force: true });
    }
  });
});
