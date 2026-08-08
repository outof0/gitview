import { useGitViewStore } from "../stores/gitViewStore";
import { buildMergeDocument } from "../../../src/core/mergeDocument";
import { manualEdit } from "../../../src/core/resolve";
import { reflowResultRanges, serializeResult } from "../../../src/core/serialize";
import type { MergeDocument } from "../../../src/core/types";

export function applyManualToBlock(doc: MergeDocument, blockId: string, text: string) {
  useGitViewStore.setState({ activeDocument: doc });
  const blocks = doc.blocks.map((b) =>
    b.id === blockId ? manualEdit(b, text) : b,
  );
  const reflowed = reflowResultRanges(blocks);
  const result = serializeResult(reflowed, doc.eol, doc.hasFinalNewline);
  useGitViewStore.getState().commitActiveDocument({
    ...doc,
    blocks: reflowed,
    result,
    dirty: true,
  });
}

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

export function conflictId(doc: MergeDocument): string {
  const block = doc.blocks.find((b) => b.kind === "conflict");
  if (!block) {
    throw new Error("expected conflict block");
  }
  return block.id;
}

export function blockOf(doc: MergeDocument, id: string) {
  const block = doc.blocks.find((b) => b.id === id);
  if (!block) {
    throw new Error(`missing block ${id}`);
  }
  return block;
}

export type MatrixExpect = {
  status: string;
  resultContains: string;
  remaining: number;
  side: {
    ours: string;
    theirs: string;
    acceptedOrder: string[];
  } | null;
};