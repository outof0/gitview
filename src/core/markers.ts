// Conflict-marker handling (specs §11.3/§11.4). Used ONLY for cheap detection,
// label extraction, and the marker-only fallback engine. The primary engine is
// the 3-way diff (threeWay.ts). All detection is line-anchored to avoid false
// positives on prose containing marker-like characters.

import { splitLines } from "./lines";

const START = /^<{7}(?: |$)/;
const BASE = /^\|{7}(?: |$)/;
const SEP = /^={7}(?: |$)/;
const END = /^>{7}(?: |$)/;

// Does the text contain real conflict marker lines? (line-anchored)
export function hasConflictMarkers(text: string): boolean {
  return splitLines(text).some(
    (l) => START.test(l) || SEP.test(l) || END.test(l),
  );
}

// Extract ours/theirs labels from the first conflict, if present.
export function extractLabels(text: string): {
  oursLabel: string;
  theirsLabel: string;
} {
  const lines = splitLines(text);
  let oursLabel = "";
  let theirsLabel = "";
  for (const l of lines) {
    if (oursLabel === "" && START.test(l)) {
      oursLabel = l.replace(/^<{7} ?/, "").trim();
    } else if (END.test(l)) {
      theirsLabel = l.replace(/^>{7} ?/, "").trim();
      break;
    }
  }
  return { oursLabel, theirsLabel };
}

export type ParsedConflict = {
  ours: string;
  theirs: string;
  base?: string;
};

export type MarkerParseResult = {
  conflicts: ParsedConflict[];
  malformed: boolean;
};

// Parse worktree content into conflict regions. Supports diff3/zdiff3 (the
// optional ||||||| base section). Returns malformed=true on unbalanced or
// nested markers (caller blocks saving — specs §20).
export function parseMarkers(text: string): MarkerParseResult {
  const lines = splitLines(text);
  const conflicts: ParsedConflict[] = [];
  let i = 0;
  let malformed = false;

  // Every `lines[...]` read below is bounded by its enclosing loop guard.
  while (i < lines.length) {
    if (!START.test(lines[i]!)) {
      i++;
      continue;
    }
    // Found a start; collect until separator (with optional base), then end.
    const ours: string[] = [];
    const base: string[] = [];
    const theirs: string[] = [];
    let section: "ours" | "base" | "theirs" = "ours";
    let closed = false;
    i++;
    for (; i < lines.length; i++) {
      const l = lines[i]!;
      if (START.test(l)) {
        // Nested start before close → malformed.
        malformed = true;
        break;
      } else if (BASE.test(l)) {
        if (section !== "ours") {
          malformed = true;
          break;
        }
        section = "base";
      } else if (SEP.test(l)) {
        if (section === "theirs") {
          malformed = true;
          break;
        }
        section = "theirs";
      } else if (END.test(l)) {
        closed = true;
        i++;
        break;
      } else {
        if (section === "ours") {
          ours.push(l);
        } else if (section === "base") {
          base.push(l);
        } else {
          theirs.push(l);
        }
      }
    }
    if (!closed) {
      malformed = true;
      break;
    }
    conflicts.push({
      ours: ours.join("\n"),
      theirs: theirs.join("\n"),
      base: base.length > 0 ? base.join("\n") : undefined,
    });
  }

  return { conflicts, malformed };
}

// Validate that resolved content has no leftover marker lines (specs §20).
export function hasLeftoverMarkers(text: string): boolean {
  return splitLines(text).some(
    (l) => START.test(l) || BASE.test(l) || SEP.test(l) || END.test(l),
  );
}
