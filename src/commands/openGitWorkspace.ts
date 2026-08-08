import * as vscode from "vscode";
import type { GitViewContext } from "../application/gitViewContext";
import { openGitWorkspacePanel } from "../webview/gitWorkspacePanel";

export async function openGitWorkspace(
  context: vscode.ExtensionContext,
  gitView: GitViewContext,
): Promise<void> {
  if (!vscode.workspace.isTrusted) {
    const answer = await vscode.window.showWarningMessage(
      "GitView requires a trusted workspace to run Git commands.",
      "Manage Workspace Trust",
    );
    if (answer === "Manage Workspace Trust") {
      await vscode.commands.executeCommand("workbench.trust.manage");
    }
    return;
  }

  await openGitWorkspacePanel(context, gitView);
}
