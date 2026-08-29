import { DiffTooLargeError, diffLines } from "./lcs";
import { resolveAutomatically } from "./resolve";
import type { ChangeBlock } from "./types";

type Token = {
  key: string;
  text: string;
};

type Granularity = "word" | "character";

type TextEdit = {
  start: number;
  end: number;
  replacementKeys: string[];
  replacementText: string;
};

function tokenize(
  text: string,
  granularity: Granularity,
  ignoreWhitespace: boolean,
): Token[] {
  const pieces =
    granularity === "word"
      ? (text.match(/[\p{L}\p{N}\p{M}_]+|\s+|[^\s]/gu) ?? [])
      : ignoreWhitespace
        ? (text.match(/\s+|[^\s]/gu) ?? [])
        : Array.from(text);

  return pieces.map((piece) => ({
    key: ignoreWhitespace && /^\s+$/u.test(piece) ? " " : piece,
    text: piece,
  }));
}

function tokenText(tokens: Token[], start: number, end: number): string {
  return tokens
    .slice(start, end)
    .map((token) => token.text)
    .join("");
}

function editsFrom(base: Token[], side: Token[]): TextEdit[] {
  const operations = diffLines(
    base.map((token) => token.key),
    side.map((token) => token.key),
  );
  return operations
    .filter((operation) => operation.type !== "equal")
    .map((operation) => {
      const replacement = side.slice(operation.bStart, operation.bEnd);
      return {
        start: operation.aStart,
        end: operation.aEnd,
        replacementKeys: replacement.map((token) => token.key),
        replacementText: replacement.map((token) => token.text).join(""),
      };
    });
}

function equalKeys(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function sameLogicalEdit(left: TextEdit, right: TextEdit): boolean {
  return (
    left.start === right.start &&
    left.end === right.end &&
    equalKeys(left.replacementKeys, right.replacementKeys)
  );
}

function editCanSlide(baseKeys: string[], edit: TextEdit): boolean {
  if (edit.start < edit.end && edit.replacementKeys.length === 0) {
    return (
      (edit.start > 0 && baseKeys[edit.start - 1] === baseKeys[edit.end - 1]) ||
      (edit.end < baseKeys.length &&
        baseKeys[edit.start] === baseKeys[edit.end])
    );
  }

  if (edit.start !== edit.end || edit.replacementKeys.length === 0) {
    return false;
  }

  const before = baseKeys[edit.start - 1];
  if (before !== undefined && edit.replacementKeys.includes(before)) {
    return true;
  }

  const after = baseKeys[edit.start];
  return after !== undefined && edit.replacementKeys.includes(after);
}

function hasAmbiguousAlignment(base: Token[], edits: TextEdit[]): boolean {
  const baseKeys = base.map((token) => token.key);
  if (edits.some((edit) => editCanSlide(baseKeys, edit))) {
    return true;
  }

  const removed = new Set<string>();
  const added = new Set<string>();
  for (const edit of edits) {
    for (let index = edit.start; index < edit.end; index++) {
      removed.add(baseKeys[index]!);
    }
    for (const key of edit.replacementKeys) {
      added.add(key);
    }
  }
  for (const key of added) {
    if (removed.has(key)) {
      return true;
    }
  }
  return false;
}

function editsOverlap(left: TextEdit, right: TextEdit): boolean {
  if (sameLogicalEdit(left, right)) {
    return false;
  }

  const leftInsert = left.start === left.end;
  const rightInsert = right.start === right.end;
  if (leftInsert && rightInsert) {
    return left.start === right.start;
  }
  if (leftInsert) {
    return left.start > right.start && left.start < right.end;
  }
  if (rightInsert) {
    return right.start > left.start && right.start < left.end;
  }
  return left.start < right.end && right.start < left.end;
}

function combineEdits(left: TextEdit[], right: TextEdit[]): TextEdit[] | null {
  for (const leftEdit of left) {
    for (const rightEdit of right) {
      if (editsOverlap(leftEdit, rightEdit)) {
        return null;
      }
    }
  }

  const combined = left.map((edit) => ({ ...edit }));
  for (const candidate of right) {
    const duplicate = combined.find((edit) => sameLogicalEdit(edit, candidate));
    if (duplicate) {
      continue;
    }
    combined.push({ ...candidate });
  }

  return combined.sort((a, b) => a.start - b.start || a.end - b.end);
}

function mergeTokens(
  baseText: string,
  oursText: string,
  theirsText: string,
  granularity: Granularity,
  ignoreWhitespace: boolean,
): string | null {
  const base = tokenize(baseText, granularity, ignoreWhitespace);
  const ours = tokenize(oursText, granularity, ignoreWhitespace);
  const theirs = tokenize(theirsText, granularity, ignoreWhitespace);
  const oursEdits = editsFrom(base, ours);
  const theirsEdits = editsFrom(base, theirs);
  if (
    hasAmbiguousAlignment(base, oursEdits) ||
    hasAmbiguousAlignment(base, theirsEdits)
  ) {
    return null;
  }

  const edits = combineEdits(oursEdits, theirsEdits);
  if (!edits) {
    return null;
  }

  let cursor = 0;
  let result = "";
  for (const edit of edits) {
    if (edit.start < cursor) {
      return null;
    }
    result += tokenText(base, cursor, edit.start);
    result += edit.replacementText;
    cursor = edit.end;
  }
  return result + tokenText(base, cursor, base.length);
}

/** Try to combine independent edits, returning null for an ambiguous overlap. */
export function tryMagicMerge(
  baseText: string,
  oursText: string,
  theirsText: string,
): string | null {
  if (oursText === theirsText) {
    return oursText;
  }
  if (oursText === baseText) {
    return theirsText;
  }
  if (theirsText === baseText) {
    return oursText;
  }

  try {
    const attempts: ReadonlyArray<readonly [Granularity, boolean]> = [
      ["word", false],
      ["word", true],
      ["character", false],
      ["character", true],
    ];
    for (const [granularity, ignoreWhitespace] of attempts) {
      const result = mergeTokens(
        baseText,
        oursText,
        theirsText,
        granularity,
        ignoreWhitespace,
      );
      if (result !== null) {
        return result;
      }
    }
    return null;
  } catch (error) {
    if (error instanceof DiffTooLargeError) {
      return null;
    }
    throw error;
  }
}

function isMagicMergeCandidate(block: ChangeBlock): boolean {
  const conflict = block.metadata.conflict;
  return !(
    block.kind !== "conflict" ||
    block.status !== "unresolved" ||
    block.metadata.hasManualEdit ||
    !conflict ||
    conflict.ours !== "pending" ||
    conflict.theirs !== "pending"
  );
}

export function isMagicMergeResolvable(block: ChangeBlock): boolean {
  return (
    isMagicMergeCandidate(block) &&
    tryMagicMerge(block.baseText, block.oursText, block.theirsText) !== null
  );
}

export function resolveMagicMergeBlock(block: ChangeBlock): ChangeBlock {
  if (!isMagicMergeCandidate(block)) {
    return block;
  }
  const result = tryMagicMerge(
    block.baseText,
    block.oursText,
    block.theirsText,
  );
  return result === null ? block : resolveAutomatically(block, result);
}
