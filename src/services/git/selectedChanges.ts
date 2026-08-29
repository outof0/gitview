import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { DiffLineSelection } from "../../shared/types/diff";
import { createDiffApi } from "./diff";
import { combineHunkPatches, extractHunkPatch } from "./hunkPatch";
import { extractLinePatch } from "./linePatch";
import { createPatchApi } from "./patch";
import type { GitExecFn } from "./types";

export type SelectedChangeSelection = {
  hunkIndexes?: number[];
  lines?: DiffLineSelection[];
};

export function createSelectedChangesApi(
  execGit: GitExecFn,
  isBinaryFile: (repoRoot: string, filePath: string) => Promise<boolean>,
) {
  const diff = createDiffApi(execGit, isBinaryFile);
  const patchApi = createPatchApi(execGit);

  async function readCommitPatch(
    repoRoot: string,
    sha: string,
    relativePath: string,
  ): Promise<string> {
    try {
      const { stdout } = await execGit(repoRoot, [
        "diff",
        "--binary",
        `${sha}^`,
        sha,
        "--",
        relativePath,
      ]);
      if (stdout.trim()) {
        return stdout;
      }
    } catch {
      // first commit or rename edge cases fall back to show/log patch
    }
    const result = await diff.filePatchAtCommit(repoRoot, sha, relativePath);
    if (!result.ok) {
      throw new Error(result.message);
    }
    if (!result.patch.trim()) {
      throw new Error("No patch found for the selected file in this commit.");
    }
    return result.patch;
  }

  function buildSelectedPatch(
    fullPatch: string,
    selection: SelectedChangeSelection,
  ): string {
    if (selection.hunkIndexes && selection.hunkIndexes.length > 0) {
      const patch =
        selection.hunkIndexes.length === 1
          ? extractHunkPatch(fullPatch, selection.hunkIndexes[0]!)
          : combineHunkPatches(fullPatch, selection.hunkIndexes);
      if (!patch) {
        throw new Error("Selected hunks are no longer available.");
      }
      return patch.endsWith("\n") ? patch : `${patch}\n`;
    }
    if (selection.lines && selection.lines.length > 0) {
      const patch = extractLinePatch(fullPatch, selection.lines);
      if (!patch) {
        throw new Error("Selected lines are no longer available.");
      }
      return patch;
    }
    throw new Error("Select at least one hunk or changed line.");
  }

  async function applyCachedPatchInRepo(
    repoRoot: string,
    patchContent: string,
    reverse: boolean,
    opts?: { checkOnly?: boolean },
  ): Promise<void> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gitview-selected-"));
    const patchPath = path.join(dir, "selected.patch");
    try {
      await fs.writeFile(
        patchPath,
        patchContent.endsWith("\n") ? patchContent : `${patchContent}\n`,
        "utf8",
      );
      const args = ["apply", "--cached"];
      if (opts?.checkOnly) {
        args.push("--check");
      }
      if (reverse) {
        args.push("--reverse");
      }
      args.push(patchPath);
      await execGit(repoRoot, args);
    } finally {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }

  async function cherryPickSelected(
    repoRoot: string,
    sha: string,
    relativePath: string,
    selection: SelectedChangeSelection,
    opts?: { checkOnly?: boolean },
  ): Promise<void> {
    const fullPatch = await readCommitPatch(repoRoot, sha, relativePath);
    const patch = buildSelectedPatch(fullPatch, selection);
    await patchApi.applyPatch(repoRoot, patch, { checkOnly: opts?.checkOnly });
  }

  async function revertSelected(
    repoRoot: string,
    sha: string,
    relativePath: string,
    selection: SelectedChangeSelection,
    opts?: { checkOnly?: boolean },
  ): Promise<void> {
    const fullPatch = await readCommitPatch(repoRoot, sha, relativePath);
    const patch = buildSelectedPatch(fullPatch, selection);
    await patchApi.applyPatch(repoRoot, patch, {
      checkOnly: opts?.checkOnly,
      reverse: true,
    });
  }

  async function dropSelectedFromHead(
    repoRoot: string,
    sha: string,
    relativePath: string,
    selection: SelectedChangeSelection,
    headSha: string | null,
  ): Promise<void> {
    if (!headSha || sha.trim() !== headSha.trim()) {
      throw new Error("Drop selected changes is only supported for HEAD.");
    }

    const { stdout: message } = await execGit(repoRoot, [
      "log",
      "-1",
      "--format=%B",
    ]);
    const fullPatch = await readCommitPatch(repoRoot, sha, relativePath);
    const selectedPatch = buildSelectedPatch(fullPatch, selection);

    // Capture the branch and index so a failure after `reset --soft` can be undone.
    // `write-tree` records the index as a tree object without touching the working
    // tree, so restoring the index later does not disturb local edits either.
    const { stdout: revParse } = await execGit(repoRoot, ["rev-parse", "HEAD"]);
    const originalHead = revParse.trim();
    let originalIndexTree: string | null = null;
    try {
      const { stdout } = await execGit(repoRoot, ["write-tree"]);
      originalIndexTree = stdout.trim() || null;
    } catch {
      originalIndexTree = null;
    }

    // Dry-run both applications before mutating anything. `reset --soft` moves the
    // branch only — index and working tree are untouched — so checking now is
    // equivalent to checking after the reset. This is what makes the operation
    // transactional: a patch that cannot be applied (typically because the file
    // carries uncommitted local edits overlapping the selection) aborts here with
    // history still intact, instead of failing halfway through a rewritten commit.
    await patchApi.applyPatch(repoRoot, selectedPatch, {
      reverse: true,
      checkOnly: true,
    });
    await applyCachedPatchInRepo(repoRoot, selectedPatch, true, {
      checkOnly: true,
    });

    try {
      await execGit(repoRoot, ["reset", "--soft", "HEAD~1"]);
      await applyCachedPatchInRepo(repoRoot, selectedPatch, true);

      const trimmedMessage = message.trim();
      try {
        await execGit(repoRoot, ["commit", "-m", trimmedMessage]);
      } catch {
        // Dropping every hunk in the commit leaves the index identical to HEAD~1.
        await execGit(
          repoRoot,
          ["commit", "--allow-empty", "-m", trimmedMessage],
        );
      }

      // Reverse-apply to the working tree instead of restoring the file from HEAD.
      // `git restore --source=HEAD` overwrote the whole file and destroyed
      // uncommitted local edits; reverse-applying removes exactly the dropped
      // hunks and leaves everything else the user typed untouched.
      await patchApi.applyPatch(repoRoot, selectedPatch, { reverse: true });
    } catch (error) {
      await restoreHeadAndIndex(repoRoot, originalHead, originalIndexTree);
      throw error;
    }
  }

  /**
   * Undo a partially applied drop: point the branch back at the original commit
   * and rebuild the index from the tree captured before the mutation. Never
   * touches the working tree, so local edits survive a failed drop.
   */
  async function restoreHeadAndIndex(
    repoRoot: string,
    originalHead: string,
    originalIndexTree: string | null,
  ): Promise<void> {
    try {
      await execGit(repoRoot, ["reset", "--soft", originalHead]);
      if (originalIndexTree) {
        await execGit(repoRoot, ["read-tree", originalIndexTree]);
      }
    } catch {
      // Best effort: surface the original failure rather than the rollback's.
    }
  }

  return {
    cherryPickSelected,
    revertSelected,
    dropSelectedFromHead,
    buildSelectedPatch,
    readCommitPatch,
  };
}