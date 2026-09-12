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
    opts?: { checkOnly?: boolean; env?: NodeJS.ProcessEnv },
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
      await execGit(repoRoot, args, { env: opts?.env });
    } finally {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {}); // review-scope:allow silent-catch — temp-dir cleanup
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

    // Re-read HEAD and prove it is still the commit the caller selected. The
    // caller resolved `headSha` before this call, and another terminal or Git
    // client can move HEAD in between — a rebase, a commit, a checkout. Without
    // this check the guard above still passes against the stale SHA and
    // an unchecked ref move rewrites whatever HEAD became, using a message and
    // a patch that belong to something else. Fail before reading either.
    const { stdout: revParse } = await execGit(repoRoot, ["rev-parse", "HEAD"]);
    const originalHead = revParse.trim();
    if (originalHead !== sha.trim()) {
      throw new Error(
        `HEAD moved to ${originalHead.slice(0, 7)} while the drop was being prepared; ` +
          `expected ${sha.trim().slice(0, 7)}. Re-select the commit and retry.`,
      );
    }

    const { stdout: message } = await execGit(repoRoot, [
      "log",
      "-1",
      "--format=%B",
    ]);
    const fullPatch = await readCommitPatch(repoRoot, sha, relativePath);
    const selectedPatch = buildSelectedPatch(fullPatch, selection);

    // Capture the index so a failure after moving the branch can be undone.
    // HEAD was captured above; `write-tree` records the index as a tree object
    // without touching the working tree, so restoring the index later does not
    // disturb local edits either. The snapshot is mandatory: without it the
    // user's staged state could neither be kept out of the rewritten commit nor
    // restored afterwards.
    const { stdout: indexTree } = await execGit(repoRoot, ["write-tree"]);
    const originalIndexTree = indexTree.trim();

    // Dry-run before mutating anything. The ref update below moves the branch
    // only — index and working tree are untouched — so checking now covers the
    // working-tree apply and the staged-state restore. A patch that cannot be
    // applied (typically because the file carries uncommitted local edits
    // overlapping the selection) aborts here with history still intact, instead
    // of failing halfway through a rewritten commit.
    await patchApi.applyPatch(repoRoot, selectedPatch, {
      reverse: true,
      checkOnly: true,
    });
    await applyCachedPatchInRepo(repoRoot, selectedPatch, true, {
      checkOnly: true,
    });

    const { stdout: committedTree } = await execGit(repoRoot, [
      "rev-parse",
      `${originalHead}^{tree}`,
    ]);
    const { stdout: ancestry } = await execGit(repoRoot, [
      "rev-list",
      "--parents",
      "-n",
      "1",
      originalHead,
    ]);
    const parents = ancestry.trim().split(/\s+/).slice(1);
    const { stdout: authorIdentity } = await execGit(repoRoot, [
      "show",
      "-s",
      "--format=%an%x00%ae%x00%aI",
      originalHead,
    ]);
    const [authorName, authorEmail, authorDate] = authorIdentity
      .trimEnd()
      .split("\0");
    if (!authorName || !authorEmail || !authorDate) {
      throw new Error("Could not preserve the original commit author.");
    }
    const temporaryIndexDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "gitview-selected-index-"),
    );
    const temporaryIndex = path.join(temporaryIndexDir, "index");
    const temporaryIndexEnv = {
      ...process.env,
      GIT_INDEX_FILE: temporaryIndex,
    };
    let rewrittenHead: string | null = null;
    let refUpdated = false;
    try {
      await execGit(repoRoot, ["read-tree", committedTree.trim()], {
        env: temporaryIndexEnv,
      });
      await applyCachedPatchInRepo(repoRoot, selectedPatch, true, {
        env: temporaryIndexEnv,
      });
      const { stdout: rewrittenTree } = await execGit(
        repoRoot,
        ["write-tree"],
        { env: temporaryIndexEnv },
      );
      const trimmedMessage = message.trim();
      const commitArgs = ["commit-tree", rewrittenTree.trim()];
      for (const parent of parents) {
        commitArgs.push("-p", parent);
      }
      commitArgs.push("-m", trimmedMessage);
      const { stdout: commitSha } = await execGit(repoRoot, commitArgs, {
        env: {
          ...temporaryIndexEnv,
          GIT_AUTHOR_NAME: authorName,
          GIT_AUTHOR_EMAIL: authorEmail,
          GIT_AUTHOR_DATE: authorDate,
        },
      });
      rewrittenHead = commitSha.trim();

      try {
        await execGit(repoRoot, [
          "update-ref",
          "HEAD",
          rewrittenHead,
          originalHead,
        ]);
        refUpdated = true;
      } catch (error) {
        const { stdout: currentHead } = await execGit(repoRoot, [
          "rev-parse",
          "HEAD",
        ]);
        if (currentHead.trim() !== originalHead) {
          throw new Error(
            `HEAD moved to ${currentHead.trim().slice(0, 7)} while the drop was being prepared; ` +
              `expected ${originalHead.slice(0, 7)}. Re-select the commit and retry.`,
          );
        }
        throw error;
      }

      await applyCachedPatchInRepo(repoRoot, selectedPatch, true);

      // Reverse-apply to the working tree instead of restoring the file from HEAD.
      // `git restore --source=HEAD` overwrote the whole file and destroyed
      // uncommitted local edits; reverse-applying removes exactly the dropped
      // hunks and leaves everything else the user typed untouched.
      await patchApi.applyPatch(repoRoot, selectedPatch, { reverse: true });
    } catch (error) {
      if (refUpdated && rewrittenHead) {
        await restoreHeadAndIndex(
          repoRoot,
          originalHead,
          rewrittenHead,
          originalIndexTree,
          error,
        );
      }
      throw error;
    } finally {
      await fs
        .rm(temporaryIndexDir, { recursive: true, force: true })
        .catch(() => {}); // review-scope:allow silent-catch — temp-dir cleanup
    }
  }

  /**
   * Undo a partially applied drop: point the branch back at the original commit
   * and rebuild the index from the tree captured before the mutation. Never
   * touches the working tree, so local edits survive a failed drop.
   *
   * Throws a structured error preserving both the original failure and the
   * rollback failure, with the captured HEAD/index identifiers for recovery.
   */
  async function restoreHeadAndIndex(
    repoRoot: string,
    originalHead: string,
    rollbackFromHead: string,
    originalIndexTree: string,
    originalError: unknown,
  ): Promise<never> {
    const rollbackErrors: unknown[] = [];
    try {
      await execGit(repoRoot, [
        "update-ref",
        "HEAD",
        originalHead,
        rollbackFromHead,
      ]);
    } catch (error) {
      rollbackErrors.push(error);
    }
    if (rollbackErrors.length === 0) {
      try {
        await execGit(repoRoot, ["read-tree", originalIndexTree]);
      } catch (error) {
        rollbackErrors.push(error);
      }
    }
    if (rollbackErrors.length > 0) {
      const detail = rollbackErrors
        .map((error) => (error instanceof Error ? error.message : String(error)))
        .join("; ");
      const originalDetail =
        originalError instanceof Error ? originalError.message : String(originalError);
      throw new Error(
        `Drop failed (${originalDetail}) and rollback is incomplete (${detail}). ` +
          `Recover by inspecting HEAD, then restore ${originalHead} and index tree ${originalIndexTree}.`,
      );
    }
    throw originalError;
  }

  return {
    cherryPickSelected,
    revertSelected,
    dropSelectedFromHead,
    buildSelectedPatch,
    readCommitPatch,
  };
}
