import type * as vscode from "vscode";
import type { GitViewContext } from "../application/gitViewContext";
import * as Panel from "../webview/GitViewPanel";

export type OpenGitViewOptions = {
  /**
   * When true, open the merge resolver for the resource (or active editor)
   * if it is unmerged. When false (default), show the Conflicts dialog only.
   */
  openConflictFile?: boolean;
};

export function openGitView(
  context: vscode.ExtensionContext,
  gitView: GitViewContext,
  resource?: vscode.Uri,
  options?: OpenGitViewOptions,
): Promise<void> {
  return Panel.createOrReveal(context, gitView, resource, options);
}
