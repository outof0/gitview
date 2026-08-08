import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { ShelfEntry } from "../shared/types/shelf";

export type StoredShelfRecord = ShelfEntry & {
  patch: string;
};

type ShelfIndexRecord = ShelfEntry & {
  /** Legacy indexes embedded patches. New indexes keep patch data in .patch files. */
  patch?: string;
};

type ShelfIndex = {
  version: 1;
  shelves: ShelfIndexRecord[];
};

export type ShelfStorageOptions = {
  /** Test/host hook. The returned directory owns index.json and patch files. */
  resolveStorageDir?: (repoRoot: string) => Promise<string>;
};

export interface ShelfStorage {
  list(repoRoot: string, repoId: string): Promise<ShelfEntry[]>;
  getEntry(repoRoot: string, shelfId: string): Promise<StoredShelfRecord | null>;
  getPatch(repoRoot: string, shelfId: string): Promise<string | null>;
  add(repoRoot: string, record: StoredShelfRecord): Promise<ShelfEntry>;
  remove(repoRoot: string, shelfId: string): Promise<boolean>;
}

export class ShelfStorageCorruptionError extends Error {
  constructor(indexFile: string, cause?: unknown) {
    super(`Shelf index is corrupt or unreadable: ${indexFile}`);
    this.name = "ShelfStorageCorruptionError";
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

/**
 * Resolve the shared Git metadata directory without assuming that `.git` is a
 * directory. Linked worktrees use a `.git` file and a `commondir` indirection.
 */
export async function resolveGitCommonDir(repoRoot: string): Promise<string> {
  const dotGit = path.join(repoRoot, ".git");
  const stat = await fs.stat(dotGit);
  if (stat.isDirectory()) {
    return dotGit;
  }
  if (!stat.isFile()) {
    throw new Error(`Unsupported Git metadata path: ${dotGit}`);
  }

  const pointer = await fs.readFile(dotGit, "utf8");
  const match = pointer.match(/^gitdir:\s*(.+?)\s*$/m);
  if (!match?.[1]) {
    throw new Error(`Invalid linked-worktree .git file: ${dotGit}`);
  }

  const worktreeGitDir = path.resolve(repoRoot, match[1]);
  try {
    const commonPointer = (await fs.readFile(path.join(worktreeGitDir, "commondir"), "utf8")).trim();
    if (commonPointer) {
      return path.resolve(worktreeGitDir, commonPointer);
    }
  } catch (error) {
    if (!isNodeError(error) || error.code !== "ENOENT") {
      throw error;
    }
  }
  return worktreeGitDir;
}

async function defaultStorageDir(repoRoot: string): Promise<string> {
  return path.join(await resolveGitCommonDir(repoRoot), "gitview-shelves");
}

async function syncDirectory(dir: string): Promise<void> {
  try {
    const handle = await fs.open(dir, "r");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  } catch {
    // Directory fsync is not supported on every platform/filesystem. The file
    // itself is still flushed before rename.
  }
}

async function writeFileAtomic(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tempPath = path.join(
    dir,
    `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  let handle: fs.FileHandle | undefined;
  try {
    handle = await fs.open(tempPath, "wx", 0o600);
    await handle.writeFile(content, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await fs.rename(tempPath, filePath);
    await syncDirectory(dir);
  } finally {
    await handle?.close().catch(() => {});
    await fs.rm(tempPath, { force: true }).catch(() => {});
  }
}

function validateIndex(value: unknown, indexFile: string): ShelfIndex {
  if (typeof value !== "object" || value === null) {
    throw new ShelfStorageCorruptionError(indexFile);
  }
  const shelves = (value as { shelves?: unknown }).shelves;
  if (!Array.isArray(shelves)) {
    throw new ShelfStorageCorruptionError(indexFile);
  }
  for (const shelf of shelves) {
    if (
      typeof shelf !== "object" ||
      shelf === null ||
      typeof (shelf as ShelfIndexRecord).id !== "string" ||
      typeof (shelf as ShelfIndexRecord).repoId !== "string" ||
      typeof (shelf as ShelfIndexRecord).name !== "string" ||
      typeof (shelf as ShelfIndexRecord).createdAt !== "number" ||
      !Array.isArray((shelf as ShelfIndexRecord).paths)
    ) {
      throw new ShelfStorageCorruptionError(indexFile);
    }
  }
  return { version: 1, shelves: shelves as ShelfIndexRecord[] };
}

export function createShelfStorage(
  options: ShelfStorageOptions = {},
): ShelfStorage {
  const resolveStorageDir = options.resolveStorageDir ?? defaultStorageDir;
  // Shelf operations are rare. A single queue avoids read-modify-write races
  // between multiple panels while keeping the persistence implementation small.
  let writeQueue: Promise<void> = Promise.resolve();

  async function serializeWrite<T>(operation: () => Promise<T>): Promise<T> {
    const previous = writeQueue;
    let release!: () => void;
    writeQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  async function pathsFor(repoRoot: string) {
    const dir = await resolveStorageDir(repoRoot);
    return {
      dir,
      index: path.join(dir, "index.json"),
      patch: (id: string) => path.join(dir, `${id}.patch`),
    };
  }

  async function readIndex(repoRoot: string): Promise<ShelfIndex> {
    const paths = await pathsFor(repoRoot);
    try {
      const raw = await fs.readFile(paths.index, "utf8");
      return validateIndex(JSON.parse(raw) as unknown, paths.index);
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return { version: 1, shelves: [] };
      }
      if (error instanceof ShelfStorageCorruptionError) {
        throw error;
      }
      throw new ShelfStorageCorruptionError(paths.index, error);
    }
  }

  async function writeIndex(repoRoot: string, index: ShelfIndex): Promise<void> {
    const paths = await pathsFor(repoRoot);
    await writeFileAtomic(paths.index, JSON.stringify(index, null, 2));
  }

  async function list(repoRoot: string, repoId: string): Promise<ShelfEntry[]> {
    const index = await readIndex(repoRoot);
    return index.shelves
      .filter((entry) => entry.repoId === repoId)
      .map(({ patch: _patch, ...meta }) => meta)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async function getEntry(
    repoRoot: string,
    shelfId: string,
  ): Promise<StoredShelfRecord | null> {
    const index = await readIndex(repoRoot);
    const entry = index.shelves.find((shelf) => shelf.id === shelfId);
    if (!entry) {
      return null;
    }
    const patchContent = await getPatch(repoRoot, shelfId);
    return patchContent ? { ...entry, patch: patchContent } : null;
  }

  async function getPatch(
    repoRoot: string,
    shelfId: string,
  ): Promise<string | null> {
    const paths = await pathsFor(repoRoot);
    try {
      return await fs.readFile(paths.patch(shelfId), "utf8");
    } catch (error) {
      if (!isNodeError(error) || error.code !== "ENOENT") {
        throw error;
      }
      const index = await readIndex(repoRoot);
      return index.shelves.find((shelf) => shelf.id === shelfId)?.patch ?? null;
    }
  }

  async function add(
    repoRoot: string,
    record: StoredShelfRecord,
  ): Promise<ShelfEntry> {
    return serializeWrite(async () => {
      const paths = await pathsFor(repoRoot);
      const index = await readIndex(repoRoot);
      const { patch: patchContent, ...meta } = record;

      // The patch is durable before it is referenced by the index. Callers can
      // therefore safely remove local work only after this method resolves.
      await writeFileAtomic(paths.patch(record.id), patchContent);
      try {
        index.shelves.push(meta);
        await writeIndex(repoRoot, index);
      } catch (error) {
        await fs.rm(paths.patch(record.id), { force: true }).catch(() => {});
        throw error;
      }
      return meta;
    });
  }

  async function remove(repoRoot: string, shelfId: string): Promise<boolean> {
    return serializeWrite(async () => {
      const paths = await pathsFor(repoRoot);
      const index = await readIndex(repoRoot);
      const next = index.shelves.filter((entry) => entry.id !== shelfId);
      if (next.length === index.shelves.length) {
        return false;
      }
      await writeIndex(repoRoot, { version: 1, shelves: next });
      await fs.rm(paths.patch(shelfId), { force: true }).catch(() => {});
      return true;
    });
  }

  return { list, getEntry, getPatch, add, remove };
}
