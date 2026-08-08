import * as vscode from "vscode";
import { coerceContextMenuResourceUri } from "./contextMenuResource";

/** Workspace folder that owns the Explorer / editor resource. */
export function workspaceFolderRoot(resource?: vscode.Uri): string | undefined {
  if (resource?.scheme === "file") {
    return vscode.workspace.getWorkspaceFolder(resource)?.uri.fsPath;
  }
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

/** Best-effort resource URI from VS Code submenu invocation args. */
export function resolveMenuResourceUri(
  resource: vscode.Uri | undefined,
  ...commandArgs: unknown[]
): vscode.Uri | undefined {
  return (
    coerceContextMenuResourceUri(resource, ...commandArgs) ?? resource
  );
}

export function warnNoGitRepository(action: string): void {
  void vscode.window.showWarningMessage(
    `${action} could not find a Git repository for the selected path. Open the repository root (or a file inside it) as a workspace folder.`,
  );
}