import type {
  ChangeBlock,
  ConflictSideStatus,
} from "../../../../src/core/types";

// Visual change type drives coloring (specs §5.2). Independent of which side.
export type ChangeType =
  | "unchanged"
  | "added"
  | "modified"
  | "deleted"
  | "conflict";

export type RowOrigin =
  | "base"
  | "ours"
  | "theirs"
  | "both"
  | "result"
  | "manual"
  | "filler";

export type RowCell = {
  // Line text for this pane on this visual row. null = filler (no line here).
  text: string | null;
  // 1-based line number within the pane, or null for filler rows.
  lineNo: number | null;
  // Where this visual line came from. The renderer uses this to split accepted
  // both-sides results while the visual change type owns the actual coloring.
  origin: RowOrigin;
};

export type BlockRows = {
  blockId: string;
  kind: ChangeBlock["kind"];
  status: ChangeBlock["status"];
  changeType: ChangeType;
  navigable: boolean; // not "unchanged"
  isConflict: boolean;
  resolved: boolean;
  conflictSideStatus?: {
    ours: ConflictSideStatus;
    theirs: ConflictSideStatus;
  };
  // resultRange start/end (line indices) so manual edits map back to the block.
  resultStart: number;
  resultEnd: number;
  // The current center (result) text for this block, used to detect real edits.
  centerText: string;
  // Stub git-blame annotation per side. Host-backed blame wiring is planned;
  // for now we derive a placeholder from the branch labels so the details
  // column renders in the right place.
  blameLeft: string;
  blameRight: string;
  /** Base (ancestor) lines for word-level diff highlighting in side panes. */
  baseLines: string[];
  left: RowCell[];
  center: RowCell[];
  right: RowCell[];
};

export type OriginLine = {
  text: string;
  origin: RowOrigin;
};
