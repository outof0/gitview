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
      await execGit(repoRoot, ["restore", "--", ...paths]);
    } catch {
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
    unstageAll,
    unstageFiles,
    rollbackTrackedFiles,
    removeUnversionedFiles,
  };
}
