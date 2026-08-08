import type { SpecialConflictKind } from "../core/types";
import { resolveRepoRelativePath } from "../util/repoPath";

export const DISCARD_BACK_MESSAGE =
  "Discard unsaved changes and return to the conflict list?";
export const DISCARD_OPEN_FILE_MESSAGE =
  "Discard unsaved changes and open another conflict file?";

export const APPLY_CONFIRM_MESSAGE =
  "Mark this file as resolved and write the result to disk?";

export const NOT_UNMERGED_MESSAGE =
  "That file is not in the current unmerged conflict list.";

export function discardConfirmMessage(
  action: { action: "backToList" } | {
    action: "openFile";
    relativePath: string;
    targetChange: "first" | "last";
  },
): string {
  return action.action === "backToList"
    ? DISCARD_BACK_MESSAGE
    : DISCARD_OPEN_FILE_MESSAGE;
}

type UnmergedFileEntry = {
  relativePath: string;
  stageCode: string;
  specialKind: SpecialConflictKind;
};

export function findUnmergedFileEntry(
  files: UnmergedFileEntry[],
  relativePath: string,
): UnmergedFileEntry | undefined {
  return files.find((f) => f.relativePath.replace(/\\/g, "/") === relativePath);
}

export function inferStageCodeFromStages(
  base: string | null,
  ours: string | null,
  theirs: string | null,
): string {
  if (base === null && ours !== null && theirs !== null) {
    return "AA";
  }
  if (base !== null && ours !== null && theirs === null) {
    return "UD";
  }
  if (base !== null && ours === null && theirs !== null) {
    return "DU";
  }
  return "UU";
}

export async function requireMergeTargetFilePath(
  repoRoot: string,
  relativePath: string,
  listUnmergedFiles: (root: string) => Promise<UnmergedFileEntry[]>,
  openedMergePaths: Set<string>,
): Promise<
  | { ok: true; absolutePath: string; relativePath: string }
  | { ok: false; code: string; message: string }
> {
  const resolved = resolveRepoRelativePath(repoRoot, relativePath);
  if (!resolved.ok) {
    return { ok: false, code: resolved.code, message: resolved.message };
  }

  const openedKey = `${repoRoot}\0${resolved.relativePath}`;
  if (openedMergePaths.has(openedKey)) {
    return {
      ok: true,
      absolutePath: resolved.absolutePath,
      relativePath: resolved.relativePath,
    };
  }

  const files = await listUnmergedFiles(repoRoot);
  if (!findUnmergedFileEntry(files, resolved.relativePath)) {
    return {
      ok: false,
      code: "NOT_UNMERGED",
      message: NOT_UNMERGED_MESSAGE,
    };
  }

  return {
    ok: true,
    absolutePath: resolved.absolutePath,
    relativePath: resolved.relativePath,
  };
}