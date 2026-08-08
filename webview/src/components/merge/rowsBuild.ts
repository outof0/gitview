import type { MergeDocument } from "../../../../src/core/types";
import {
  blameLabelForBlock,
  centerLinesFor,
  classifyChangeType,
  conflictSideStatus,
  padBaseLines,
  padCells,
  padOriginCells,
  splitForView,
  type BuildBlockRowsOptions,
} from "./rowsHelpers";
import type { BlockRows } from "./rowsTypes";

// Build aligned rows for every block in document order.
export function buildBlockRows(
  doc: MergeDocument,
  opts?: BuildBlockRowsOptions,
): BlockRows[] {
  let leftNo = 1;
  let centerNo = 1;
  let rightNo = 1;

  return doc.blocks.map((block) => {
    const leftLines = splitForView(block.oursText);
    const rightLines = splitForView(block.theirsText);
    const centerLines = centerLinesFor(block);

    const maxLines = Math.max(
      leftLines.length,
      centerLines.length,
      rightLines.length,
      1,
    );

    const leftStart = leftNo;
    const leftEnd =
      leftLines.length > 0 ? leftNo + leftLines.length - 1 : leftNo;
    const rightStart = rightNo;
    const rightEnd =
      rightLines.length > 0 ? rightNo + rightLines.length - 1 : rightNo;

    const left = padCells(leftLines, maxLines, leftNo, "ours");
    const center = padOriginCells(centerLines, maxLines, centerNo);
    const right = padCells(rightLines, maxLines, rightNo, "theirs");

    leftNo += leftLines.length;
    centerNo += centerLines.length;
    rightNo += rightLines.length;

    return {
      blockId: block.id,
      kind: block.kind,
      status: block.status,
      changeType: classifyChangeType(block),
      navigable: block.kind !== "unchanged",
      isConflict: block.kind === "conflict" && block.status === "unresolved",
      resolved: block.status !== "unresolved",
      conflictSideStatus: conflictSideStatus(block),
      resultStart: block.resultRange.start,
      resultEnd: block.resultRange.end,
      centerText: centerLines.map((line) => line.text).join("\n"),
      blameLeft: blameLabelForBlock(
        block,
        "left",
        doc,
        leftStart,
        leftEnd,
        opts?.blameOurs,
      ),
      blameRight: blameLabelForBlock(
        block,
        "right",
        doc,
        rightStart,
        rightEnd,
        opts?.blameTheirs,
      ),
      baseLines: padBaseLines(block.baseText, maxLines),
      left,
      center,
      right,
    };
  });
}

// Build rows for the optional Base Revision pane. The base text is the common
// ancestor; we render it (in the "left" cell slot so EditorPane can show it)
// with no change coloring, since base itself has no per-side change type.
export function buildBaseRows(doc: MergeDocument): BlockRows[] {
  let baseNo = 1;

  return doc.blocks.map((block) => {
    const baseLines = splitForView(block.baseText);
    const maxLines = Math.max(baseLines.length, 1);
    const left = padCells(baseLines, maxLines, baseNo, "base");
    baseNo += baseLines.length;

    return {
      blockId: block.id,
      kind: block.kind,
      status: block.status,
      changeType: "unchanged",
      navigable: false,
      isConflict: false,
      resolved: block.status !== "unresolved",
      conflictSideStatus: conflictSideStatus(block),
      resultStart: block.resultRange.start,
      resultEnd: block.resultRange.end,
      centerText: "",
      blameLeft: `base (${doc.oursLabel})`,
      blameRight: `base (${doc.theirsLabel})`,
      baseLines: padBaseLines(block.baseText, maxLines),
      left,
      center: [],
      right: [],
    };
  });
}