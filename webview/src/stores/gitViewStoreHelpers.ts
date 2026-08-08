import type {
  ChangeBlock,
  ConflictSide,
  ConflictSideStatus,
  MergeDocument,
} from "../../../src/core/types";
import { reflowResultRanges, serializeResult } from "../../../src/core";
import type { GitViewState } from "./gitViewStoreTypes";

export function recomputeDocument(doc: MergeDocument): MergeDocument {
  const blocks = reflowResultRanges(doc.blocks);
  const result = serializeResult(blocks, doc.eol, doc.hasFinalNewline);
  return { ...doc, blocks, result, dirty: true };
}

export function updateBlock(
  doc: MergeDocument,
  blockId: string,
  updater: (block: ChangeBlock) => ChangeBlock,
): MergeDocument {
  const blocks = doc.blocks.map((b) => (b.id === blockId ? updater(b) : b));
  return recomputeDocument({ ...doc, blocks });
}

export function unresolvedConflictOrder(doc: MergeDocument): string[] {
  return doc.conflictOrder.filter((id) => {
    const block = doc.blocks.find((b) => b.id === id);
    return block?.status === "unresolved";
  });
}

export function scrollActiveBlock(
  get: () => GitViewState,
  blockId: string | null,
): void {
  if (blockId) {
    get().blockScrollIntoView?.(blockId);
  }
}

export function adjacentConflictFilePath(
  conflictFiles: GitViewState["conflictFiles"],
  currentPath: string,
  direction: "next" | "previous",
): string | null {
  const paths = conflictFiles.map((f) => f.relativePath);
  const idx = paths.indexOf(currentPath);
  if (idx < 0) {
    return null;
  }
  const nextIdx = direction === "next" ? idx + 1 : idx - 1;
  if (nextIdx < 0 || nextIdx >= paths.length) {
    return null;
  }
  return paths[nextIdx] ?? null;
}

export function conflictSideStatus(
  block: ChangeBlock,
  side: ConflictSide,
): ConflictSideStatus {
  if (block.metadata.conflict) {
    return block.metadata.conflict[side];
  }
  if (block.status === "accepted_ours") {
    return side === "ours" ? "accepted" : "ignored";
  }
  if (block.status === "accepted_theirs") {
    return side === "theirs" ? "accepted" : "ignored";
  }
  if (block.status === "accepted_both") {
    return "accepted";
  }
  if (block.status === "resolved" || block.status === "manual") {
    return "ignored";
  }
  return "pending";
}