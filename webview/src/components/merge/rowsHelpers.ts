import type { BlameLine } from "@gitview/types";
import type { ChangeBlock, MergeDocument } from "../../../../src/core/types";
import {
  baseContextLabel,
  blockAnnotateLabel,
  unmodifiedBaseLabel,
} from "../../../../src/shared/lib/annotateLabels";
import type { BlockRows, ChangeType, OriginLine, RowCell, RowOrigin } from "./rowsTypes";

export function splitForView(text: string): string[] {
  if (text === "") {
    return [];
  }
  return text.replace(/\r\n/g, "\n").split("\n");
}

export function visualLineCount(text: string): number {
  return splitForView(text).length;
}

// Classify a block into its visual change type. Conflicts are red; otherwise we
// distinguish add (side has net-more lines than base), delete (net-fewer /
// emptied), or modify (same span changed). By-type coloring.
export function classifyChangeType(block: ChangeBlock): ChangeType {
  if (block.kind === "conflict") {
    if (block.status === "unresolved") {
      return "conflict";
    }
    if (block.resultText === block.baseText) {
      return "unchanged";
    }
    const baseLines = visualLineCount(block.baseText);
    const resultLines = visualLineCount(block.resultText);
    if (resultLines === 0 && baseLines > 0) {
      return "deleted";
    }
    if (resultLines > baseLines) {
      return "added";
    }
    if (resultLines < baseLines) {
      return "deleted";
    }
    return "modified";
  }
  if (block.kind === "unchanged") {
    return "unchanged";
  }

  const changedSide =
    block.kind === "theirs_only" ? block.theirsText : block.oursText;

  const baseLines =
    block.baseText === "" ? 0 : block.baseText.split("\n").length;
  const sideLines = changedSide === "" ? 0 : changedSide.split("\n").length;

  if (sideLines === 0 && baseLines > 0) {
    return "deleted";
  }
  if (sideLines > baseLines) {
    return "added";
  }
  if (sideLines < baseLines) {
    return "deleted";
  }
  return "modified";
}

export function originLines(text: string, origin: OriginLine["origin"]): OriginLine[] {
  return splitForView(text).map((line) => ({ text: line, origin }));
}

export function conflictSideStatus(
  block: ChangeBlock,
): BlockRows["conflictSideStatus"] {
  if (block.kind !== "conflict") {
    return undefined;
  }
  if (block.metadata.conflict) {
    return {
      ours: block.metadata.conflict.ours,
      theirs: block.metadata.conflict.theirs,
    };
  }
  if (block.status === "accepted_ours") {
    return { ours: "accepted", theirs: "ignored" };
  }
  if (block.status === "accepted_theirs") {
    return { ours: "ignored", theirs: "accepted" };
  }
  if (block.status === "accepted_both") {
    return { ours: "accepted", theirs: "accepted" };
  }
  if (block.status === "resolved" || block.status === "manual") {
    return { ours: "ignored", theirs: "ignored" };
  }
  return { ours: "pending", theirs: "pending" };
}

// Lines shown in the center for a block. Result pane starts at
// the base revision; conflict actions mutate resultText as each side is handled.
export function centerLinesFor(block: ChangeBlock): OriginLine[] {
  if (block.kind === "conflict" && block.status === "unresolved") {
    return originLines(block.resultText, "result");
  }

  if (block.kind === "conflict") {
    if (block.status === "accepted_ours") {
      return originLines(block.resultText, "ours");
    }
    if (block.status === "accepted_theirs") {
      return originLines(block.resultText, "theirs");
    }
    if (block.status === "accepted_both") {
      const oursFirst = [block.oursText, block.theirsText]
        .filter((part) => part !== "")
        .join("\n");
      const theirsFirst = [block.theirsText, block.oursText]
        .filter((part) => part !== "")
        .join("\n");
      if (block.resultText === oursFirst) {
        return [
          ...originLines(block.oursText, "ours"),
          ...originLines(block.theirsText, "theirs"),
        ];
      }
      if (block.resultText === theirsFirst) {
        return [
          ...originLines(block.theirsText, "theirs"),
          ...originLines(block.oursText, "ours"),
        ];
      }
    }
    return originLines(
      block.resultText,
      block.status === "manual" ? "manual" : "result",
    );
  }

  const origin =
    block.kind === "unchanged"
      ? "base"
      : block.kind === "ours_only"
        ? "ours"
        : block.kind === "theirs_only"
          ? "theirs"
          : block.kind === "both_same"
            ? "both"
            : block.status === "manual"
              ? "manual"
              : "result";
  return originLines(block.resultText, origin);
}

export function padCells(
  lines: string[],
  maxLines: number,
  startLineNo: number,
  origin: RowOrigin,
): RowCell[] {
  return padOriginCells(
    lines.map((text) => ({ text, origin })),
    maxLines,
    startLineNo,
  );
}

export function padBaseLines(baseText: string, maxLines: number): string[] {
  const lines = splitForView(baseText);
  const padded: string[] = [];
  for (let i = 0; i < maxLines; i++) {
    // `!`: guarded by the bounds test in the ternary.
    padded.push(i < lines.length ? lines[i]! : "");
  }
  return padded;
}

export function padOriginCells(
  lines: OriginLine[],
  maxLines: number,
  startLineNo: number,
): RowCell[] {
  const cells: RowCell[] = [];
  for (let i = 0; i < maxLines; i++) {
    if (i < lines.length) {
      // `!`: guarded by the bounds test above.
      const line = lines[i]!;
      cells.push({
        text: line.text,
        lineNo: startLineNo + i,
        origin: line.origin,
      });
    } else {
      cells.push({ text: null, lineNo: null, origin: "filler" });
    }
  }
  return cells;
}

// Stub git-blame annotation for a block, mirroring the mockup's
// GitAdapter.getBlameText: left pane shows the local/ours side, right shows the
// incoming/theirs side; unchanged context falls back to the base label. This is
// a placeholder until the host wires real `git blame` data into the document.
function blameFor(
  block: ChangeBlock,
  side: "left" | "right",
  doc: MergeDocument,
): string {
  if (block.kind === "unchanged") {
    return `base (${doc.oursLabel})`;
  }
  if (side === "left") {
    return block.kind === "theirs_only"
      ? `base (${doc.oursLabel})`
      : `${doc.oursLabel} • local`;
  }
  return block.kind === "ours_only"
    ? `base (${doc.oursLabel})`
    : `${doc.theirsLabel} • incoming`;
}

export type BuildBlockRowsOptions = {
  blameOurs?: BlameLine[] | null;
  blameTheirs?: BlameLine[] | null;
};

export function blameLabelForBlock(
  block: ChangeBlock,
  pane: "left" | "right",
  doc: MergeDocument,
  startLine: number,
  endLine: number,
  blameLines: BlameLine[] | null | undefined,
): string {
  const stub = blameFor(block, pane, doc);
  if (!blameLines?.length) {
    return stub;
  }

  if (block.kind === "unchanged") {
    return unmodifiedBaseLabel();
  }
  if (pane === "left" && block.kind === "theirs_only") {
    return baseContextLabel(doc.oursLabel);
  }
  if (pane === "right" && block.kind === "ours_only") {
    return baseContextLabel(doc.oursLabel);
  }

  return blockAnnotateLabel(
    blameLines,
    startLine,
    endLine,
    stub,
    doc.loadedAt,
  );
}
