import * as vscode from "vscode";

/** Minimal Git extension API surface used for repository scoping. */
export interface GitRepository {
  rootUri: vscode.Uri;
  inputBox?: { value: string };
  state?: { onDidChange: vscode.Event<void> };
}

interface GitApi {
  getRepository(uri: vscode.Uri): GitRepository | null;
  repositories?: GitRepository[];
  onDidOpenRepository?: vscode.Event<GitRepository>;
  onDidCloseRepository?: vscode.Event<GitRepository>;
}

/** Subscribe through VS Code's Git model instead of watching every workspace file. */
export async function subscribeToGitRepositoryChanges(
  listener: () => void,
  topologyListener: () => void = listener,
): Promise<vscode.Disposable> {
  const api = await getGitApi();
  if (!api) {
    return new vscode.Disposable(() => undefined);
  }
  const repositorySubscriptions = new Map<GitRepository, vscode.Disposable>();
  const attach = (repository: GitRepository) => {
    if (!repositorySubscriptions.has(repository) && repository.state) {
      repositorySubscriptions.set(
        repository,
        repository.state.onDidChange(listener),
      );
    }
  };
  const detach = (repository: GitRepository) => {
    repositorySubscriptions.get(repository)?.dispose();
    repositorySubscriptions.delete(repository);
  };
  for (const repository of api.repositories ?? []) {
    attach(repository);
  }
  const openSubscription = api.onDidOpenRepository?.((repository) => {
    attach(repository);
    topologyListener();
  });
  const closeSubscription = api.onDidCloseRepository?.((repository) => {
    detach(repository);
    topologyListener();
  });
  return new vscode.Disposable(() => {
    openSubscription?.dispose();
    closeSubscription?.dispose();
    for (const subscription of repositorySubscriptions.values()) {
      subscription.dispose();
    }
    repositorySubscriptions.clear();
  });
}

interface GitExtensionExports {
  getAPI(version: 1): GitApi;
}

export async function getGitApi(): Promise<GitApi | undefined> {
  const ext = vscode.extensions.getExtension<GitExtensionExports>("vscode.git");
  if (!ext) {
    return undefined;
  }
  try {
    if (!ext.isActive) {
      await ext.activate();
    }
    return ext.exports.getAPI(1);
  } catch {
    return undefined;
  }
}

export async function resolveGitRepository(
  uri?: vscode.Uri,
): Promise<GitRepository | undefined> {
  if (!uri) {
    return undefined;
  }
  const api = await getGitApi();
  return api?.getRepository(uri) ?? undefined;
}
