import type { DiffLineSelection } from "@gitview/shared/types/diff";
import type { DiffDisplayRow } from "../components/git/buildDiffDisplayRows";

export function lineSelectionKey(selection: DiffLineSelection): string {
  return `${selection.side}:${selection.line}`;
}

export function selectionFromRow(
  side: "left" | "right",
  row: DiffDisplayRow,
): DiffLineSelection | null {
  if (
    side === "left" &&
    row.leftNum !== null &&
    row.leftHighlight !== "none"
  ) {
    return { side: "old", line: row.leftNum };
  }
  if (
    side === "right" &&
    row.rightNum !== null &&
    row.rightHighlight !== "none"
  ) {
    return { side: "new", line: row.rightNum };
  }
  return null;
}

export function selectionsFromKeys(keys: Iterable<string>): DiffLineSelection[] {
  const selections: DiffLineSelection[] = [];
  for (const key of keys) {
    const [side, lineRaw] = key.split(":");
    const line = Number(lineRaw);
    if ((side === "old" || side === "new") && Number.isInteger(line) && line > 0) {
      selections.push({ side, line });
    }
  }
  return selections;
}