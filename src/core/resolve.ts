// Resolution actions over a single block. Pure & immutable: each returns a new
// ChangeBlock; callers reflow ranges afterward.

import type {
  AcceptBothOrder,
  ChangeBlock,
  ConflictResolutionState,
  ConflictSide,
  ResolutionStatus,
} from "./types";

function withResult(
  block: ChangeBlock,
  resultText: string,
  status: ResolutionStatus,
  hasManualEdit = false,
  conflictState?: ConflictResolutionState | null,
): ChangeBlock {
  const metadata = {
    ...block.metadata,
    hasManualEdit,
  };

  if (conflictState === null) {
    delete metadata.conflict;
  } else if (conflictState) {
    metadata.conflict = conflictState;
  }

  return {
    ...block,
    resultText,
    status,
    metadata,
  };
}

function conflictText(block: ChangeBlock, side: ConflictSide): string {
  return side === "ours" ? block.oursText : block.theirsText;
}

function normalizeAcceptedOrder(
  state: ConflictResolutionState,
): ConflictSide[] {
  const ordered = state.acceptedOrder.filter(
    (side, idx, arr) => state[side] === "accepted" && arr.indexOf(side) === idx,
  );

  for (const side of ["ours", "theirs"] as const) {
    if (state[side] === "accepted" && !ordered.includes(side)) {
      ordered.push(side);
    }
  }

  return ordered;
}

function statusFromConflictState(
  state: ConflictResolutionState,
): ResolutionStatus {
  if (state.ours === "pending" || state.theirs === "pending") {
    return "unresolved";
  }

  const accepted = normalizeAcceptedOrder(state);
  if (accepted.length === 0) {
    return "resolved";
  }
  if (accepted.length === 2) {
    return "accepted_both";
  }
  return accepted[0] === "ours" ? "accepted_ours" : "accepted_theirs";
}

function resultTextFromConflictState(
  block: ChangeBlock,
  state: ConflictResolutionState,
): string {
  const accepted = normalizeAcceptedOrder(state);
  if (accepted.length === 0) {
    return block.baseText;
  }

  return accepted
    .map((side) => conflictText(block, side))
    .filter((part) => part !== "")
    .join("\n");
}

function inferAcceptedBothOrder(block: ChangeBlock): ConflictSide[] {
  const oursFirst = [block.oursText, block.theirsText]
    .filter((part) => part !== "")
    .join("\n");
  const theirsFirst = [block.theirsText, block.oursText]
    .filter((part) => part !== "")
    .join("\n");

  if (block.resultText === theirsFirst && block.resultText !== oursFirst) {
    return ["theirs", "ours"];
  }

  return ["ours", "theirs"];
}

function conflictStateFor(block: ChangeBlock): ConflictResolutionState {
  if (block.metadata.conflict) {
    return {
      ...block.metadata.conflict,
      acceptedOrder: normalizeAcceptedOrder(block.metadata.conflict),
    };
  }

  switch (block.status) {
    case "accepted_ours":
      return { ours: "accepted", theirs: "ignored", acceptedOrder: ["ours"] };
    case "accepted_theirs":
      return { ours: "ignored", theirs: "accepted", acceptedOrder: ["theirs"] };
    case "accepted_both":
      return {
        ours: "accepted",
        theirs: "accepted",
        acceptedOrder: inferAcceptedBothOrder(block),
      };
    case "resolved":
      return { ours: "ignored", theirs: "ignored", acceptedOrder: [] };
    default:
      return { ours: "pending", theirs: "pending", acceptedOrder: [] };
  }
}

export function acceptOurs(block: ChangeBlock): ChangeBlock {
  if (block.kind === "conflict") {
    return withResult(block, block.oursText, "accepted_ours", false, {
      ours: "accepted",
      theirs: "ignored",
      acceptedOrder: ["ours"],
    });
  }

  return withResult(block, block.oursText, "accepted_ours");
}

export function acceptTheirs(block: ChangeBlock): ChangeBlock {
  if (block.kind === "conflict") {
    return withResult(block, block.theirsText, "accepted_theirs", false, {
      ours: "ignored",
      theirs: "accepted",
      acceptedOrder: ["theirs"],
    });
  }

  return withResult(block, block.theirsText, "accepted_theirs");
}

export function acceptBoth(
  block: ChangeBlock,
  order: AcceptBothOrder = "oursFirst",
): ChangeBlock {
  const acceptedOrder: ConflictSide[] =
    order === "oursFirst" ? ["ours", "theirs"] : ["theirs", "ours"];
  const text = acceptedOrder
    .map((side) => conflictText(block, side))
    .filter((part) => part !== "")
    .join("\n");

  return withResult(
    block,
    text,
    "accepted_both",
    false,
    block.kind === "conflict"
      ? {
          ours: "accepted",
          theirs: "accepted",
          acceptedOrder,
        }
      : undefined,
  );
}

// Append means "take both versions", ordered by the side the user picked.
// Treated as resolved when no conflict side is left pending.
export function appendSide(
  block: ChangeBlock,
  side: ConflictSide,
): ChangeBlock {
  if (block.kind === "conflict") {
    const state = conflictStateFor(block);
    const other: ConflictSide = side === "ours" ? "theirs" : "ours";
    if (state[other] !== "accepted") {
      // Append Left/Right requires the other side to be accepted first.
      return block;
    }
    return acceptBoth(block, other === "ours" ? "oursFirst" : "theirsFirst");
  }
  return acceptBoth(block, side === "ours" ? "oursFirst" : "theirsFirst");
}

export function acceptSide(
  block: ChangeBlock,
  side: ConflictSide,
): ChangeBlock {
  if (block.kind !== "conflict") {
    return side === "ours" ? acceptOurs(block) : acceptTheirs(block);
  }

  const current = conflictStateFor(block);
  if (current[side] !== "pending") {
    return block;
  }

  const acceptedOrder = normalizeAcceptedOrder(current);
  acceptedOrder.push(side);
  const next: ConflictResolutionState = {
    ...current,
    [side]: "accepted",
    acceptedOrder,
  };

  return withResult(
    block,
    resultTextFromConflictState(block, next),
    statusFromConflictState(next),
    false,
    next,
  );
}

export function ignoreSide(
  block: ChangeBlock,
  side: ConflictSide,
): ChangeBlock {
  if (block.kind !== "conflict") {
    return withResult(block, block.baseText, "resolved");
  }

  const current = conflictStateFor(block);
  const next: ConflictResolutionState = {
    ...current,
    [side]: "ignored",
    acceptedOrder: normalizeAcceptedOrder(current).filter((s) => s !== side),
  };

  return withResult(
    block,
    resultTextFromConflictState(block, next),
    statusFromConflictState(next),
    false,
    next,
  );
}

export function resolveUsingSide(
  block: ChangeBlock,
  side: ConflictSide,
): ChangeBlock {
  return side === "ours" ? acceptOurs(block) : acceptTheirs(block);
}

// desktop-IDE-style Revert on an applied non-conflicting hunk: restore base and
// mark the block unresolved so Apply stays disabled until re-resolved.
export function revertAppliedChange(block: ChangeBlock): ChangeBlock {
  if (block.kind === "unchanged") {
    return block;
  }
  if (block.kind === "conflict") {
    return resetBlock(block);
  }
  return withResult(block, block.baseText, "unresolved", false);
}

// Restore the block to its initial state for its kind.
export function resetBlock(block: ChangeBlock): ChangeBlock {
  const initial =
    block.kind === "unchanged"
      ? block.baseText
      : block.kind === "ours_only"
        ? block.oursText
        : block.kind === "theirs_only"
          ? block.theirsText
          : block.kind === "both_same"
            ? block.oursText
            : block.baseText;
  const status: ResolutionStatus =
    block.kind === "conflict" ? "unresolved" : "resolved";

  return withResult(
    block,
    initial,
    status,
    false,
    block.kind === "conflict"
      ? { ours: "pending", theirs: "pending", acceptedOrder: [] }
      : undefined,
  );
}

// User typed inside the block in the result editor.
export function manualEdit(block: ChangeBlock, text: string): ChangeBlock {
  return withResult(
    block,
    text,
    "manual",
    true,
    block.kind === "conflict" ? null : undefined,
  );
}

// True when every conflict block has been resolved.
export function allConflictsResolved(blocks: ChangeBlock[]): boolean {
  return blocks
    .filter((b) => b.kind === "conflict")
    .every((b) => b.status !== "unresolved");
}
