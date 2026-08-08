import { buildMergeDocument } from "../../../src/core/mergeDocument";
import type { MergeDocument } from "../../../src/core/types";

export function makeTestDoc(
  base: string,
  ours: string,
  theirs: string,
): MergeDocument {
  return buildMergeDocument({
    repoRoot: "/repo",
    relativePath: "test.ts",
    absolutePath: "/repo/test.ts",
    base,
    ours,
    theirs,
    worktree: ours,
  });
}