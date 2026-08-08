import * as vscode from "vscode";

/** Reads `gitView.confirmDestructiveActions` (default true). */
export function readConfirmDestructiveActions(): boolean {
  return vscode.workspace
    .getConfiguration("gitView")
    .get<boolean>("confirmDestructiveActions", true);
}
