import type { GitExecFn } from "./types";

export function createStagingApi(execGit: GitExecFn) {
  async function stageAll(repoRoot: string): Promise<void> {
    await execGit(repoRoot, ["add", "-A"]);
  }

  async function stageFiles(repoRoot: string, paths: string[]): Promise<void> {
    if (paths.length === 0) {
      return;
    }
    await execGit(repoRoot, ["add", "--", ...paths]);
  }

  async function listStagedPaths(repoRoot: string): Promise<string[]> {
    const { stdout } = await execGit(repoRoot, [
      "diff",
      "--cached",
      "--name-only",
      "-z",
      "--diff-filter=ACDMRTUXB",
    ]);
    return stdout
      .split("\0")
      .filter(Boolean)
      .map((filePath) => filePath.replace(/\\/g, "/"));
  }

  async function unstageAll(repoRoot: string): Promise<void> {
    try {
      await execGit(repoRoot, ["restore", "--staged", "."]);
    } catch {
      await execGit(repoRoot, ["reset", "HEAD"]);
    }
  }

  async function unstageFiles(repoRoot: string, paths: string[]): Promise<void> {
    if (paths.length === 0) {
      return;
    }
    try {
      await execGit(repoRoot, ["restore", "--staged", "--", ...paths]);
    } catch {
      await execGit(repoRoot, ["reset", "HEAD", "--", ...paths]);
    }
  }

  async function rollbackTrackedFiles(
    repoRoot: string,
    paths: string[],
  ): Promise<void> {
    if (paths.length === 0) {
      return;
    }
    try {
      // Rollback means discard the complete local change, including an index
      // entry. Restoring only the worktree leaves staged edits behind and makes
      // the file reappear immediately after the confirmation dialog closes.
      await execGit(repoRoot, ["restore", "--staged", "--worktree", "--", ...paths]);
    } catch (restoreError) {
      // Git versions without `restore --staged --worktree` need the index reset
      // separately before the checkout fallback can fully discard a change.
      try {
        await execGit(repoRoot, ["reset", "HEAD", "--", ...paths]);
      } catch (resetError) {
        const restoreMessage = restoreError instanceof Error
          ? restoreError.message
          : String(restoreError);
        const message = resetError instanceof Error
          ? resetError.message
          : String(resetError);
        throw new Error(
          `Could not roll back ${paths.join(", ")}: ${message} (restore failed: ${restoreMessage})`,
        );
      }
      await execGit(repoRoot, ["checkout", "--", ...paths]);
    }
  }

  async function removeUnversionedFiles(
    repoRoot: string,
    paths: string[],
  ): Promise<void> {
    if (paths.length === 0) {
      return;
    }
    await execGit(repoRoot, ["clean", "-f", "--", ...paths]);
  }

  return {
    stageAll,
    stageFiles,
    listStagedPaths,
    unstageAll,
    unstageFiles,
    rollbackTrackedFiles,
    removeUnversionedFiles,
  };
}
