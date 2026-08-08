import type { ChangeBlock, ConflictSide } from "../../../src/core/types";

export type ResolveContextMenuMode = "none" | "full" | "reset-only";

function conflictSideStatus(
  block: ChangeBlock,
  side: ConflictSide,
): "pending" | "accepted" | "ignored" | undefined {
  if (block.kind !== "conflict" || !block.metadata.conflict) {
    return undefined;
  }
  return block.metadata.conflict[side];
}

/** Append is meaningful only after the other side is already accepted. */
export function canAppendSide(
  block: ChangeBlock,
  side: ConflictSide,
): boolean {
  if (block.kind !== "conflict" || block.status !== "unresolved") {
    return false;
  }
  const other: ConflictSide = side === "ours" ? "theirs" : "ours";
  return (
    conflictSideStatus(block, side) === "pending" &&
    conflictSideStatus(block, other) === "accepted"
  );
}

/** Whether gutter/context resolve shortcuts can still mutate this block. */
export function canApplyResolutionAction(block: ChangeBlock): boolean {
  if (block.kind === "unchanged") {
    return false;
  }
  return block.kind !== "conflict" || block.status === "unresolved";
}

export function getResolveContextMenuMode(
  block: ChangeBlock | undefined,
): ResolveContextMenuMode {
  if (!block || block.kind === "unchanged") {
    return "none";
  }
  if (block.kind === "conflict") {
    return block.status === "unresolved" ? "full" : "reset-only";
  }
  return block.status === "unresolved" ? "full" : "none";
}
