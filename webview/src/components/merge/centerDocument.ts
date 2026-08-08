// Pure helpers for the single-editor Result (center) pane.
// Maps ChangeBlocks / BlockRows onto one continuous Monaco document.

import type { BlockRows } from "./rowsTypes";

export const CENTER_LINE_HEIGHT = 20;

/** Full result text shown in the center Monaco model (LF-joined block texts). */
export function joinCenterText(blocks: BlockRows[]): string {
  return blocks
    .map((b) => b.centerText)
    .filter((t) => t !== "")
    .join("\n");
}

export type CenterBlockSpan = {
  blockId: string;
  /** 1-based inclusive start in the center model; 0 when the block has no lines. */
  startLine: number;
  /** 1-based inclusive end in the center model; 0 when empty. */
  endLine: number;
  lineCount: number;
  navigable: boolean;
  changeType: BlockRows["changeType"];
  kind: BlockRows["kind"];
  resolved: boolean;
  centerText: string;
};

/** Build 1-based line spans from block resultRange (0-based [start, end)). */
export function buildCenterSpans(blocks: BlockRows[]): CenterBlockSpan[] {
  return blocks.map((b) => {
    const lineCount = Math.max(0, b.resultEnd - b.resultStart);
    const startLine = lineCount > 0 ? b.resultStart + 1 : 0;
    const endLine = lineCount > 0 ? b.resultEnd : 0;
    return {
      blockId: b.blockId,
      startLine,
      endLine,
      lineCount,
      navigable: b.navigable,
      changeType: b.changeType,
      kind: b.kind,
      resolved: b.resolved,
      centerText: b.centerText,
    };
  });
}

export function spanAtLine(
  spans: CenterBlockSpan[],
  line1Based: number,
): CenterBlockSpan | null {
  for (const span of spans) {
    if (
      span.lineCount > 0 &&
      line1Based >= span.startLine &&
      line1Based <= span.endLine
    ) {
      return span;
    }
  }
  return null;
}

/**
 * Monaco IModelContentChange line delta:
 * nlOld = endLineNumber - startLineNumber
 * nlNew = newlines in inserted text
 * delta = nlNew - nlOld
 *
 * Apply one change (already in document order from bottom for multi-change).
 */
export function applyMonacoChangeToSpans(
  spans: CenterBlockSpan[],
  startLine: number,
  endLine: number,
  insertedText: string,
): { spans: CenterBlockSpan[]; affectedBlockIds: string[] } {
  const nlOld = endLine - startLine;
  const nlNew =
    insertedText.length === 0 ? 0 : insertedText.split("\n").length - 1;
  const delta = nlNew - nlOld;
  const affected = new Set<string>();

  // Lines of each overlapping span that survive outside the replaced region.
  const survivors = new Map<string, number>();
  let ownerId: string | null = null;
  for (const span of spans) {
    if (span.lineCount <= 0 || span.endLine < startLine) {
      continue;
    }
    if (span.startLine > endLine) {
      continue;
    }
    affected.add(span.blockId);
    const head = Math.max(
      0,
      Math.min(span.endLine, startLine - 1) - span.startLine + 1,
    );
    const tail = Math.max(
      0,
      span.endLine - Math.max(span.startLine, endLine + 1) + 1,
    );
    survivors.set(span.blockId, head + tail);
    ownerId ??= span.blockId;
  }
  // The replacement itself has to belong to a block, otherwise a full-document
  // edit collapses every span and the typed text is never sent to the store.
  if (ownerId) {
    survivors.set(ownerId, (survivors.get(ownerId) ?? 0) + nlNew + 1);
  }

  let cursor = -1;
  const next = spans.map((span) => {
    if (span.lineCount <= 0) {
      return { ...span };
    }

    // Fully before
    if (span.endLine < startLine) {
      return { ...span };
    }

    // Fully after
    if (span.startLine > endLine) {
      return {
        ...span,
        startLine: span.startLine + delta,
        endLine: span.endLine + delta,
      };
    }

    // Overlaps edited region — repack contiguously from the first overlap.
    if (cursor < 0) {
      cursor = span.startLine;
    }
    const lineCount = survivors.get(span.blockId) ?? 0;
    if (lineCount <= 0) {
      return {
        ...span,
        startLine: 0,
        endLine: 0,
        lineCount: 0,
        centerText: "",
      };
    }
    const start = cursor;
    cursor += lineCount;
    return { ...span, startLine: start, endLine: start + lineCount - 1, lineCount };
  });

  return { spans: next, affectedBlockIds: [...affected] };
}

/**
 * Apply multiple Monaco content changes (must be sorted high rangeOffset first).
 */
export function applyMonacoChangesToSpans(
  spans: CenterBlockSpan[],
  changes: Array<{
    range: { startLineNumber: number; endLineNumber: number };
    text: string;
  }>,
): { spans: CenterBlockSpan[]; affectedBlockIds: string[] } {
  let next = spans.map((s) => ({ ...s }));
  const affected = new Set<string>();
  for (const change of changes) {
    const result = applyMonacoChangeToSpans(
      next,
      change.range.startLineNumber,
      change.range.endLineNumber,
      change.text,
    );
    next = result.spans;
    for (const id of result.affectedBlockIds) {
      affected.add(id);
    }
  }
  return { spans: next, affectedBlockIds: [...affected] };
}

/**
 * Read span text from a model. Empty model (single blank line with "") → "".
 */
export function extractSpanText(
  getLineContent: (line1Based: number) => string,
  modelLineCount: number,
  modelValue: string,
  span: CenterBlockSpan,
): string {
  if (modelLineCount === 1 && modelValue === "") {
    return span.lineCount > 0 ? "" : "";
  }
  if (span.lineCount <= 0 || span.startLine <= 0) {
    return "";
  }
  const start = Math.min(span.startLine, modelLineCount);
  const end = Math.min(span.endLine, modelLineCount);
  if (end < start || start < 1) {
    return "";
  }
  const lines: string[] = [];
  for (let ln = start; ln <= end; ln++) {
    lines.push(getLineContent(ln));
  }
  return lines.join("\n");
}
