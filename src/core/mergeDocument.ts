// Assemble a MergeDocument from raw stage content (specs §8, §11). Pure: no I/O.
// Git reading and file writing live in services (host side); this only builds
// the in-memory model from strings already fetched.

import { detectEol, hasFinalNewline } from "./lines";
import { extractLabels } from "./markers";
import { DEFAULT_MERGE_ENGINE, MERGE_ENGINES } from "./mergeEngines";
import { reflowResultRanges, serializeResult } from "./serialize";
import type { Eol, MergeDocument, SpecialConflictKind } from "./types";
import type { MergeEngine } from "../types/settings";

export type BuildMergeDocumentInput = {
  repoRoot: string;
  relativePath: string;
  absolutePath: string;
  base: string | null;
  ours: string | null;
  theirs: string | null;
  worktree: string;
  special?: SpecialConflictKind;
  languageId?: string;
  now?: number;
  mergeEngine?: MergeEngine;
  oursLabel?: string;
  theirsLabel?: string;
};

export function buildMergeDocument(
  input: BuildMergeDocumentInput,
): MergeDocument {
  const eol: Eol = detectEol(input.worktree);
  const finalNewline = hasFinalNewline(input.worktree);
  const labels = extractLabels(input.worktree);

  const engine = MERGE_ENGINES[input.mergeEngine ?? DEFAULT_MERGE_ENGINE];
  const blocks = reflowResultRanges(engine(input));

  const changeOrder = blocks.filter((b) => b.changeIndex >= 0).map((b) => b.id);
  const conflictOrder = blocks
    .filter((b) => b.kind === "conflict")
    .map((b) => b.id);

  const result = serializeResult(blocks, eol, finalNewline);

  return {
    repoRoot: input.repoRoot,
    relativePath: input.relativePath,
    absolutePath: input.absolutePath,
    base: input.base,
    ours: input.ours,
    theirs: input.theirs,
    worktree: input.worktree,
    result,
    blocks,
    changeOrder,
    conflictOrder,
    special: input.special ?? "none",
    oursLabel: input.oursLabel || labels.oursLabel || "Local",
    theirsLabel: input.theirsLabel || labels.theirsLabel || "Incoming",
    encoding: "utf8",
    eol,
    hasFinalNewline: finalNewline,
    languageId: input.languageId,
    dirty: false,
    // Time is supplied by the composition boundary. A stable fallback keeps
    // core deterministic for tests, alternate runtimes, and replay.
    loadedAt: input.now ?? 0,
  };
}
