// Core merge types. Pure data — no VS Code, no I/O.

export type Eol = "lf" | "crlf";

// A line range is [start, end) — zero-based, end-exclusive.
// An empty range (start === end) means "no lines on this side".
export type LineRange = { start: number; end: number };

// 3-way classification of a block, computed from base/ours/theirs.
export type ChangeKind =
  | "unchanged" // identical in ours and theirs (context; not navigable)
  | "ours_only" // changed on ours, theirs === base   (non-conflicting)
  | "theirs_only" // changed on theirs, ours === base  (non-conflicting)
  | "both_same" // ours === theirs, both differ from base (auto-resolvable)
  | "conflict"; // ours !== theirs and both differ from base

export type ResolutionStatus =
  | "unresolved"
  | "accepted_ours"
  | "accepted_theirs"
  | "accepted_both"
  | "manual"
  | "resolved";

export type ConflictSide = "ours" | "theirs";

export type ConflictSideStatus = "pending" | "accepted" | "ignored";

export type ConflictResolutionState = {
  ours: ConflictSideStatus;
  theirs: ConflictSideStatus;
  acceptedOrder: ConflictSide[];
};

export type ChangeBlock = {
  id: string;
  index: number; // index among ALL blocks
  changeIndex: number; // index among navigable blocks; -1 for unchanged

  kind: ChangeKind;

  baseRange: LineRange;
  oursRange: LineRange;
  theirsRange: LineRange;

  baseText: string;
  oursText: string;
  theirsText: string;

  resultText: string;
  resultRange: LineRange; // range this block occupies in the current result

  status: ResolutionStatus;

  metadata: {
    hasManualEdit: boolean;
    lastActionAt?: number;
    conflict?: ConflictResolutionState;
  };
};

export type SpecialConflictKind =
  | "none"
  | "add_add"
  | "modify_delete"
  | "delete_modify"
  | "binary";

export type MergeDocument = {
  repoRoot: string;
  relativePath: string;
  absolutePath: string;

  base: string | null;
  ours: string | null;
  theirs: string | null;
  worktree: string;

  result: string;

  blocks: ChangeBlock[];
  changeOrder: string[]; // ids of navigable blocks, in order
  conflictOrder: string[]; // ids of conflict blocks, in order

  special: SpecialConflictKind;

  oursLabel: string;
  theirsLabel: string;

  encoding: "utf8";
  eol: Eol;
  hasFinalNewline: boolean;
  languageId?: string;

  dirty: boolean;
  loadedAt: number;
};

export type AcceptBothOrder = "oursFirst" | "theirsFirst";

export type ResolveAction = "ours" | "theirs" | "both" | "reset";
