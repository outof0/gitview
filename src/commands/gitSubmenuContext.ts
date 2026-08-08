import * as vscode from "vscode";
import { createStashApi } from "../services/git/stash";
import { createShelfApi } from "../services/git/shelf";
import type { ShelfStorage } from "../storage/shelfStorage";
import type { GitExecFn } from "../services/git/types";
import type { RefreshPayload } from "../services/watchers/refreshCoordinator";
import {
  buildGitSubmenuEnablementContext,
  buildGitSubmenuNativeContext,
  GIT_SUBMENU_CONTEXT_KEYS,
} from "../types/gitSubmenuEnablement";

export type GitSubmenuContextServiceDeps = {
  execGit: GitExecFn;
  shelfStorage: ShelfStorage;
  subscribeRefresh: (listener: (payload: RefreshPayload) => void) => () => void;
};

async function hasGitRemote(
  execGit: GitExecFn,
  repoRoot: string,
): Promise<boolean> {
  try {
    const { stdout } = await execGit(repoRoot, ["remote"]);
    return stdout
      .split("\n")
      .map((line) => line.trim())
      .some((line) => line.length > 0);
  } catch {
    return false;
  }
}

export function createGitSubmenuContextService(
  deps: GitSubmenuContextServiceDeps,
): { dispose: () => void } {
  const stashApi = createStashApi(deps.execGit);
  const shelfApi = createShelfApi(deps.execGit, deps.shelfStorage);
  let disposed = false;

  async function applyContext(payload: RefreshPayload): Promise<void> {
    if (disposed) {
      return;
    }

    const activeRepo =
      payload.repoSnapshot.repositories.find(
        (repo) => repo.id === payload.repoSnapshot.activeRepoId,
      ) ?? payload.repoSnapshot.repositories[0];

    if (!activeRepo) {
      for (const key of Object.values(GIT_SUBMENU_CONTEXT_KEYS)) {
        await vscode.commands.executeCommand("setContext", key, false);
      }
      return;
    }

    const status = payload.statusByRepoId.get(activeRepo.id);
    const [stashes, shelves, hasRemote, porcelain] = await Promise.all([
      stashApi.listStashes(activeRepo.rootPath).catch(() => []),
      shelfApi.listShelves(activeRepo.rootPath, activeRepo.id).catch(() => []),
      hasGitRemote(deps.execGit, activeRepo.rootPath),
      deps.execGit(activeRepo.rootPath, ["status", "--porcelain"]).catch(() => ({
        stdout: "",
        stderr: "",
      })),
    ]);

    const porcelainDirty = porcelain.stdout.trim().length > 0;
    const repository = porcelainDirty
      ? { ...activeRepo, dirty: true }
      : activeRepo;

    const enablement = buildGitSubmenuEnablementContext({
      repository,
      files: status?.files,
      stashCount: stashes.length,
      shelfCount: shelves.length,
      hasRemote,
      mergeChangesCount: activeRepo.conflictCount,
    });

    const flags = buildGitSubmenuNativeContext(enablement);
    await Promise.all(
      Object.entries(GIT_SUBMENU_CONTEXT_KEYS).map(([flag, key]) =>
        vscode.commands.executeCommand(
          "setContext",
          key,
          flags[flag as keyof typeof flags],
        ),
      ),
    );
  }

  const unsubscribe = deps.subscribeRefresh((payload) => {
    void applyContext(payload);
  });

  return {
    dispose: () => {
      disposed = true;
      unsubscribe();
    },
  };
}
