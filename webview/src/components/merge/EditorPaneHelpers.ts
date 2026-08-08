import type { BlockRows } from "./rows";

export type EditorPaneSide = "left" | "center" | "right";

export function sideStatusFor(
  side: EditorPaneSide,
  block: BlockRows,
): NonNullable<BlockRows["conflictSideStatus"]>["ours"] | undefined {
  if (side === "center" || block.kind !== "conflict") {
    return undefined;
  }
  return side === "left"
    ? block.conflictSideStatus?.ours
    : block.conflictSideStatus?.theirs;
}

export function canResolveFromSide(side: EditorPaneSide, block: BlockRows): boolean {
  if (side === "center" || !block.navigable) {
    return false;
  }
  if (block.kind === "conflict") {
    const status = sideStatusFor(side, block);
    return !status || status === "pending";
  }
  if (block.kind === "ours_only") {
    return side === "left";
  }
  if (block.kind === "theirs_only") {
    return side === "right";
  }
  return block.kind === "both_same";
}