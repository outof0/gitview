import { diffLines } from "../../../../src/core/lcs";

const NAVIGATION_DIFF_MAX_WORK = 500_000;

export type DiffNavigationHunkKind = "added" | "removed" | "changed";

/** Line wash for one side of a hunk. Replaces use a red original / green modified, matching the native VS Code diff — not a third gold color. */
export function monacoDiffWashClass(
  kind: DiffNavigationHunkKind,
  side: "original" | "modified",
): "monaco-diff-added" | "monaco-diff-removed" | null {
  if (side === "original") {
    return kind === "added" ? null : "monaco-diff-removed";
  }
  return kind === "removed" ? null : "monaco-diff-added";
}

export type DiffNavigationHunk = {
  kind: DiffNavigationHunkKind;
  /** Inclusive 1-based line range on the original side. */
  originalStartLine: number;
  originalEndLine: number;
  /** Inclusive 1-based line range on the modified side. */
  modifiedStartLine: number;
  modifiedEndLine: number;
};

type MutableHunk = {
  aStart: number;
  aEnd: number;
  bStart: number;
  bEnd: number;
};

function lineRange(
  start: number,
  end: number,
  lineCount: number,
): { start: number; end: number } {
  const lastLine = Math.max(1, lineCount);
  if (end > start) {
    return {
      start: Math.min(start + 1, lastLine),
      end: Math.min(end, lastLine),
    };
  }
  const anchor = Math.min(Math.max(start + 1, 1), lastLine);
  return { start: anchor, end: anchor };
}

function toHunks(
  changes: readonly MutableHunk[],
  originalLineCount: number,
  modifiedLineCount: number,
): DiffNavigationHunk[] {
  return changes.map((change) => {
    const original = lineRange(
      change.aStart,
      change.aEnd,
      originalLineCount,
    );
    const modified = lineRange(
      change.bStart,
      change.bEnd,
      modifiedLineCount,
    );
    const hasOriginalLines = change.aEnd > change.aStart;
    const hasModifiedLines = change.bEnd > change.bStart;
    return {
      kind: hasOriginalLines
        ? hasModifiedLines
          ? "changed"
          : "removed"
        : "added",
      originalStartLine: original.start,
      originalEndLine: original.end,
      modifiedStartLine: modified.start,
      modifiedEndLine: modified.end,
    };
  });
}

/**
 * Build deterministic, worker-independent navigation targets for a diff.
 * Monaco's diff worker is intentionally disabled in the VS Code webview, so
 * the viewer must use the same main-thread LCS that paints its line markers.
 */
export function buildDiffNavigationHunks(
  originalText: string,
  modifiedText: string,
): DiffNavigationHunk[] {
  if (originalText === modifiedText) {
    return [];
  }

  const originalLines = originalText.split("\n");
  const modifiedLines = modifiedText.split("\n");

  try {
    const changes: MutableHunk[] = [];
    for (const op of diffLines(originalLines, modifiedLines, {
      maxWork: NAVIGATION_DIFF_MAX_WORK,
    })) {
      if (op.type === "equal") {
        continue;
      }
      const previous = changes[changes.length - 1];
      if (
        previous &&
        previous.aEnd === op.aStart &&
        previous.bEnd === op.bStart
      ) {
        previous.aEnd = op.aEnd;
        previous.bEnd = op.bEnd;
      } else {
        changes.push({
          aStart: op.aStart,
          aEnd: op.aEnd,
          bStart: op.bStart,
          bEnd: op.bEnd,
        });
      }
    }
    return toHunks(changes, originalLines.length, modifiedLines.length);
  } catch {
    return toHunks(
      [
        {
          aStart: 0,
          aEnd: originalLines.length,
          bStart: 0,
          bEnd: modifiedLines.length,
        },
      ],
      originalLines.length,
      modifiedLines.length,
    );
  }
}
