import * as vscode from "vscode";

const STORAGE_KEY = "gitView.branchFavorites";

type FavoriteStore = Record<string, string[]>;

export interface BranchFavoriteStorage {
  load(repoId: string): Set<string>;
  save(repoId: string, favorites: Set<string>): Promise<void>;
  toggle(repoId: string, branchName: string): Promise<boolean>;
}

function readStore(raw: unknown): FavoriteStore {
  if (typeof raw !== "object" || raw === null) {
    return {};
  }
  const store: FavoriteStore = {};
  for (const [repoId, names] of Object.entries(raw)) {
    if (!Array.isArray(names)) {
      continue;
    }
    const valid = names.filter((name): name is string => typeof name === "string");
    if (valid.length > 0) {
      store[repoId] = valid;
    }
  }
  return store;
}

export function createBranchFavoriteStorage(
  context: vscode.ExtensionContext,
): BranchFavoriteStorage {
  function load(repoId: string): Set<string> {
    const store = readStore(context.workspaceState.get(STORAGE_KEY));
    return new Set(store[repoId] ?? []);
  }

  async function save(repoId: string, favorites: Set<string>): Promise<void> {
    const store = readStore(context.workspaceState.get(STORAGE_KEY));
    store[repoId] = [...favorites].sort();
    await context.workspaceState.update(STORAGE_KEY, store);
  }

  async function toggle(repoId: string, branchName: string): Promise<boolean> {
    const favorites = load(repoId);
    if (favorites.has(branchName)) {
      favorites.delete(branchName);
      await save(repoId, favorites);
      return false;
    }
    favorites.add(branchName);
    await save(repoId, favorites);
    return true;
  }

  return { load, save, toggle };
}
