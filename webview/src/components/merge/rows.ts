// Pure view-model helpers for the 3-pane merge renderer. Converts the engine's
// ChangeBlocks into aligned rows for the Local / Result / Repository panes.
// No React, no DOM — easy to unit-test.

import { isMagicMergeResolvable } from "../../../../src/core";
import type { ChangeBlock, MergeDocument } from "../../../../src/core/types";
import { buildBaseRows, buildBlockRows } from "./rowsBuild";
import { classifyChangeType } from "./rowsHelpers";

export type { BlockRows, ChangeType, RowCell, RowOrigin } from "./rowsTypes";
export type { BuildBlockRowsOptions } from "./rowsHelpers";
export { buildBlockRows, buildBaseRows, classifyChangeType };

function isUntouchedMagicMergeCandidate(block: ChangeBlock): boolean {
  const conflict = block.metadata.conflict;
  return (
    block.kind === "conflict" &&
    block.status === "unresolved" &&
    !block.metadata.hasManualEdit &&
    conflict?.ours === "pending" &&
    conflict.theirs === "pending" &&
    conflict.acceptedOrder.length === 0 &&
    isMagicMergeResolvable(block)
  );
}

// Counts for the toolbar/bottom-bar (specs §21).
export function countChanges(doc: MergeDocument): {
  totalChanges: number;
  conflicts: number;
  remaining: number;
  unresolvedNonConflicting: number;
  unresolvedSimpleConflicts: number;
} {
  const totalChanges = doc.blocks.filter((b) => b.kind !== "unchanged").length;
  const conflicts = doc.blocks.filter((b) => b.kind === "conflict").length;
  const remaining = doc.blocks.filter(
    (b) => b.kind === "conflict" && b.status === "unresolved",
  ).length;
  const unresolvedNonConflicting = doc.blocks.filter(
    (b) =>
      (b.kind === "ours_only" || b.kind === "theirs_only") &&
      b.status === "unresolved",
  ).length;
  const supportsMagicMerge =
    doc.special === "none" &&
    doc.base !== null &&
    doc.ours !== null &&
    doc.theirs !== null;
  const unresolvedSimpleConflicts = supportsMagicMerge
    ? doc.blocks.filter(isUntouchedMagicMergeCandidate).length
    : 0;
  return {
    totalChanges,
    conflicts,
    remaining,
    unresolvedNonConflicting,
    unresolvedSimpleConflicts,
  };
}

// Which unchanged blocks should render collapsed: longer than `threshold` and
// not explicitly expanded by the user. The center pane drives the line count so
// every pane collapses the same blocks and rows stay aligned across panes.
export function collapsedBlockIds(
  rows: import("./rowsTypes").BlockRows[],
  threshold: number,
  expanded: string[],
): Set<string> {
  const set = new Set<string>();
  for (const r of rows) {
    if (
      r.changeType === "unchanged" &&
      r.center.length > threshold &&
      !expanded.includes(r.blockId)
    ) {
      set.add(r.blockId);
    }
  }
  return set;
}

// Block ids whose center text contains the query (case-insensitive). Drives the
// find highlight + count (mockup runSearch over #edCenter .row). Queries shorter
// than 2 chars match nothing, mirroring the mockup.
export function searchMatchBlockIds(
  rows: import("./rowsTypes").BlockRows[],
  query: string,
): string[] {
  if (query.trim().length < 2) {
    return [];
  }
  const q = query.toLowerCase();
  return rows
    .filter((r) => r.centerText.toLowerCase().includes(q))
    .map((r) => r.blockId);
}
