import type {
  CompareMode,
  HighlightingMode,
  WhitespacePolicy,
} from "../../stores/gitViewStore";
import type { BlockRows } from "./rows";
import { linesEqualUnderPolicy } from "./whitespace";

export type RowHighlightContext = {
  whitespacePolicy?: WhitespacePolicy;
  compareMode?: CompareMode;
};

const defaultHighlightContext: RowHighlightContext = {
  whitespacePolicy: "doNotIgnore",
  compareMode: "default",
};

type Side = "left" | "center" | "right";

function sideLineText(
  block: BlockRows,
  side: "left" | "right",
  rowIndex: number,
): string | null {
  const cells = side === "left" ? block.left : block.right;
  const cell = cells[rowIndex];
  if (!cell || cell.origin === "filler" || cell.text === null) {
    return null;
  }
  return cell.text;
}

/** True when ours or theirs differs from base on this aligned row (conflict region). */
export function conflictRegionLine(
  block: BlockRows,
  rowIndex: number,
): boolean {
  if (block.kind !== "conflict") {
    return false;
  }

  if (rowIndex >= block.baseLines.length) {
    return (
      sideLineText(block, "left", rowIndex) !== null ||
      sideLineText(block, "right", rowIndex) !== null
    );
  }
  if (block.baseLines.length === 0) {
    return true;
  }

  const base = block.baseLines[rowIndex] ?? "";
  const left = sideLineText(block, "left", rowIndex);
  const right = sideLineText(block, "right", rowIndex);
  if (left !== null && left !== base) {
    return true;
  }
  if (right !== null && right !== base) {
    return true;
  }
  return false;
}

function sideStatusFor(
  side: Side,
  block: BlockRows,
): NonNullable<BlockRows["conflictSideStatus"]>["ours"] | undefined {
  if (side === "center" || block.kind !== "conflict") {
    return undefined;
  }
  return side === "left"
    ? block.conflictSideStatus?.ours
    : block.conflictSideStatus?.theirs;
}

function centerLineText(block: BlockRows, rowIndex: number): string | null {
  const cell = block.center[rowIndex];
  if (!cell || cell.origin === "filler" || cell.text === null) {
    return null;
  }
  return cell.text;
}

/**
 * Reference text for compare-mode highlighting.
 * `null` = this side is not part of the active compare pair.
 * `undefined` = use legacy base-line comparison.
 */
function compareReferenceText(
  side: Side,
  block: BlockRows,
  rowIndex: number,
  compareMode: CompareMode,
): string | null | undefined {
  const left = sideLineText(block, "left", rowIndex);
  const right = sideLineText(block, "right", rowIndex);
  const center = centerLineText(block, rowIndex);
  const base =
    rowIndex < block.baseLines.length ? (block.baseLines[rowIndex] ?? "") : "";

  switch (compareMode) {
    case "localBase":
      return side === "left" ? base : null;
    case "repoBase":
      return side === "right" ? base : null;
    case "localRepo":
      if (side === "left") {
        return right ?? "";
      }
      if (side === "right") {
        return left ?? "";
      }
      return null;
    case "localMiddle":
      return side === "left" ? (center ?? "") : null;
    case "repoMiddle":
      return side === "right" ? (center ?? "") : null;
    default:
      return undefined;
  }
}

function linesDiffer(
  lineText: string,
  reference: string,
  policy: WhitespacePolicy,
): boolean {
  return !linesEqualUnderPolicy(lineText, reference, policy);
}

/** True when this visual row has a real change on the given side (per-line). */
export function lineHasChange(
  side: Side,
  block: BlockRows,
  cell: BlockRows[Side][number],
  rowIndex: number,
  ctx: RowHighlightContext = defaultHighlightContext,
): boolean {
  if (cell.origin === "filler" || cell.text === null) {
    if (side === "center" && block.kind === "conflict" && !block.resolved) {
      return conflictRegionLine(block, rowIndex);
    }
    return false;
  }
  if (block.changeType === "unchanged" && block.kind !== "conflict") {
    return false;
  }

  const policy = ctx.whitespacePolicy ?? "doNotIgnore";
  const compareMode = ctx.compareMode ?? "default";
  const compareRef = compareReferenceText(side, block, rowIndex, compareMode);

  if (compareRef === null) {
    return false;
  }

  const lineText = cell.text;

  if (compareRef !== undefined) {
    return linesDiffer(lineText, compareRef, policy);
  }

  // Side panes only show their own changes; center always compares when applicable.
  if (side !== "center") {
    if (block.kind === "ours_only" && side !== "left") {
      return false;
    }
    if (block.kind === "theirs_only" && side !== "right") {
      return false;
    }
  }

  // Center shows base for unresolved conflicts — still highlight the conflict span.
  if (side === "center" && block.kind === "conflict" && !block.resolved) {
    return conflictRegionLine(block, rowIndex);
  }

  const baseLine = block.baseLines[rowIndex];

  // Inserted lines beyond the base span.
  if (rowIndex >= block.baseLines.length) {
    return true;
  }

  // Pure add block (no base lines).
  if (block.baseLines.length === 0) {
    return true;
  }

  return linesDiffer(lineText, baseLine ?? "", policy);
}

function changeTypeForLine(
  side: Side,
  block: BlockRows,
  cell: BlockRows[Side][number],
  rowIndex: number,
): string {
  if (block.kind === "conflict") {
    const sideStatus = sideStatusFor(side, block);
    if (sideStatus === "accepted") {
      return "nx-resolved";
    }
    if (sideStatus === "ignored") {
      return "nx-ignored";
    }
    if (block.resolved) {
      return `nx-${block.changeType}`;
    }
    return "nx-conflict";
  }

  if (side === "center" && cell.origin === "manual") {
    return "nx-manual";
  }

  const rowIndexBeyondBase = rowIndex >= block.baseLines.length;
  const baseLine = block.baseLines[rowIndex];
  const hasBaseLine = rowIndex < block.baseLines.length;

  if (block.changeType === "deleted" && hasBaseLine && cell.text === null) {
    return "nx-deleted";
  }
  if (
    rowIndexBeyondBase ||
    (hasBaseLine && baseLine === "" && cell.text !== "")
  ) {
    return "nx-added";
  }
  if (block.changeType === "added") {
    return "nx-added";
  }
  if (block.changeType === "deleted") {
    return "nx-deleted";
  }
  if (block.changeType === "modified") {
    return "nx-modified";
  }
  if (block.changeType === "conflict") {
    return "nx-conflict";
  }
  return `nx-${block.changeType}`;
}

/** Line background — "Highlight lines" mode only; empty in "words" / "none". */
export function rowTypeClass(
  side: Side,
  block: BlockRows,
  cell: BlockRows[Side][number],
  highlightingMode: HighlightingMode,
  rowIndex: number,
  ctx: RowHighlightContext = defaultHighlightContext,
): string {
  if (highlightingMode !== "lines") {
    return "";
  }
  if (!lineHasChange(side, block, cell, rowIndex, ctx)) {
    return "";
  }
  return changeTypeForLine(side, block, cell, rowIndex);
}

/** 3px gutter stripe — visible in words + lines mode, only on changed lines. */
export function stripeTypeClass(
  side: Side,
  block: BlockRows,
  cell: BlockRows[Side][number],
  highlightingMode: HighlightingMode,
  rowIndex: number,
  ctx: RowHighlightContext = defaultHighlightContext,
): string {
  if (highlightingMode === "none") {
    return "";
  }
  if (!lineHasChange(side, block, cell, rowIndex, ctx)) {
    return "";
  }
  return changeTypeForLine(side, block, cell, rowIndex);
}

export function shouldWordHighlight(
  side: Side,
  block: BlockRows,
  cell: BlockRows[Side][number],
  highlightingMode: HighlightingMode,
  rowIndex: number,
  ctx: RowHighlightContext = defaultHighlightContext,
): boolean {
  return (
    highlightingMode === "words" &&
    side !== "center" &&
    lineHasChange(side, block, cell, rowIndex, ctx)
  );
}

/** Reference text for word-level diff on side panes (respects compare mode). */
export function wordDiffReferenceText(
  side: Side,
  block: BlockRows,
  rowIndex: number,
  ctx: RowHighlightContext = defaultHighlightContext,
): string {
  const compareMode = ctx.compareMode ?? "default";
  const compareRef = compareReferenceText(side, block, rowIndex, compareMode);
  if (compareRef !== undefined && compareRef !== null) {
    return compareRef;
  }
  return block.baseLines[rowIndex] ?? "";
}

/** Build a center cell from Monaco model text (may differ from stale row cells). */
function centerCellForLine(
  block: BlockRows,
  lineIndex: number,
  lineText: string,
): BlockRows["center"][number] {
  const existing = block.center[lineIndex];
  return {
    text: lineText,
    lineNo: existing?.lineNo ?? lineIndex + 1,
    origin: existing?.origin ?? ("result" as const),
  };
}

/** Center pane: highlight changed/ conflict lines (model text, not filler cells). */
export function centerLineNeedsHighlight(
  block: BlockRows,
  lineIndex: number,
  lineText: string,
  ctx: RowHighlightContext = defaultHighlightContext,
): boolean {
  if (!block.navigable) {
    return false;
  }
  const cell = centerCellForLine(block, lineIndex, lineText);
  return lineHasChange("center", block, cell, lineIndex, ctx);
}

/** Monaco whole-line decoration class for a center model line. */
export function monacoLineDecorationClass(
  block: BlockRows,
  lineIndex: number,
  lineText: string,
  ctx: RowHighlightContext = defaultHighlightContext,
): string {
  if (!centerLineNeedsHighlight(block, lineIndex, lineText, ctx)) {
    return "";
  }

  const typeClass = changeTypeForLine(
    "center",
    block,
    centerCellForLine(block, lineIndex, lineText),
    lineIndex,
  );
  return typeClass ? typeClass.replace(/^nx-/, "nx-monaco-") : "";
}

/** Monaco glyph-margin stripe for center lines (words + lines mode). */
export function monacoStripeDecorationClass(
  block: BlockRows,
  lineIndex: number,
  lineText: string,
  ctx: RowHighlightContext = defaultHighlightContext,
): string {
  const cell = centerCellForLine(block, lineIndex, lineText);
  const stripe = stripeTypeClass(
    "center",
    block,
    cell,
    "words",
    lineIndex,
    ctx,
  );
  return stripe ? stripe.replace(/^nx-/, "nx-monaco-stripe-") : "";
}
