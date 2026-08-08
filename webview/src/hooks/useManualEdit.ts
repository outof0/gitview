import { useCallback } from "react";
import { useGitViewStore } from "../stores/gitViewStore";
import { manualEdit } from "../../../src/core";
import { reflowResultRanges, serializeResult } from "../../../src/core";
import type { ChangeBlock, MergeDocument } from "../../../src/core/types";

/**
 * Maps an edited line range in the result editor back to the owning block
 * and updates it. If the edit spans multiple blocks, merges them into one
 * manual block.
 */
export function useManualEdit() {
  const commitBlocks = useCallback(
    (doc: MergeDocument, blocks: ChangeBlock[]) => {
      const reflowed = reflowResultRanges(blocks);
      const result = serializeResult(reflowed, doc.eol, doc.hasFinalNewline);
      useGitViewStore
        .getState()
        .commitActiveDocument({
          ...doc,
          blocks: reflowed,
          result,
          dirty: true,
        });
    },
    [],
  );

  const applyManualEditToBlock = useCallback(
    (blockId: string, newText: string) => {
      const doc = useGitViewStore.getState().activeDocument;
      if (!doc) {
        return;
      }
      const block = doc.blocks.find((b) => b.id === blockId);
      if (!block) {
        return;
      }
      const updated = manualEdit(block, newText);
      const blocks = doc.blocks.map((b) => (b.id === block.id ? updated : b));
      commitBlocks(doc, blocks);
    },
    [commitBlocks],
  );

  const applyManualEdit = useCallback(
    (startLine: number, endLine: number, newText: string) => {
      const doc = useGitViewStore.getState().activeDocument;
      if (!doc) {
        return;
      }

      // Find blocks whose resultRange overlaps the edited range
      const affectedBlocks = doc.blocks.filter((b) => {
        const r = b.resultRange;
        return r.start < endLine && r.end > startLine;
      });

      if (affectedBlocks.length === 0) {
        return;
      }

      // `!` below: `affectedBlocks` is non-empty past the guard above.
      if (affectedBlocks.length === 1) {
        // Single block edit — update its resultText
        const block = affectedBlocks[0]!;
        const updated = manualEdit(block, newText);
        const blocks = doc.blocks.map((b) => (b.id === block.id ? updated : b));
        commitBlocks(doc, blocks);
        return;
      }

      // Multi-block edit — merge affected blocks into one manual block
      const firstBlock = affectedBlocks[0]!;
      const lastBlock = affectedBlocks[affectedBlocks.length - 1]!;

      const mergedBlock = {
        ...firstBlock,
        id: firstBlock.id,
        kind: "conflict" as const,
        resultText: newText,
        resultRange: {
          start: firstBlock.resultRange.start,
          end: lastBlock.resultRange.end,
        },
        status: "manual" as const,
        metadata: { hasManualEdit: true, lastActionAt: Date.now() },
      };

      // Remove affected blocks (except the first), replace first with merged
      const blocks = doc.blocks.filter(
        (b) => !affectedBlocks.some((ab) => ab.id === b.id),
      );
      const idx = blocks.findIndex((b) => b.id === firstBlock.id);
      blocks.splice(idx >= 0 ? idx : 0, 0, mergedBlock);

      commitBlocks(doc, blocks);
    },
    [commitBlocks],
  );

  return { applyManualEdit, applyManualEditToBlock };
}
