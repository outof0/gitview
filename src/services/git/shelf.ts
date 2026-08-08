import { randomUUID } from "node:crypto";
import type { ShelfEntry } from "../../shared/types/shelf";
import type { ShelfStorage } from "../../storage/shelfStorage";
import { extractHunkPatch, createHunkPatchApi } from "./hunkPatch";
import { createPatchApi } from "./patch";
import { createStagingApi } from "./staging";
import type { GitExecFn } from "./types";

export type ShelveFilesOptions = {
  repoId: string;
  paths: string[];
  name?: string;
  changelistId?: string;
};

export function createShelfApi(
  execGit: GitExecFn,
  shelfStorage: ShelfStorage,
) {
  const patchApi = createPatchApi(execGit);
  const hunkPatch = createHunkPatchApi(execGit);
  const staging = createStagingApi(execGit);

  async function listShelves(
    repoRoot: string,
    repoId: string,
  ): Promise<ShelfEntry[]> {
    return shelfStorage.list(repoRoot, repoId);
  }

  async function shelveFiles(
    repoRoot: string,
    opts: ShelveFilesOptions,
  ): Promise<ShelfEntry> {
    if (opts.paths.length === 0) {
      throw new Error("At least one path is required to shelve.");
    }

    const { stdout: untrackedOutput } = await execGit(repoRoot, [
      "ls-files",
      "--others",
      "--exclude-standard",
      "-z",
      "--",
      ...opts.paths,
    ]);
    const untrackedPaths = untrackedOutput.split("\0").filter(Boolean);

    if (untrackedPaths.length > 0) {
      await execGit(repoRoot, ["add", "-N", "--", ...untrackedPaths]);
    }

    let patchContent: string;
    try {
      patchContent = await patchApi.createFromPaths(repoRoot, opts.paths);
      if (!patchContent.trim()) {
        throw new Error("No changes found in the selected paths.");
      }
    } catch (error) {
      if (untrackedPaths.length > 0) {
        await execGit(repoRoot, ["reset", "--", ...untrackedPaths]).catch(() => {});
      }
      throw error;
    }

    const id = randomUUID();
    const record = {
      id,
      repoId: opts.repoId,
      name: opts.name?.trim() || `Shelf ${opts.paths.length} file(s)`,
      createdAt: Date.now(),
      paths: [...opts.paths],
      changelistId: opts.changelistId ?? null,
      patch: patchContent,
    };

    const stored = await shelfStorage.add(repoRoot, record);

    await staging.unstageFiles(repoRoot, opts.paths);
    await staging.rollbackTrackedFiles(repoRoot, opts.paths);
    if (untrackedPaths.length > 0) {
      await staging.removeUnversionedFiles(repoRoot, untrackedPaths);
    }

    return stored;
  }

  async function unshelve(
    repoRoot: string,
    shelfId: string,
    deleteAfter = false,
  ): Promise<ShelfEntry | null> {
    const entry = await shelfStorage.getEntry(repoRoot, shelfId);
    if (!entry) {
      return null;
    }
    const patchContent = entry.patch || (await shelfStorage.getPatch(repoRoot, shelfId));
    if (!patchContent) {
      return null;
    }
    await patchApi.applyPatch(repoRoot, patchContent);
    if (deleteAfter) {
      await shelfStorage.remove(repoRoot, shelfId);
      return null;
    }
    const { patch: _patch, ...meta } = entry;
    return meta;
  }

  async function deleteShelf(repoRoot: string, shelfId: string): Promise<boolean> {
    return shelfStorage.remove(repoRoot, shelfId);
  }

  function parsePatchPaths(patchContent: string): string[] {
    const paths = new Set<string>();
    for (const line of patchContent.split("\n")) {
      const match = line.match(/^(?:---|\+\+\+) [ab]\/(.+)$/);
      if (match?.[1]) {
        paths.add(match[1]);
      }
    }
    return [...paths];
  }

  async function importPatch(
    repoRoot: string,
    opts: { repoId: string; patch: string; name?: string },
  ): Promise<ShelfEntry> {
    const patchContent = opts.patch.trim();
    if (!patchContent) {
      throw new Error("Patch content is required.");
    }
    const paths = parsePatchPaths(patchContent);
    const id = randomUUID();
    const record = {
      id,
      repoId: opts.repoId,
      name: opts.name?.trim() || `Imported patch (${paths.length || "?"} file(s))`,
      createdAt: Date.now(),
      paths: paths.length > 0 ? paths : ["."],
      changelistId: null,
      patch: patchContent,
    };
    return shelfStorage.add(repoRoot, record);
  }

  async function shelveHunk(
    repoRoot: string,
    opts: {
      repoId: string;
      path: string;
      hunkIndex: number;
      staged?: boolean;
      name?: string;
      changelistId?: string;
    },
  ): Promise<ShelfEntry> {
    const staged = Boolean(opts.staged);
    const diff = await hunkPatch.readWorkingTreeDiff(repoRoot, opts.path, staged);
    const hunk = extractHunkPatch(diff, opts.hunkIndex);
    if (!hunk) {
      throw new Error("Hunk is no longer available. Refresh the diff and try again.");
    }

    const id = randomUUID();
    const record = {
      id,
      repoId: opts.repoId,
      name: opts.name?.trim() || `Shelf hunk in ${opts.path}`,
      createdAt: Date.now(),
      paths: [opts.path],
      changelistId: opts.changelistId ?? null,
      patch: hunk,
    };

    const stored = await shelfStorage.add(repoRoot, record);

    if (staged) {
      await hunkPatch.unstageHunk(repoRoot, opts.path, opts.hunkIndex);
    }
    try {
      await patchApi.applyPatch(repoRoot, hunk, { reverse: true });
    } catch {
      // staged-only hunks may already be removed from the working tree
    }

    return stored;
  }

  return { listShelves, shelveFiles, unshelve, deleteShelf, importPatch, shelveHunk };
}
