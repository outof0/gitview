/**
 * VS Code integration: Explorer / Editor / SCM right-click → Git submenu.
 */
import * as assert from "assert";
import * as vscode from "vscode";
import {
  tabLabels,
  findExtension,
  uri,
  waitFor,
  hasGitViewBlamePanelFor,
  hasEditorTabFor,
} from "./explorerGitMenu.helpers";

suite("Explorer Git context menu (integration)", () => {
  suiteSetup(async function () {
    this.timeout(60_000);
    const ext = findExtension();
    assert.ok(ext, "gitview extension should be loaded");
    await ext!.activate();
  });

  test("Show History on a file opens History tab for that file", async function () {
    this.timeout(20_000);
    const fileUri = uri("file.txt");
    await vscode.commands.executeCommand("gitView.showGitHistory", fileUri);
    await waitFor(
      () => tabLabels().some((label) => label.includes("History — file.txt")),
      `expected History tab for file.txt, got: ${tabLabels().join(", ")}`,
    );
  });

  test("Show History on a folder opens History tab for that directory", async function () {
    this.timeout(20_000);
    const folderUri = uri("src");
    await vscode.commands.executeCommand("gitView.showGitHistory", folderUri);
    await waitFor(
      () => tabLabels().some((label) => label.includes("History — src/")),
      `expected History tab for src/, got: ${tabLabels().join(", ")}`,
    );
  });

  test("Show History uses the passed URI, not the active editor file", async function () {
    this.timeout(20_000);
    const decoy = uri("types.ts");
    const target = uri("file.txt");
    await vscode.window.showTextDocument(decoy, { preview: true });
    await vscode.commands.executeCommand("gitView.showGitHistory", target);
    await waitFor(
      () => tabLabels().some((label) => label.includes("History — file.txt")),
      "history should target right-clicked file.txt, not active editor",
    );
    assert.ok(
      !tabLabels().some((l) => l.includes("History — types.ts")),
      "history should not open for the unrelated active editor file",
    );
  });

  test("Annotate with Git Blame opens GitView blame for the right-clicked file", async function () {
    this.timeout(20_000);
    const relativePath = "file.txt";
    const fileUri = uri(relativePath);
    const decoy = uri("README.md");
    await vscode.window.showTextDocument(decoy, { preview: true });
    await vscode.commands.executeCommand("gitView.gitAnnotateBlame", fileUri);
    await waitFor(
      () => hasGitViewBlamePanelFor(relativePath),
      "annotate should open a GitView blame panel for the right-clicked file",
    );
    assert.ok(
      !hasEditorTabFor(fileUri),
      "annotate should not open a separate editor tab for the blamed file",
    );
  });

  test("Annotate accepts serialized submenu resource args", async function () {
    this.timeout(20_000);
    const relativePath = "file.txt";
    const fileUri = uri(relativePath);
    const decoy = uri("README.md");
    const serializedResource = {
      scheme: fileUri.scheme,
      authority: fileUri.authority,
      path: fileUri.path,
      fsPath: fileUri.fsPath,
    };
    await vscode.window.showTextDocument(decoy, { preview: true });
    await vscode.commands.executeCommand(
      "gitView.gitAnnotateBlame",
      serializedResource,
    );
    await waitFor(
      () => hasGitViewBlamePanelFor(relativePath),
      "annotate should coerce serialized submenu args into a GitView blame panel",
    );
    assert.ok(
      !hasEditorTabFor(fileUri),
      "annotate should not open a separate editor tab for the blamed file",
    );
  });
});
