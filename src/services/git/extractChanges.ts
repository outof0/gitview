import type { GitExecFn } from "./types";
import { createPatchApi } from "./patch";

export function createExtractChangesApi(execGit: GitExecFn) {
  const patch = createPatchApi(execGit);

  async function extractFromCommit(
    repoRoot: string,
    sha: string,
    paths?: string[],
  ): Promise<void> {
    if (paths && paths.length > 0) {
      const { stdout } = await execGit(repoRoot, ["show", sha, "-p", "--", ...paths]);
      if (!stdout.trim()) {
        throw new Error("No changes to extract for the selected paths.");
      }
      await patch.applyPatch(repoRoot, stdout);
      return;
    }
    await execGit(repoRoot, ["cherry-pick", "-n", sha]);
  }

  return { extractFromCommit };
}