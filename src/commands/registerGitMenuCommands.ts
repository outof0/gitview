import * as vscode from "vscode";
import {
  resolveMenuResourceUri,
  workspaceFolderRoot,
} from "./gitMenuContext";

export function registerGitMenuCommand(
  register: (
    id: string,
    handler: (...args: unknown[]) => unknown,
  ) => vscode.Disposable,
  id: string,
  handler: (
    resource: vscode.Uri | undefined,
    workspaceRoot: string | undefined,
    ...args: unknown[]
  ) => void | Promise<void>,
): vscode.Disposable {
  return register(id, async (...args: unknown[]) => {
    const resource = resolveMenuResourceUri(undefined, ...args);
    const workspaceRoot = workspaceFolderRoot(resource);
    try {
      await handler(resource, workspaceRoot, ...args);
    } catch (err) {
      await vscode.window.showErrorMessage(
        err instanceof Error ? err.message : String(err),
      );
    }
  });
}
