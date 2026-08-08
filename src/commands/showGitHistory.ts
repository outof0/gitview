import * as path from "path";
import * as vscode from "vscode";
import type { GitMenuPresentation } from "./gitMenuPresentation";

export async function showGitHistory(
  resource?: vscode.Uri,
  presentation?: GitMenuPresentation,
): Promise<void> {
  const uri = resource ?? vscode.window.activeTextEditor?.document.uri;

  if (!uri || uri.scheme !== "file") {
    void vscode.window.showWarningMessage(
      "Show Git History requires a file or folder in the workspace.",
    );
    return;
  }

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
  if (!workspaceFolder) {
    void vscode.window.showWarningMessage(
      "Show Git History is only available for workspace files and folders.",
    );
    return;
  }

  let isFolder = false;
  try {
    const stat = await vscode.workspace.fs.stat(uri);
    isFolder = (stat.type & vscode.FileType.Directory) !== 0;
  } catch {
    void vscode.window.showWarningMessage(
      "Could not read the selected resource.",
    );
    return;
  }

  const relativePath = path
    .relative(workspaceFolder.uri.fsPath, uri.fsPath)
    .replace(/\\/g, "/");

  const historyPath =
    !relativePath || relativePath === "." ? "." : relativePath;

  if (!presentation) {
    throw new Error("Git history presentation is not configured.");
  }
  await presentation.openHistory({
    relativePath: historyPath,
    isFolder,
    workspaceRoot: workspaceFolder.uri.fsPath,
  });
}
