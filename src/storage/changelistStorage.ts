import * as vscode from "vscode";
import type { ChangeList } from "../shared/types/status";

const STORAGE_KEY = "gitView.changelists";

type ChangelistStore = Record<string, ChangeList[]>;

export interface ChangelistStorage {
  load(repoId: string): ChangeList[];
  save(repoId: string, lists: ChangeList[]): Promise<void>;
  ensureDefault(repoId: string, trackedPaths: string[]): Promise<ChangeList[]>;
  createList(repoId: string, name: string): Promise<ChangeList[]>;
  setActive(repoId: string, listId: string): Promise<ChangeList[]>;
  moveFiles(repoId: string, listId: string, paths: string[]): Promise<ChangeList[]>;
  mergeWithStatus(repoId: string, visiblePaths: string[]): Promise<ChangeList[]>;
}

function isChangeList(value: unknown): value is ChangeList {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const v = value as ChangeList;
  return (
    typeof v.id === "string" &&
    typeof v.repoId === "string" &&
    typeof v.name === "string" &&
    typeof v.active === "boolean" &&
    Array.isArray(v.filePaths)
  );
}

function readStore(raw: unknown): ChangelistStore {
  if (typeof raw !== "object" || raw === null) {
    return {};
  }
  const store: ChangelistStore = {};
  for (const [repoId, lists] of Object.entries(raw)) {
    if (!Array.isArray(lists)) {
      continue;
    }
    const valid = lists.filter(isChangeList);
    if (valid.length > 0) {
      store[repoId] = valid;
    }
  }
  return store;
}

export function createChangelistStorage(
  context: vscode.ExtensionContext,
): ChangelistStorage {
  function load(repoId: string): ChangeList[] {
    const store = readStore(context.workspaceState.get(STORAGE_KEY));
    return store[repoId] ?? [];
  }

  async function save(repoId: string, lists: ChangeList[]): Promise<void> {
    const store = readStore(context.workspaceState.get(STORAGE_KEY));
    store[repoId] = lists;
    await context.workspaceState.update(STORAGE_KEY, store);
  }

  function defaultList(repoId: string, filePaths: string[]): ChangeList {
    const now = Date.now();
    return {
      id: `${repoId}:changes`,
      repoId,
      name: "Changes",
      active: true,
      filePaths,
      createdAt: now,
      updatedAt: now,
    };
  }

  async function ensureDefault(
    repoId: string,
    trackedPaths: string[],
  ): Promise<ChangeList[]> {
    const existing = load(repoId);
    if (existing.length > 0) {
      return existing;
    }
    const lists = [defaultList(repoId, trackedPaths)];
    await save(repoId, lists);
    return lists;
  }

  async function createList(
    repoId: string,
    name: string,
  ): Promise<ChangeList[]> {
    const lists = load(repoId);
    const now = Date.now();
    const created: ChangeList = {
      id: `${repoId}:${now}`,
      repoId,
      name,
      active: false,
      filePaths: [],
      createdAt: now,
      updatedAt: now,
    };
    const next = [...lists, created];
    await save(repoId, next);
    return next;
  }

  async function setActive(repoId: string, listId: string): Promise<ChangeList[]> {
    const next = load(repoId).map((list) => ({
      ...list,
      active: list.id === listId,
      updatedAt: list.id === listId ? Date.now() : list.updatedAt,
    }));
    await save(repoId, next);
    return next;
  }

  async function moveFiles(
    repoId: string,
    listId: string,
    paths: string[],
  ): Promise<ChangeList[]> {
    const pathSet = new Set(paths);
    const next = load(repoId).map((list) => {
      if (list.id === listId) {
        return {
          ...list,
          filePaths: [...new Set([...list.filePaths, ...paths])],
          updatedAt: Date.now(),
        };
      }
      return {
        ...list,
        filePaths: list.filePaths.filter((p) => !pathSet.has(p)),
        updatedAt: Date.now(),
      };
    });
    await save(repoId, next);
    return next;
  }

  async function mergeWithStatus(
    repoId: string,
    visiblePaths: string[],
  ): Promise<ChangeList[]> {
    const visible = new Set(visiblePaths);
    let lists = await ensureDefault(
      repoId,
      visiblePaths.filter((p) => visible.has(p)),
    );

    lists = lists.map((list) => ({
      ...list,
      filePaths: list.filePaths.filter((p) => visible.has(p)),
    }));

    const assigned = new Set(lists.flatMap((list) => list.filePaths));
    const active =
      lists.find((list) => list.active) ?? lists[0];
    if (active) {
      const unassigned = visiblePaths.filter((p) => !assigned.has(p));
      if (unassigned.length > 0) {
        lists = lists.map((list) =>
          list.id === active.id
            ? {
                ...list,
                filePaths: [...new Set([...list.filePaths, ...unassigned])],
                updatedAt: Date.now(),
              }
            : list,
        );
      }
    }

    await save(repoId, lists);
    return lists;
  }

  return {
    load,
    save,
    ensureDefault,
    createList,
    setActive,
    moveFiles,
    mergeWithStatus,
  };
}
