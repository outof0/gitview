import * as vscode from "vscode";
import type { GitViewContext } from "../application/gitViewContext";

function workspaceFolders(): Array<{ uriPath: string; name: string }> {
  return (vscode.workspace.workspaceFolders ?? []).map((f) => ({
    uriPath: f.uri.fsPath,
    name: f.name,
  }));
}

export async function resolveLegacyWorkspaceRoot(
  gitView: GitViewContext,
  repoId?: string,
): Promise<string | undefined> {
  const folders = workspaceFolders();
  const repos = await gitView.repositoryService.discoverRepositories({
    workspaceFolders: folders,
    explicitRepoId: repoId,
    trusted: vscode.workspace.isTrusted,
  });
  const repo = gitView.repositoryService.resolveRepositoryForResource(
    repos,
    undefined,
    repoId,
  );
  if (repo) {
    return repo.workspaceFolderPath ?? repo.rootPath;
  }
  if (repoId) {
    return undefined;
  }
  return folders[0]?.uriPath;
}
