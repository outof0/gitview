import { randomUUID } from "node:crypto";
import type { ShelfEntry } from "../../shared/types/shelf";
import type { ShelfStorage } from "../../storage/shelfStorage";
import { extractHunkPatch, splitPatchHunks, createHunkPatchApi } from "./hunkPatch";
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

  /**
   * Best-effort compensation for a failed shelve: put the shelved content back
   * in the working tree AND the index, separately. The shelve captures one
   * combined `diff HEAD` patch, but unstaging before cleanup destroys the
   * index placement — restoring only the working tree silently converts
   * staged changes into unstaged ones. Returns whether everything was
   * restored — a failed rollback must not mask the original error, but the
   * caller has to know the tree may still be cleaned and the recovery file
   * is then the only copy of the work.
   */
  async function restoreShelvedState(
    repoRoot: string,
    patchContent: string,
    stagedPatch: string,
    untrackedPaths: string[],
  ): Promise<boolean> {
    try {
      await patchApi.applyPatch(repoRoot, patchContent);
    } catch {
      return false;
    }
    if (stagedPatch.trim()) {
      try {
        await patchApi.applyPatch(repoRoot, stagedPatch, { cached: true });
      } catch {
        return false;
      }
    }
    if (untrackedPaths.length > 0) {
      try {
        await execGit(repoRoot, ["add", "-N", "--", ...untrackedPaths]);
      } catch {
        return false;
      }
    }
    return true;
  }

  /**
   * A shelve failed after cleanup started. Re-apply the patch; if even that
   * fails, keep the recovery file and surface both the original error and
   * where the durable copy lives.
   */
  async function finalizeFailedShelve(
    repoRoot: string,
    id: string,
    patchContent: string,
    stagedPatch: string,
    untrackedPaths: string[],
    recoveryPath: string,
    error: unknown,
  ): Promise<Error> {
    const original = error instanceof Error ? error : new Error(String(error));
    const restored = await restoreShelvedState(
      repoRoot,
      patchContent,
      stagedPatch,
      untrackedPaths,
    );
    if (!restored) {
      return new Error(
        `Shelving failed (${original.message}), and restoring the working tree failed too. A recovery copy of the patch is at ${recoveryPath}.`,
      );
    }
    await shelfStorage.removeRecoveryPatch(repoRoot, id);
    return original;
  }

  async function listShelves(
    repoRoot: string,
    repoId: string,
  ): Promise<ShelfEntry[]> {
    return shelfStorage.list(repoRoot, repoId);
  }

  // Undo the `git add -N` intent-to-add entries created for untracked files.
  // Every failure before cleanup must restore the index, otherwise the command
  // reports "nothing was shelved" while having changed `??` entries into
  // intent-to-add ones. A failed restore is never swallowed: the caller gets a
  // compound error carrying both the original failure and the index state
  // that still needs recovery, with the deterministic fix (`git reset`).
  async function rollbackIntentToAdd(
    repoRoot: string,
    untrackedPaths: string[],
    error: unknown,
  ): Promise<never> {
    if (untrackedPaths.length === 0) {
      throw error;
    }
    try {
      await execGit(repoRoot, ["reset", "--", ...untrackedPaths]);
    } catch (resetError) {
      const original = error instanceof Error ? error.message : String(error);
      const reason =
        resetError instanceof Error ? resetError.message : String(resetError);
      throw new Error(
        `${original} (Additionally, restoring the index failed: ${reason}. ` +
          `Untracked files may still be marked intent-to-add; run "git reset" to restore them.)`,
      );
    }
    throw error;
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
    const untrackedPathSet = new Set(untrackedPaths);
    const trackedPaths = opts.paths.filter((filePath) => !untrackedPathSet.has(filePath));

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
      throw await rollbackIntentToAdd(repoRoot, untrackedPaths, error);
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

    // The working tree is rolled back BEFORE the entry is persisted. Writing the
    // record first left a half-state behind: a shelf entry existed while the tree
    // was only partially cleaned, and neither side could be trusted.
    //
    // Persisting afterwards inverts the risk (the tree is clean but the record is
    // missing), so every failure path below re-applies the captured patch. The
    // recovery copy guards the remaining hole: if the compensation itself fails,
    // the tree is clean, no shelf entry exists, and this file is the only copy
    // of the work.
    let recoveryPath: string;
    try {
      recoveryPath = await shelfStorage.saveRecoveryPatch(
        repoRoot,
        id,
        patchContent,
      );
    } catch {
      // Without a durable copy, shelving must not clean the working tree at all.
      throw await rollbackIntentToAdd(
        repoRoot,
        untrackedPaths,
        new Error(
          "Could not persist a recovery copy of the patch, so nothing was shelved.",
        ),
      );
    }

    let stagedPatch = "";
    try {
      // Capture the index BEFORE cleanup destroys its placement. The combined
      // `diff HEAD` patch restores worktree content only; without this the
      // compensation below would resurrect staged changes as unstaged ones.
      const { stdout } = await execGit(repoRoot, [
        "diff",
        "--cached",
        "--binary",
        "--",
        ...opts.paths,
      ]);
      stagedPatch = stdout;
    } catch (error) {
      await shelfStorage.removeRecoveryPatch(repoRoot, id);
      throw await rollbackIntentToAdd(repoRoot, untrackedPaths, error);
    }

    try {
      await staging.unstageFiles(repoRoot, opts.paths);
    } catch (error) {
      await shelfStorage.removeRecoveryPatch(repoRoot, id);
      throw await rollbackIntentToAdd(repoRoot, untrackedPaths, error);
    }
    try {
      if (trackedPaths.length > 0) {
        await staging.rollbackTrackedFiles(repoRoot, trackedPaths);
      }
      if (untrackedPaths.length > 0) {
        await staging.removeUnversionedFiles(repoRoot, untrackedPaths);
      }
    } catch (error) {
      throw await finalizeFailedShelve(
        repoRoot,
        id,
        patchContent,
        stagedPatch,
        untrackedPaths,
        recoveryPath,
        error,
      );
    }

    try {
      const entry = await shelfStorage.add(repoRoot, record);
      await shelfStorage.removeRecoveryPatch(repoRoot, id);
      return entry;
    } catch (error) {
      throw await finalizeFailedShelve(
        repoRoot,
        id,
        patchContent,
        stagedPatch,
        untrackedPaths,
        recoveryPath,
        error,
      );
    }
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

    // Persisted before the source hunk is touched, so a storage failure never
    // mutates the tree. Every removal failure below compensates by deleting
    // the just-persisted entry: a failed shelve must never report success
    // with the hunk still in the source, nor keep a shelf for content that
    // was never removed.
    const stored = await shelfStorage.add(repoRoot, record);

    const discardPersistedEntry = async (): Promise<void> => {
      await shelfStorage.remove(repoRoot, stored.id);
    };
    // Single-hunk single-file patches apply atomically, so after a failed
    // reverse-apply the worktree either still holds the exact hunk or holds
    // none of it. Re-reading the worktree tells a benign staged-only removal
    // (nothing left to remove) apart from a real failure.
    const isHunkGoneFromWorktree = async (): Promise<boolean> => {
      try {
        const fresh = await hunkPatch.readWorkingTreeDiff(repoRoot, opts.path, false);
        return !splitPatchHunks(fresh).includes(hunk);
      } catch {
        return false;
      }
    };

    let unstaged = false;
    const failShelveHunk = async (error: unknown, restage: boolean): Promise<never> => {
      const original = error instanceof Error ? error.message : String(error);
      if (restage) {
        // The index was already changed by a successful unstage: put the hunk
        // back so a failed command leaves staged state untouched.
        try {
          await patchApi.applyPatch(repoRoot, hunk, { cached: true });
        } catch (restageError) {
          // Staging could not be restored either: keep a durable copy of the
          // hunk and report everything, so no work is silently lost.
          const restageMessage =
            restageError instanceof Error ? restageError.message : String(restageError);
          let recovery: string | null = null;
          try {
            recovery = await shelfStorage.saveRecoveryPatch(repoRoot, id, hunk);
          } catch {
            recovery = null;
          }
          try {
            await discardPersistedEntry();
          } catch {
            // Covered by the compound error below.
          }
          throw new Error(
            `${original} (Additionally, restoring the staged hunk failed: ${restageMessage}.` +
              (recovery
                ? ` A recovery copy of the hunk is at ${recovery}.`
                : ` No recovery copy could be saved.`) +
              ` The shelf entry was discarded.)`,
          );
        }
      }
      try {
        await discardPersistedEntry();
      } catch (removeError) {
        const reason =
          removeError instanceof Error ? removeError.message : String(removeError);
        throw new Error(
          `${original} (Additionally, discarding the shelf entry failed: ${reason}. ` +
            `Delete the "${record.name}" shelf manually.)`,
        );
      }
      if (restage) {
        throw new Error(
          `${original} (The staged hunk was restored to the index; the shelf entry was discarded.)`,
        );
      }
      throw error;
    };

    try {
      if (staged) {
        await hunkPatch.unstageHunk(repoRoot, opts.path, opts.hunkIndex);
        unstaged = true;
      }
    } catch (error) {
      await failShelveHunk(error, false);
    }
    try {
      await patchApi.applyPatch(repoRoot, hunk, { reverse: true });
    } catch (reverseError) {
      if (await isHunkGoneFromWorktree()) {
        return stored;
      }
      await failShelveHunk(reverseError, unstaged);
    }

    return stored;
  }

  return { listShelves, shelveFiles, unshelve, deleteShelf, importPatch, shelveHunk };
}
