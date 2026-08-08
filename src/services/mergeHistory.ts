import type { BlameSide } from "../types/blame";
import type { ExecGit } from "./blameRefs";

type ExecGitFn = ExecGit;

export type MergeRefs = {
  mergeBase: string;
  oursRef: string;
  theirsRef: string;
};

export type MergeRefsResult =
  | { ok: true; refs: MergeRefs }
  | { ok: false; code: "NOT_IN_MERGE" | "GIT_ERROR"; message: string };

export async function resolveMergeRefs(
  execGit: ExecGitFn,
  repoRoot: string,
): Promise<MergeRefsResult> {
  try {
    await execGit(repoRoot, ["rev-parse", "--verify", "MERGE_HEAD"]);
  } catch {
    return {
      ok: false,
      code: "NOT_IN_MERGE",
      message:
        "Changes-from-side history requires an active merge (MERGE_HEAD).",
    };
  }

  try {
    const { stdout: mergeBase } = await execGit(repoRoot, [
      "merge-base",
      "HEAD",
      "MERGE_HEAD",
    ]);
    const base = mergeBase.trim();
    if (!base) {
      return {
        ok: false,
        code: "GIT_ERROR",
        message: "Could not resolve merge base between HEAD and MERGE_HEAD.",
      };
    }
    return {
      ok: true,
      refs: {
        mergeBase: base,
        oursRef: "HEAD",
        theirsRef: "MERGE_HEAD",
      },
    };
  } catch (err) {
    return {
      ok: false,
      code: "GIT_ERROR",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Revision range for "Changes from <branch>" — merge-base..side-tip. */
export function changesFromSideRevisionRange(
  refs: MergeRefs,
  side: BlameSide,
): string {
  const tip = side === "ours" ? refs.oursRef : refs.theirsRef;
  return `${refs.mergeBase}..${tip}`;
}
